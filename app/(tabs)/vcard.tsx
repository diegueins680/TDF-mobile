import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { buildVCardSharePayload, exchangeVCard, parseVCardPayload, type ScannedVCard } from '../../src/api/social';
import {
  applySocialV2Intent,
  createSocialRequestKey,
  describeSocialV2Intent,
  isSocialLegacyRetiredError,
  resolveSocialMode,
  socialModeQueryKey,
  socialV2ActionErrorMessage,
  socialV2QueryRoot,
  type SocialV2Intent,
} from '../../src/api/socialV2';
import { useAuth } from '../../src/providers/AuthProvider';

type ScanEvent = Pick<BarcodeScanningResult, 'data'>;

const parsePositivePartyId = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export default function VCardScreen() {
  const { token, partyId: effectivePartyId, session } = useAuth();
  const displayName = session?.displayName ?? null;
  const hydratedDefaultsRef = useRef({ name: false });
  const scanLockRef = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<ScannedVCard | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const qc = useQueryClient();
  const hasToken = Boolean(token?.trim());
  // Runtime gate: social v2 (consent-based Seguir/Conectar) replaces the legacy
  // server-side vCard exchange once the API activates it.
  const modeQuery = useQuery({
    queryKey: socialModeQueryKey(effectivePartyId),
    queryFn: resolveSocialMode,
    enabled: hasToken,
    retry: 1,
  });
  const socialMode = modeQuery.isError ? 'error' : modeQuery.data?.mode ?? 'pending';
  const ownPartyId = parsePositivePartyId(effectivePartyId);

  useEffect(() => {
    if (!displayName || hydratedDefaultsRef.current.name) return;
    hydratedDefaultsRef.current.name = true;
    setName(displayName);
  }, [displayName]);

  const handleNameChange = useCallback((value: string) => {
    hydratedDefaultsRef.current.name = true;
    setName(value);
  }, []);

  const qrValue = useMemo(
    () =>
      buildVCardSharePayload({
        name,
        email,
        phone,
        partyId: parsePositivePartyId(effectivePartyId),
      }),
    [name, email, phone, effectivePartyId],
  );

  const openScanner = useCallback(async () => {
    if (cameraPermission?.granted) {
      setIsScanning(true);
      return;
    }

    try {
      setIsRequestingCamera(true);
      const response = await requestCameraPermission();
      if (!response.granted) {
        Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para escanear códigos QR.');
        setIsScanning(false);
        return;
      }
      setIsScanning(true);
    } catch (_err) {
      Alert.alert('Cámara no disponible', 'No pudimos habilitar la cámara en este dispositivo.');
      setIsScanning(false);
    } finally {
      setIsRequestingCamera(false);
    }
  }, [cameraPermission?.granted, requestCameraPermission]);

  const handleScan = useCallback((event: ScanEvent) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    setIsScanning(false);
    const parsed = parseVCardPayload(event.data);
    if (!parsed) {
      Alert.alert('Código inválido', 'El QR no contiene una tarjeta de contacto válida.');
      return;
    }
    setScanned(parsed);
  }, []);

  const handleV2Intent = async (intent: SocialV2Intent) => {
    if (!scanned?.partyId) {
      Alert.alert('Falta ID', 'El QR escaneado no incluye una identidad TDF.');
      return;
    }
    if (!token) {
      Alert.alert('Acceso requerido', 'Inicia sesión para seguir o conectar con esta persona.');
      return;
    }
    if (scanned.partyId === ownPartyId) {
      Alert.alert('Es tu código', 'Escanea el código de otra persona para conectar.');
      return;
    }
    try {
      setIsSending(true);
      const { state, changed } = await applySocialV2Intent(scanned.partyId, intent, createSocialRequestKey());
      void qc.invalidateQueries({ queryKey: socialModeQueryKey(effectivePartyId) });
      void qc.invalidateQueries({ queryKey: socialV2QueryRoot(effectivePartyId) });
      Alert.alert('Listo', describeSocialV2Intent(state, intent, changed));
    } catch (err) {
      Alert.alert('Error', socialV2ActionErrorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const handleExchange = async () => {
    if (!scanned?.partyId) {
      Alert.alert('Falta ID', 'El QR escaneado no incluye un partyId.');
      return;
    }
    if (!token) {
      Alert.alert('Acceso requerido', 'Necesitas permisos para enviar el intercambio al CRM.');
      return;
    }
    try {
      setIsSending(true);
      await exchangeVCard(scanned.partyId);
      Alert.alert('Listo', 'Intercambio enviado. Ambas partes verán el contacto en CRM.');
    } catch (err) {
      if (isSocialLegacyRetiredError(err)) {
        // The server retired the legacy exchange (410): switch to Seguir/Conectar.
        void qc.invalidateQueries({ queryKey: socialModeQueryKey(effectivePartyId) });
        Alert.alert('Vista social actualizada', 'El intercambio de vCard ya no se envía al servidor. Usa Conectar o Seguir con este contacto.');
        return;
      }
      const message = err instanceof Error ? err.message : 'No pudimos enviar el intercambio.';
      Alert.alert('Error', message);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!isScanning || cameraPermission === null || cameraPermission.granted) return;
    setIsScanning(false);
  }, [isScanning, cameraPermission]);

  useEffect(() => {
    if (!isScanning) {
      scanLockRef.current = false;
    }
  }, [isScanning]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Intercambio de vCard</Text>
      <Text style={styles.subtitle}>
        {socialMode === 'legacy'
          ? 'Muestra tu QR para compartir tu contacto o escanea el de otra persona. Si tienes acceso, envía el intercambio al CRM desde aquí.'
          : 'Muestra tu QR o escanea el de otra persona para seguirla o pedirle conectar. Tus datos de contacto viajan solo dentro del QR; no se guardan en el servidor.'}
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tu tarjeta</Text>
        <TextInput placeholder="Nombre" value={name} onChangeText={handleNameChange} style={styles.input} />
        <TextInput placeholder="Correo" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="Teléfono" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
        <Text style={styles.identityHint}>
          {effectivePartyId ? 'Tu identidad TDF se incluye automáticamente.' : 'Inicia sesión para incluir tu identidad TDF.'}
        </Text>
        <View style={styles.qrBox}>
          <QRCode value={qrValue} size={180} />
          <Text style={styles.qrHint}>Comparte este QR para que te agreguen rápido.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Escanear QR</Text>
        {isScanning ? (
          <View style={styles.scannerBox}>
            {cameraPermission && !cameraPermission.granted ? (
              <Text style={styles.errorText}>Activa el acceso a la cámara para escanear códigos QR.</Text>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleScan}
                />
                <Text style={styles.scannerText}>Alinea el QR dentro del recuadro</Text>
              </>
            )}
            <Button title="Cancelar" onPress={() => setIsScanning(false)} />
          </View>
        ) : (
          <Button title={isRequestingCamera ? 'Abriendo cámara…' : 'Abrir cámara'} onPress={() => void openScanner()} />
        )}

        {scanned && (
          <View style={styles.scannedBox}>
            <Text style={styles.scannedTitle}>Contacto recibido</Text>
            {scanned.name && <Text style={styles.rowText}>{scanned.name}</Text>}
            {scanned.email && <Text style={styles.rowText}>{scanned.email}</Text>}
            {scanned.phone && <Text style={styles.rowText}>{scanned.phone}</Text>}
            {socialMode === 'v2' ? (
              <>
                <Button
                  title={isSending ? 'Enviando…' : 'Conectar'}
                  onPress={() => void handleV2Intent('request')}
                  disabled={isSending || !scanned.partyId}
                  accessibilityLabel={`Conectar con ${scanned.name ?? 'este contacto'}`}
                />
                <Button
                  title="Seguir"
                  onPress={() => void handleV2Intent('follow')}
                  disabled={isSending || !scanned.partyId}
                  accessibilityLabel={`Seguir a ${scanned.name ?? 'este contacto'}`}
                />
                <Text style={styles.identityHint}>Conectar envía una solicitud: la otra persona debe aceptarla.</Text>
              </>
            ) : socialMode === 'legacy' ? (
              <Button
                title={isSending ? 'Enviando…' : 'Enviar intercambio al CRM'}
                onPress={() => void handleExchange()}
                disabled={isSending}
              />
            ) : (
              <Text style={styles.identityHint} accessibilityRole="alert">
                {socialMode === 'error' ? 'No se pudo comprobar el estado de la red social.' : socialMode === 'pending'
                  ? 'Comprobando la red social…'
                  : 'Estamos actualizando la red social. Guarda este contacto y vuelve a intentarlo en unos minutos.'}
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#555', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    backgroundColor: '#fff',
  },
  sectionTitle: { fontWeight: '700', fontSize: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 10,
    padding: 10,
  },
  qrBox: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  qrHint: { color: '#666', fontSize: 12 },
  identityHint: { color: '#666', fontSize: 12 },
  scannerBox: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#111',
  },
  scannerText: { color: '#fff', textAlign: 'center', padding: 8 },
  loadingText: { color: '#fff', textAlign: 'center', padding: 12 },
  errorText: { color: '#ffdddd', textAlign: 'center', padding: 12 },
  scannedBox: { gap: 6 },
  scannedTitle: { fontWeight: '700', fontSize: 15 },
  rowText: { color: '#333' },
});
