# Recuerdos escritos y lectura de audio en móvil

El compositor permite escribir un recuerdo sin adjuntar archivos cuando el servidor confirma `supportsExtendedMoments: true` mediante el GET existente de preferencias. Esta lectura no cambia consentimiento. La clave de consulta incluye cuenta y generación de sesión. Los servidores anteriores, errores y respuestas ambiguas conservan el comportamiento de foto/video.

El texto usa el contrato existente: tipo `text`, URL vacía y descripción no vacía de hasta 280 caracteres. Omite la subida de archivos, conserva el texto en el editor ante errores y utiliza las barreras de sesión de #170 antes y después de cada operación. Un fallo remoto nunca se convierte en una publicación local. Los borradores siguen aislados por Party y se identifican como privados en el dispositivo.

El feed solicita `?extended`, distingue audio/texto de imágenes y rechaza identidades remotas inválidas, respuestas cruzadas de evento y audio sin HTTPS. El texto no muestra una imagen rota ni abre una URL vacía. El audio tiene nombre accesible localizado y utiliza el manejador del dispositivo; no se añade un selector/grabador de audio. Los recursos históricos de imagen/video conservan sus URLs admitidas anteriormente.

## Validación

Node 20.19.4: 684 pruebas en 98 suites, lint, tipos, recursos, configuración de release y Expo pasan. Metro inició offline. El bundle Android contiene el código actual: las cinco fuentes relevantes del source map coinciden byte por byte con el checkout. El recibo JSON conserva hashes, alcance y los intentos iniciales fallidos de tipos/flags de Metro.

No es una prueba en Android/iOS físico ni una distribución en tiendas. Las pruebas de API de este cambio usan wrappers simulados; las pruebas reales backend/PostgreSQL/web están documentadas en la entrega raíz. El backend productivo anterior todavía no habilita texto. No hubo comunicaciones reales, cambios de preferencias ni escrituras productivas.

## Integración

Cambio apilado sobre #170 (`7000df1`); requiere revisión independiente y la integración autorizada de sus padres. No reemplaza sus aprobaciones ni evita las protecciones. No cambia contratos generados, dependencias ni configuración de despliegue.
