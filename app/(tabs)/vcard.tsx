import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { ScrollView, View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { buildVCardSharePayload, exchangeVCard, parseVCardPayload, type ScannedVCard } from '../../src/api/social';
import { useAuth } from '../../src/providers/AuthProvider';

type ScanEvent = { data: string };
type ScannerModule = {
  BarCodeScanner: ComponentType<{ onBarCodeScanned: (event: ScanEvent) => void; style?: unknown }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
};

export default function VCardScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [partyId, setPartyId] = useState('');
  const { token } = useAuth();

  const [isScanning, setIsScanning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedVCard | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [scannerModule, setScannerModule] = useState<ScannerModule | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const ScannerComponent = scannerModule?.BarCodeScanner;

  const qrValue = useMemo(
    () =>
      buildVCardSharePayload({
        name,
        email,
        phone,
        partyId: Number(partyId) > 0 ? Number(partyId) : undefined,
      }),
    [name, email, phone, partyId],
  );

  const ensureScannerModule = useCallback(async () => {
      if (scannerModule || scannerError) return;
      try {
      const mod = (await import('expo-barcode-scanner')) as unknown as ScannerModule;
      setScannerModule(mod);
    } catch (_err) {
      setScannerError(
        'El lector de códigos no está disponible en este build de Expo Go. Instala la versión compatible o usa un dev client.'
      );
      setIsScanning(false);
    }
  }, [scannerModule, scannerError]);

  const requestPermission = useCallback(
    async (scanner: ScannerModule) => {
      const { status } = await scanner.requestPermissionsAsync();
      setCameraStatus(status);
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para escanear códigos QR.');
        setIsScanning(false);
      }
    },
    []
  );

  const handleScan = (event: ScanEvent) => {
    setIsScanning(false);
    const parsed = parseVCardPayload(event.data);
    if (!parsed) {
      Alert.alert('Código inválido', 'El QR no contiene una tarjeta de contacto válida.');
      return;
    }
    setScanned(parsed);
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
      const message = err instanceof Error ? err.message : 'No pudimos enviar el intercambio.';
      Alert.alert('Error', message);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!isScanning) return;
    if (!scannerModule && !scannerError) {
      void ensureScannerModule();
      return;
    }
    if (scannerModule && cameraStatus === null) {
      void requestPermission(scannerModule);
    }
  }, [isScanning, cameraStatus, scannerModule, scannerError, ensureScannerModule, requestPermission]);

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Text style={styles.title}>Intercambio de vCard</Text>
      <Text style={styles.subtitle}>
        Muestra tu QR para compartir tu contacto o escanea el de otra persona. Si tienes acceso, envía el intercambio al
        CRM desde aquí.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Tu tarjeta</Text>
        <TextInput placeholder="Nombre" value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="Correo" value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" />
        <TextInput placeholder="Teléfono" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
        <TextInput
          placeholder="Party ID (opcional)"
          value={partyId}
          onChangeText={setPartyId}
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
            {scannerError ? (
              <Text style={styles.errorText}>{scannerError}</Text>
            ) : ScannerComponent ? (
              <>
                <ScannerComponent onBarCodeScanned={handleScan} style={StyleSheet.absoluteFillObject} />
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
