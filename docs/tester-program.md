# Programa de testers y feedback nativo

Implementado desde main d2fd9399126e3b456c310497fb7d9edba09f981d. La web canónica del programa es https://www.tdfrecords.net/app; los enlaces de tienda/canales son responsabilidad de esa configuración web y no se duplican aquí.

Perfil y Acerca de ofrecen «Enviar feedback». El modal voluntario reutiliza POST /feedback y los catálogos publicados; permite problema, UX, idea o comentario, descripción, captura PNG/JPEG opcional <=5 MB y consentimiento explícito. El usuario puede excluir metadata técnica. Solo se incluye versión nativa/build, OS/version, idioma, origen profile/about y development/release. No se añaden tokens, IDs de dispositivo, contenido de pantalla ni logs. El fallo conserva el borrador en memoria; no se crea una cola persistente de contenido privado.

PostHog ya existente recibe opened/submitted, nunca texto/captura. Submitted requiere respuesta HTTP exitosa. Sin clave configurada el cliente sigue en no-op. mobile_first_open significa primer arranque observado con esta integración, no instalación de la tienda ni atribución a una campaña; limpiar storage/reinstalar puede repetirlo. No hay SDK de atribución nuevo.

Después de tres sesiones separadas al menos 30 minutos, una tarjeta de feedback puede aparecer en Perfil/Acerca de. No abre el modal automáticamente. «Ahora no» lo oculta por 30 días; «No volver a sugerir» persiste el opt-out. La entrada manual sigue disponible.

Las URLs de privacidad, soporte, términos y borrado usan www.tdfrecords.net/mobile-app, comprobado HTTP200 durante la auditoría. No se retiró pages.dev de associated domains, intent filters ni callbacks OAuth. No se modificaron runtimeVersion, channels ni perfiles de release.

QA de referencia antes de los últimos ajustes de metadata/foreground: 89 suites/558 tests y release:check pasaron; Expo Doctor 17/17 con red; 12 tests Python de signing/artifact guards pasaron. TesterFeedback y TesterParticipation añaden prueba de consentimiento/envío y de privacidad/frecuencia. Consultar el PR para resultados finales exactos. No se fabricó evidencia física VoiceOver/TalkBack/OAuth.

Para publicar estos cambios hacen falta CI y revisión independiente del commit actual, merge protegido, un build firmado nuevo, y los gates de distribución del canal elegido. La versión 1.0.1 build29 observada en Apple precede a estos cambios; no contiene este formulario. No se atribuye este trabajo a los builds ya existentes.

## Production analytics configuration

TDF Records / TDF Production uses PostHog EU project `294698` and
`https://eu.i.posthog.com`. The owner authorized the free plan with
`info@tdfrecords.net`. Session replay, autocapture, console capture and heatmaps
remain disabled; IP anonymization is enabled.

The signed iOS and Android GitHub Actions lanes read the public repository
variables `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`. Keep the same
values in the EAS **production** project environment for EAS builds. Neither
value is a personal API credential; never put account passwords, signing
credentials or private API keys into `EXPO_PUBLIC_*`. Unit tests remove these
variables before running so they cannot send synthetic events.

Changing environment variables does not update installed apps. Generate and
qualify new signed artifacts, then use the existing authorized beta submission
lanes. iOS 1.0.1 (31) and Android 1.0.1 (23), built from `7a1fca369`, predate
this project and do not demonstrate production analytics receipt. Record the
exact source commit and verify a real app session before claiming first-open
or native feedback telemetry. First open is not an attributed installation,
and a web click cannot be joined to an anonymous native user by assumption.
