import type { CatalogItem } from '../src/api/catalogs';
import {
  buildCatalogAdminDraft,
  catalogAdminFormIsValid,
  catalogEditorKind,
  formFromCatalogItem,
  type CatalogAdminForm,
} from '../src/lib/catalogAdmin';

const item: CatalogItem = {
  id: '11111111-1111-4111-8111-111111111111',
  catalogId: '22222222-2222-4222-8222-222222222222',
  catalogCode: 'appearance-modes',
  kind: 'appearance_mode_option',
  code: 'system',
  name: 'Sistema',
  nameEs: 'Sistema',
  nameEn: 'System',
  searchAliases: [],
  sortOrder: 0,
  active: true,
  workflowState: 'published',
  usageCount: 0,
  version: 4,
};

const validForm = (overrides: Partial<CatalogAdminForm> = {}): CatalogAdminForm => ({
  entityId: item.id,
  baseVersion: item.version,
  code: ' system ',
  nameEs: ' Sistema ',
  nameEn: ' System ',
  descriptionEs: '',
  descriptionEn: '',
  sortOrder: '0',
  reason: ' Revisión móvil ',
  defaultForScope: true,
  durationMinutes: '',
  displaySymbol: '',
  ...overrides,
});

describe('mobile catalog administration', () => {
  it('dispatches only persisted entity kinds with strict mobile editors', () => {
    expect(catalogEditorKind('appearance_mode_option')).toBe('appearance-mode');
    expect(catalogEditorKind('radio_auto_stop_option')).toBe('radio-auto-stop');
    expect(catalogEditorKind('feedback_category')).toBe('feedback-category');
    expect(catalogEditorKind('feedback_severity')).toBe('feedback-severity');
    expect(catalogEditorKind('reaction_type')).toBe('reaction-type');
    expect(catalogEditorKind('content_reaction_type')).toBe('reaction-type');
    expect(catalogEditorKind('creator_badge_type')).toBe('flat-catalog');
    expect(catalogEditorKind('arbitrary_json')).toBe('read-only');
  });

  it('creates a bilingual creator badge type without reaction-only metadata', () => {
    const form = validForm({ code: 'og', nameEs: 'Miembro fundador', nameEn: 'Founding member' });
    const draft = buildCatalogAdminDraft('flat-catalog', form);
    expect(catalogAdminFormIsValid('flat-catalog', form)).toBe(true);
    expect(draft).toMatchObject({ code: 'og', nameEs: 'Miembro fundador', nameEn: 'Founding member' });
    expect(draft).not.toHaveProperty('displaySymbol');
    expect(draft).not.toHaveProperty('globalDefault');
  });

  it('creates a reaction revision with persisted bilingual copy and symbol metadata', () => {
    const form = validForm({
      entityId: undefined,
      baseVersion: undefined,
      code: 'applause',
      nameEs: 'Aplauso',
      nameEn: 'Applause',
      displaySymbol: '👏',
    });

    expect(catalogAdminFormIsValid('reaction-type', form)).toBe(true);
    expect(buildCatalogAdminDraft('reaction-type', form)).toMatchObject({
      code: 'applause',
      displaySymbol: '👏',
      sourcePlatform: 'mobile-admin',
    });
    expect(catalogAdminFormIsValid('reaction-type', { ...form, displaySymbol: '' })).toBe(false);
  });

  it('creates an appearance revision using the canonical UUID and typed default payload', () => {
    const form = validForm();
    const draft = buildCatalogAdminDraft('appearance-mode', form);

    expect(catalogAdminFormIsValid('appearance-mode', form)).toBe(true);
    expect(draft).toMatchObject({
      entityId: item.id,
      baseVersion: 4,
      code: 'system',
      nameEs: 'Sistema',
      appearanceMode: { defaultForApplication: true },
      reason: 'Revisión móvil',
      sourcePlatform: 'mobile-admin',
    });
    expect(draft).not.toHaveProperty('theme');
    expect(draft).not.toHaveProperty('slug');
  });

  it('creates a radio revision with bounded integer minutes and no copied selector', () => {
    const form = validForm({
      entityId: undefined,
      baseVersion: undefined,
      code: 'minutes-45',
      nameEs: '45 minutos',
      nameEn: '45 minutes',
      durationMinutes: '45',
      sortOrder: '20',
    });
    const draft = buildCatalogAdminDraft('radio-auto-stop', form);

    expect(catalogAdminFormIsValid('radio-auto-stop', form)).toBe(true);
    expect(draft).toMatchObject({
      radioAutoStop: { durationMinutes: 45, defaultForBroadcast: true },
      sortOrder: 20,
      sourcePlatform: 'mobile-admin',
    });
    expect(draft).not.toHaveProperty('durationMinutes');
  });

  it('creates feedback revisions with a typed scoped-default decision', () => {
    const form = validForm({
      entityId: undefined,
      baseVersion: undefined,
      code: 'support',
      nameEs: 'Soporte',
      nameEn: 'Support',
    });

    expect(catalogAdminFormIsValid('feedback-category', form)).toBe(true);
    expect(buildCatalogAdminDraft('feedback-category', form)).toMatchObject({
      code: 'support',
      globalDefault: true,
      sourcePlatform: 'mobile-admin',
    });
    expect(buildCatalogAdminDraft('feedback-severity', form)).toMatchObject({
      code: 'support',
      globalDefault: true,
      sourcePlatform: 'mobile-admin',
    });
  });

  it('rejects legacy, ambiguous, and out-of-range writes before calling the API', () => {
    expect(catalogAdminFormIsValid('read-only', validForm())).toBe(false);
    expect(catalogAdminFormIsValid('appearance-mode', validForm({ entityId: undefined }))).toBe(false);
    expect(catalogAdminFormIsValid('radio-auto-stop', validForm({ durationMinutes: '45.5' }))).toBe(false);
    expect(catalogAdminFormIsValid('radio-auto-stop', validForm({ durationMinutes: '1441' }))).toBe(false);
    expect(() => buildCatalogAdminDraft('read-only', validForm())).toThrow('no admite edición móvil estricta');
  });

  it('preserves the published item UUID/version while preparing a revision', () => {
    expect(formFromCatalogItem(item, true)).toMatchObject({
      entityId: item.id,
      baseVersion: 4,
      code: 'system',
      defaultForScope: true,
    });
  });
});
