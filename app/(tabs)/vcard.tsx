import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { ScrollView, View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { buildVCardSharePayload, exchangeVCard, parseVCardPayload, type ScannedVCard } from '../../src/api/social';
import { resolvePartyId } from '../../src/lib/identity';
import { useAuth } from '../../src/providers/AuthProvider';
import { useUserSettings } from '../../src/providers/UserSettingsProvider';

type ScanEvent = { data: string };
type CameraModule = {
  CameraView: ComponentType<{
    barcodeScannerSettings?: { barcodeTypes: readonly ['qr'] };
    facing?: 'back' | 'front';
    onBarcodeScanned?: (event: ScanEvent) => void;
    style?: unknown;
  }>;
  requestCameraPermissionsAsync: () => Promise<{ status: string }>;
};

const QR_BARCODE_SCANNER_SETTINGS = { barcodeTypes: ['qr'] as const };

const parsePositivePartyId = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export default function VCardScreen() {
  const { token, partyId: authPartyId } = useAuth();
  const { partyId: settingsPartyId, displayName } = useUserSettings();
  const hydratedDefaultsRef = useRef({ name: false, partyId: false });
  const scanLockRef = useRef(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [partyId, setPartyId] = useState('');
  const effectivePartyId = useMemo(
    () => resolvePartyId(authPartyId, settingsPartyId),
    [authPartyId, settingsPartyId],
  );

  const [isScanning, setIsScanning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedVCard | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [cameraModule, setCameraModule] = useState<CameraModule | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const CameraComponent = cameraModule?.CameraView;

  useEffect(() => {
    if (!displayName || hydratedDefaultsRef.current.name) return;
    hydratedDefaultsRef.current.name = true;
    setName(displayName);
  }, [displayName]);

  useEffect(() => {
    if (!effectivePartyId || hydratedDefaultsRef.current.partyId) return;
    hydratedDefaultsRef.current.partyId = true;
    setPartyId(effectivePartyId);
  }, [effectivePartyId]);

  const handleNameChange = useCallback((value: string) => {
    hydratedDefaultsRef.current.name = true;
    setName(value);
  }, []);

  const handlePartyIdChange = useCallback((value: string) => {
    hydratedDefaultsRef.current.partyId = true;
    setPartyId(value);
  }, []);

  const qrValue = useMemo(
    () =>
      buildVCardSharePayload({
        name,
        email,
        phone,
        partyId: parsePositivePartyId(partyId),
      }),
    [name, email, phone, partyId],
  );

  const ensureCameraModule = useCallback(async () => {
    if (cameraModule || cameraError) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('expo-camera') as CameraModule;
      setCameraModule(mod);
    } catch (_err) {
      setCameraError('El lector de códigos no está disponible en este build. Instala expo-camera y vuelve a compilar.');
      setIsScanning(false);
    }
  }, [cameraModule, cameraError]);

  const requestPermission = useCallback(
    async (camera: CameraModule) => {
      const { status } = await camera.requestCameraPermissionsAsync();
      setCameraStatus(status);
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para escanear códigos QR.');
        setIsScanning(false);
      }
    },
    []
  );

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

  useEffect(() => {
    if (!isScanning) return;
    scanLockRef.current = false;
  }, [isScanning]);

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
      const message = err instanceof Error ? err.message : 'No pudimos enviar el intercambio.';
      Alert.alert('Error', message);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!isScanning) return;
    if (!cameraModule && !cameraError) {
      void ensureCameraModule();
      return;
    }
    if (cameraModule && cameraStatus !== 'granted') {
      void requestPermission(cameraModule);
    }
  }, [isScanning, cameraStatus, cameraModule, cameraError, ensureCameraModule, requestPermission]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Intercambio de vCard</Text>
      <Text style={styles.subtitle}>
        Muestra tu QR para compartir tu contacto o escanea el de otra persona. Si tienes acceso, envía el intercambio al
        CRM desde aquí.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tu tarjeta</Text>
        <TextInput placeholder="Nombre" value={name} onChangeText={handleNameChange} style={styles.input} />
        <TextInput placeholder="Correo" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="Teléfono" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
        <TextInput
          placeholder="Party ID (opcional)"
          value={partyId}
          onChangeText={handlePartyIdChange}
          style={styles.input}
          keyboardType="number-pad"
        />
        <View style={styles.qrBox}>
          <QRCode value={qrValue} size={180} />
          <Text style={styles.qrHint}>Comparte este QR para que te agreguen rápido.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Escanear QR</Text>
        {isScanning ? (
          <View style={styles.scannerBox}>
            {cameraError ? (
              <Text style={styles.errorText}>{cameraError}</Text>
            ) : CameraComponent ? (
              <>
                <CameraComponent
                  barcodeScannerSettings={QR_BARCODE_SCANNER_SETTINGS}
                  facing="back"
                  onBarcodeScanned={handleScan}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.scannerText}>Alinea el QR dentro del recuadro</Text>
              </>
            ) : (
              <Text style={styles.loadingText}>Preparando cámara…</Text>
            )}
            <Button title="Cancelar" onPress={() => setIsScanning(false)} />
          </View>
        ) : (
          <Button title="Abrir cámara" onPress={() => setIsScanning(true)} />
        )}

        {scanned && (
          <View style={styles.scannedBox}>
            <Text style={styles.scannedTitle}>Contacto recibido</Text>
            {scanned.name && <Text style={styles.rowText}>{scanned.name}</Text>}
            {scanned.email && <Text style={styles.rowText}>{scanned.email}</Text>}
            {scanned.phone && <Text style={styles.rowText}>{scanned.phone}</Text>}
            {scanned.partyId && <Text style={styles.rowText}>Party ID: {scanned.partyId}</Text>}
            <Button
              title={isSending ? 'Enviando…' : 'Enviar intercambio al CRM'}
              onPress={() => void handleExchange()}
              disabled={isSending}
            />
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
