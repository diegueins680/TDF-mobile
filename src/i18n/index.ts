// Simple i18n implementation using a flat key-value map
// This avoids adding heavy dependencies like react-i18next

type Locale = 'es' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  es: {
    // Common
    'common.loading': 'Cargando...',
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
    // Common
    'common.loading': 'Loading...',
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

export function t(key: string, params?: Record<string, string | number>): string {
  let text = translations[currentLocale]?.[key] ?? translations.es[key] ?? key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}
