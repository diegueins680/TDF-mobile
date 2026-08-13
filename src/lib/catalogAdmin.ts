import type { CatalogDraft, CatalogItem } from '../api/catalogs';

export type CatalogEditorKind =
  | 'appearance-mode'
  | 'radio-auto-stop'
  | 'feedback-category'
  | 'feedback-severity'
  | 'reaction-type'
  | 'flat-catalog'
  | 'read-only';

export interface CatalogAdminForm {
  entityId?: string;
  baseVersion?: number;
  code: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  sortOrder: string;
  reason: string;
  defaultForScope: boolean;
  durationMinutes: string;
  displaySymbol: string;
}

export const catalogEditorKind = (entityKind: string): CatalogEditorKind => {
  switch (entityKind) {
    case 'appearance_mode_option':
      return 'appearance-mode';
    case 'radio_auto_stop_option':
      return 'radio-auto-stop';
    case 'feedback_category':
      return 'feedback-category';
    case 'feedback_severity':
      return 'feedback-severity';
    case 'reaction_type':
    case 'content_reaction_type':
      return 'reaction-type';
    case 'creator_badge_type':
      return 'flat-catalog';
    default:
      return 'read-only';
  }
};

export const emptyCatalogAdminForm = (): CatalogAdminForm => ({
  code: '',
  nameEs: '',
  nameEn: '',
  descriptionEs: '',
  descriptionEn: '',
  sortOrder: '0',
  reason: '',
  defaultForScope: false,
  durationMinutes: '',
  displaySymbol: '',
});

export const formFromCatalogItem = (
  item: CatalogItem,
  defaultForScope: boolean,
  durationMinutes?: number,
): CatalogAdminForm => ({
  entityId: item.id,
  baseVersion: item.version,
  code: item.code,
  nameEs: item.nameEs,
  nameEn: item.nameEn,
  descriptionEs: item.descriptionEs ?? '',
  descriptionEn: item.descriptionEn ?? '',
  sortOrder: String(item.sortOrder),
  reason: '',
  defaultForScope,
  durationMinutes: durationMinutes === undefined ? '' : String(durationMinutes),
  displaySymbol: item.displaySymbol ?? '',
});

const optionalText = (value: string): string | undefined => value.trim() || undefined;

const correlationId = (kind: CatalogEditorKind): string =>
  `mobile-catalog:${kind}:${Date.now()}:${Math.random().toString(36).slice(2)}`;

const baseDraft = (form: CatalogAdminForm, kind: CatalogEditorKind): CatalogDraft => ({
  entityId: form.entityId,
  baseVersion: form.baseVersion,
  code: form.code.trim(),
  nameEs: form.nameEs.trim(),
  nameEn: form.nameEn.trim(),
  descriptionEs: optionalText(form.descriptionEs),
  descriptionEn: optionalText(form.descriptionEn),
  searchAliasesEs: [],
  searchAliasesEn: [],
  sortOrder: Number(form.sortOrder),
  reason: form.reason.trim(),
  sourcePlatform: 'mobile-admin',
  correlationId: correlationId(kind),
});

export const buildCatalogAdminDraft = (
  kind: CatalogEditorKind,
  form: CatalogAdminForm,
): CatalogDraft => {
  const draft = baseDraft(form, kind);
  if (kind === 'appearance-mode') {
    return { ...draft, appearanceMode: { defaultForApplication: form.defaultForScope } };
  }
  if (kind === 'radio-auto-stop') {
    return {
      ...draft,
      radioAutoStop: {
        durationMinutes: Number(form.durationMinutes),
        defaultForBroadcast: form.defaultForScope,
      },
    };
  }
  if (kind === 'feedback-category' || kind === 'feedback-severity') {
    return { ...draft, globalDefault: form.defaultForScope };
  }
  if (kind === 'reaction-type') {
    return { ...draft, displaySymbol: form.displaySymbol.trim() };
  }
  if (kind === 'flat-catalog') return draft;
  throw new Error('Este tipo de catálogo todavía no admite edición móvil estricta.');
};

export const catalogAdminFormIsValid = (
  kind: CatalogEditorKind,
  form: CatalogAdminForm,
): boolean => {
  const sortOrder = Number(form.sortOrder);
  if (
    kind === 'read-only'
    || !form.code.trim()
    || !form.nameEs.trim()
    || !form.nameEn.trim()
    || !form.reason.trim()
    || !Number.isSafeInteger(sortOrder)
    || sortOrder < 0
  ) return false;

  if (kind === 'appearance-mode') return Boolean(form.entityId);
  if (kind === 'feedback-category' || kind === 'feedback-severity') return true;
  if (kind === 'reaction-type') {
    const symbol = form.displaySymbol.trim();
    return symbol.length > 0 && symbol.length <= 16;
  }
  if (kind === 'flat-catalog') return true;
  const duration = Number(form.durationMinutes);
  return Number.isSafeInteger(duration) && duration >= 0 && duration <= 1440;
};
