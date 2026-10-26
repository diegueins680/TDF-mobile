# Editar y eliminar recuerdos propios desde móvil

El autor puede corregir la descripción o eliminar una publicación remota desde Momentos. Las acciones requieren identidad propia, una publicación persistida y la capacidad extendida confirmada por el servidor. No se atribuye autoría por nombre ni se transforman borradores locales en publicaciones confirmadas. El servidor conserva la decisión de autorización para cada petición.

La edición reutiliza PUT del evento/recuerdo y envía únicamente `emeCaption` y `emeExpectedUpdatedAt`. Se conserva el timestamp original, incluidos los microsegundos PostgreSQL; convertirlo mediante `Date.toISOString()` haría fallar el control de concurrencia. La respuesta debe confirmar ID, autor, descripción y una nueva versión válida. Los registros históricos sin versión no ofrecen edición. Una respuesta 409 conserva el texto y explica cómo cargar la versión actual.

La eliminación exige una segunda decisión en un diálogo accesible ES/EN. Solo HTTP 204 con cuerpo vacío confirma la acción. El aviso explica que los archivos públicos y las copias externas pueden seguir existiendo: eliminar la publicación no acredita revocación del objeto. Este diálogo también funciona en la previsualización web, donde Alert.alert de React Native Web no implementa confirmaciones.

Ninguna acción modifica optimistamente la caché. Tras confirmación se actualiza exclusivamente el feed del evento y la cuenta que iniciaron la acción, y se invalidan las interacciones existentes. Los callbacks retirados por cierre, desmontaje o cambio de sesión no despachan ni presentan éxitos tardíos; el bloqueo síncrono evita doble envío durante una petición. Los errores conservan la publicación y el texto. No cambian contratos, migraciones, permisos, preferencias, runtime, dependencias ni configuración nativa.

## Criterios de aceptación y evidencia

- Solo el autor con sesión vigente ve las acciones; no aparecen en borradores, cuentas ajenas o servidores sin capacidad explícita.
- La edición exige versión real y confirmación válida, conserva el borrador ante conflicto y rechaza respuestas malformadas/cruzadas.
- Abrir o cancelar la eliminación no envía DELETE; una doble confirmación concurrente produce una sola petición. La fila desaparece después de la confirmación del servidor.
- Los cambios de credenciales y el desmontaje descartan callbacks y respuestas tardías.

Node 20.19.4: **759 pruebas / 101 suites** pasan, incluidas 57 pruebas específicas en tres suites. Pasan release:check (recursos, lint, tipos y configuración), los **14 controles locales de artefactos sin skips** y Metro offline. El bundle JavaScript Android y su mapa contienen exactamente las cuatro fuentes ejecutables modificadas. No constituye una compilación APK/IPA ni prueba en un dispositivo.

[Recibo y hashes](../reports/event-moment-author-actions-2026-10-26.json). [Editor](../reports/event-moment-author-actions-20261026/author-edit.png), [confirmación de borrado](../reports/event-moment-author-actions-20261026/author-delete-confirmation.png) y [resultado](../reports/event-moment-author-actions-20261026/author-deleted.png).

La prueba visual utiliza Expo Web/Pixel 7, con API íntegramente sintética, sin comunicación externa. Comprueba PUT con microsegundos exactos, confirmación visible, cancelar sin DELETE y eliminación después de 204. El ping de conectividad recibe un 204 local. El worker QR preexistente intenta cargar jsQR externo, queda bloqueado y produce un error conocido conservado en el recibo; no se acredita el escáner ni cero errores globales. Los intentos fallidos del harness permanecen registrados y no cuentan como pases.

## Reproducción de la previsualización

Desde este checkout con Node 20 y dependencias reales instaladas:

```sh
CI=1 EXPO_OFFLINE=1 EXPO_PUBLIC_API_BASE=http://127.0.0.1:18129 EXPO_PUBLIC_POSTHOG_KEY='' npm run start -- --offline --port 8119 --clear
```

En otra terminal, usar el Playwright ya disponible en el repositorio padre:

```sh
TDF_PLAYWRIGHT_MODULE=/ruta/absoluta/al/node_modules/@playwright/test/index.mjs node scripts/test-event-moment-author-preview.mjs
```

El script solo acepta orígenes HTTP loopback y nunca contacta el backend configurado: intercepta todas sus respuestas. Las capturas y resultados se guardan en un directorio temporal. No modifica el evento 141 ni preferencias reales.

## Integración y límites

Cambio apilado sobre #173. Sus dependencias y configuraciones nativas permanecen idénticas a 6d0b109; los artefactos anteriores conservan su identidad y no demuestran estas nuevas acciones. Se requiere CI del head final y revisión independiente antes de integrar. No hay despliegue, publicación en tiendas, invitaciones reales ni aumento de conversión acreditado.
