# Publicación de archivos de audio en móvil

El compositor incorpora “Agregar audio” en Android/iOS cuando el servidor confirma soporte extendido y el evento es público/listable. El selector copia el archivo a caché para poder subirlo inmediatamente. La selección no realiza solicitudes de publicación. MP3, M4A, WAV, OGG y FLAC usan el endpoint duradero existente y el límite de 25 MB; el servidor conserva las comprobaciones de autorización, tamaño real y firma. Los proveedores sin MIME pueden usar una extensión admitida; MIME explícitamente incompatible se rechaza.

Antes de enviar se explica que el archivo tendrá un enlace público; el botón dice “Publicar audio público”. Los eventos privados no ofrecen este selector, y el backend ya deniega esa carga. No se presenta este almacenamiento como privado/revocable. La publicación se confirma mediante la respuesta del servidor; ante errores, el archivo y el texto vuelven al editor. Se conservan barreras de cuenta/sesión, se descartan selecciones tardías después de cerrar/reabrir el editor y se reutilizan los controles de galería. No se añade grabación ni permiso de micrófono.

## Dependencia y compatibilidad nativa

Se añade únicamente `expo-document-picker ~14.0.8`, la versión declarada por el SDK 54.0.37 instalado. ImagePicker no permite seleccionar audio; este módulo proporciona la interfaz del sistema y no introduce otro servicio ni almacenamiento. La [documentación de Expo](https://docs.expo.dev/versions/latest/sdk/document-picker/) explica la copia a caché; la API y versión concretas se comprobaron en los tipos instalados y bundledNativeModules del SDK 54.

El runtime Expo/iOS/Android cambia a `1.0.1-interactions-audio.1`. La guardia de release rechaza también el runtime previo `1.0.1-interactions.1`; un control negativo restaura las tres configuraciones antiguas en una copia temporal y verifica el rechazo. Requiere un nuevo binario nativo: no se enviará por OTA a binarios sin el módulo.

El lock iOS añade solo cuatro entradas para ExpoDocumentPicker y conserva exactamente todos los objetos anteriores. El checksum se calcula con el JSON real del sandbox de CocoaPods 1.16.2/JSON 2.18.0 y se contrasta con dos pods ya bloqueados. Esto no equivale a `pod install --deployment`: ese paso y las compilaciones deben validarse en CI macOS/Android. Esta máquina solo tiene Command Line Tools, sin Xcode.

## Pruebas

Node 20.19.4: npm ci, 722 pruebas/99 suites, lint, tipos, recursos/configuración y Metro offline pasan. Los catorce controles de artefactos pasan localmente sin skips, incluido codesign real sobre un binario sintético. Se corrigió una terminación NUL única que codesign de Monterey añade al XML; se sigue rechazando otro contenido al final y se conservan las verificaciones de identidad, dominios y runtime.

El bundle Android contiene las tres fuentes modificadas byte por byte en el mapa y el JavaScript del selector. Autolinking de Apple y Android resuelve DocumentPicker 14.0.8. El recibo `reports/event-moment-audio-2026-10-26.json` conserva hashes, resultados y los intentos iniciales fallidos. El bundle JS no acredita un APK/IPA compilado, un dispositivo ni las tiendas.

Cambio apilado sobre #172, sin alterar su head ni sus revisiones. Debe superar compilación nativa, CI y revisión independiente antes de integración. No hay despliegue, cuentas/contactos reales, cambios de preferencias ni invitaciones del evento 141.
