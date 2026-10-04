// Simple i18n implementation using a flat key-value map
// This avoids adding heavy dependencies like react-i18next

type Locale = 'es' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  es: {
    "feedback.title": "Enviar feedback",
    "feedback.prompt": "¿Cómo te ha ido con TDF?",
    "feedback.copy": "Tu experiencia nos ayuda a mejorar. Puedes contarnos un problema, una idea o algo difícil de usar.",
    "feedback.bug": "Problema",
    "feedback.ux": "Experiencia de uso",
    "feedback.idea": "Idea",
    "feedback.general": "Comentario",
    "feedback.description": "Cuéntanos qué pasó y qué esperabas",
    "feedback.privacy": "No incluyas contraseñas, tokens ni información privada. Revisa tu captura antes de enviarla.",
    "feedback.technical": "Incluir versión, build, sistema operativo, idioma y origen del formulario",
    "feedback.consent": "Autorizo usar este comentario para mejorar TDF.",
    "feedback.send": "Enviar",
    "feedback.sending": "Enviando…",
    "feedback.sent": "¡Gracias! Recibimos tu comentario.",
    "feedback.error": "No se pudo enviar. Tu comentario se conserva para reintentar.",
    "feedback.screenshot": "Adjuntar captura (PNG/JPEG, hasta 5 MB)",
    "feedback.invalid": "Elige una captura PNG o JPEG de hasta 5 MB.",
    "feedback.later": "Ahora no",
    "feedback.never": "No volver a sugerir",
    "feedback.close": "Cerrar",
    "feedback.loading": "Cargando formulario…",
    "feedback.retry": "Reintentar",
    "feedback.program": "TDF Mobile / Programa de testers",
    // Common
    'common.loading': 'Cargando...',
    'common.loadingSession': 'Cargando sesión',
    'common.error': 'Error',
    'common.retry': 'Reintentar',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.save': 'Guardar',
    'common.delete': 'Eliminar',
    'common.close': 'Cerrar',
    'common.search': 'Buscar',
    'common.noResults': 'Sin resultados',
    'common.offline': 'Sin conexión',
    'common.unsavedChanges': 'Cambios sin guardar',
    'common.discardChanges': '¿Quieres descartar los cambios?',
    'common.discard': 'Descartar',

    // Auth
    'auth.login': 'Iniciar sesión',
    'auth.signup': 'Crear cuenta',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.forgotPassword': '¿Olvidaste tu contraseña?',
    'auth.resetPassword': 'Restablecer contraseña',
    'auth.resetPasswordSent': 'Te enviamos un enlace para restablecer tu contraseña.',

    // Tabs
    'tabs.accessibilityPosition': '{title}, pestaña {position} de {count}',
    'tabs.directory': 'Directorio',
    'tabs.events': 'Eventos',
    'tabs.social': 'Seguir',
    'tabs.explore': 'Explorar',
    'tabs.create': 'Crear',
    'tabs.profile': 'Perfil',

    // Events
    'events.title': 'Eventos',
    'events.search': 'Buscar eventos',
    'events.saved': 'Guardados',
    'events.all': 'Todos',
    'events.myList': 'Mis ciudades',
    'events.explore': 'Explorar',
    'events.list': 'Lista',
    'events.calendar': 'Calendario',
    'events.noEvents': 'No hay eventos',

    // Validation
    'validation.required': 'Campo obligatorio',
    'validation.invalidEmail': 'Correo electrónico inválido',
    'validation.minLength': 'Mínimo {min} caracteres',
    'validation.passwordTooShort': 'La contraseña debe tener al menos 8 caracteres',
  },
  en: {
    "feedback.title": "Send feedback",
    "feedback.prompt": "How is TDF working for you?",
    "feedback.copy": "Your experience helps us improve. Tell us about a problem, an idea or something hard to use.",
    "feedback.bug": "Problem",
    "feedback.ux": "User experience",
    "feedback.idea": "Idea",
    "feedback.general": "Comment",
    "feedback.description": "Tell us what happened and what you expected",
    "feedback.privacy": "Do not include passwords, tokens or private information. Review your screenshot before sending.",
    "feedback.technical": "Include version, build, operating system, language and form source",
    "feedback.consent": "I agree to this feedback being used to improve TDF.",
    "feedback.send": "Send",
    "feedback.sending": "Sending…",
    "feedback.sent": "Thank you! We received your feedback.",
    "feedback.error": "Could not send. Your feedback is preserved so you can retry.",
    "feedback.screenshot": "Attach screenshot (PNG/JPEG, up to 5 MB)",
    "feedback.invalid": "Choose a PNG or JPEG screenshot up to 5 MB.",
    "feedback.later": "Not now",
    "feedback.never": "Do not suggest again",
    "feedback.close": "Close",
    "feedback.loading": "Loading form…",
    "feedback.retry": "Retry",
    "feedback.program": "TDF Mobile / Tester program",
    // Common
    'common.loading': 'Loading...',
    'common.loadingSession': 'Loading session',
    'common.error': 'Error',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.search': 'Search',
    'common.noResults': 'No results',
    'common.offline': 'No connection',
    'common.unsavedChanges': 'Unsaved changes',
    'common.discardChanges': 'Do you want to discard your changes?',
    'common.discard': 'Discard',

    // Auth
    'auth.login': 'Log in',
    'auth.signup': 'Sign up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.forgotPassword': 'Forgot your password?',
    'auth.resetPassword': 'Reset password',
    'auth.resetPasswordSent': 'We sent you a password reset link.',

    // Tabs
    'tabs.accessibilityPosition': '{title}, tab {position} of {count}',
    'tabs.directory': 'Directory',
    'tabs.events': 'Events',
    'tabs.social': 'Follow',
    'tabs.explore': 'Explore',
    'tabs.create': 'Create',
    'tabs.profile': 'Profile',

    // Events
    'events.title': 'Events',
    'events.search': 'Search events',
    'events.saved': 'Saved',
    'events.all': 'All',
    'events.myList': 'My cities',
    'events.explore': 'Explore',
    'events.list': 'List',
    'events.calendar': 'Calendar',
    'events.noEvents': 'No events',

    // Validation
    'validation.required': 'Required field',
    'validation.invalidEmail': 'Invalid email',
    'validation.minLength': 'Minimum {min} characters',
    'validation.passwordTooShort': 'Password must be at least 8 characters',
  },
};

let currentLocale: Locale = 'es';

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>, locale: Locale = currentLocale): string {
  let text = translations[locale]?.[key] ?? translations.es[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}
