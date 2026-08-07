import { mobileFeatureRegistry } from './generatedFeatureRegistry';

export type MobileFeature = (typeof mobileFeatureRegistry)[number];
export type FeatureAction =
  | 'discover'
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'archive'
  | 'deactivate'
  | 'import'
  | 'export'
  | 'submit'
  | 'validate'
  | 'approve'
  | 'reject'
  | 'assign'
  | 'publish'
  | 'report'
  | 'administer';

export type FeatureAccessState = 'allowed' | 'locked' | 'concealed';

export type FeatureSession = {
  authenticated: boolean;
  roles?: readonly string[];
  modules?: readonly string[];
  featureFlags?: readonly string[];
};

type AccessRule = {
  rolesAny?: readonly string[];
  rolesAll?: readonly string[];
  modulesAny?: readonly string[];
  modulesAll?: readonly string[];
  strictAdmin?: boolean;
};

export type FeatureAccessDecision = {
  state: FeatureAccessState;
  feature: MobileFeature;
  missingRoles: string[];
  missingModules: string[];
  reason: 'allowed' | 'authentication' | 'role' | 'module' | 'feature-flag' | 'concealed';
};

const ROLE_ALIASES: Record<string, string> = {
  'a&r': 'aandr',
  'a and r': 'aandr',
  ar: 'aandr',
  'live sessions producer': 'livesessionsproducer',
  'live-sessions-producer': 'livesessionsproducer',
  'studio manager': 'studiomanager',
  'studio-manager': 'studiomanager',
};

export function normalizeFeatureToken(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('en').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ROLE_ALIASES[normalized] ?? normalized.replace(/[^a-z0-9]/g, '');
}

const normalizedSet = (values: readonly string[] | undefined): Set<string> =>
  new Set((values ?? []).map(normalizeFeatureToken).filter(Boolean));

const featureById = new Map<string, MobileFeature>(
  mobileFeatureRegistry.map((feature) => [feature.id, feature]),
);

const escapeRouteSegment = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mobileRouteMatchers = mobileFeatureRegistry.flatMap((feature) => {
  const candidates = [feature.mobilePresentation.destination, ...feature.mobileAliases]
    .filter((destination): destination is string =>
      typeof destination === 'string' && destination.startsWith('/') && !destination.startsWith('https://'));
  return candidates.map((destination) => {
    const segments = destination.split('/').filter(Boolean);
    const body = segments.map((segment) =>
      segment.startsWith('[') && segment.endsWith(']')
        ? '/[^/]+'
        : `/${escapeRouteSegment(segment)}`).join('');
    return { feature, destination, matcher: new RegExp(`^${body || '/'}$`) };
  });
});

export function getFeatureById(id: string): MobileFeature | null {
  return featureById.get(id) ?? null;
}

export function getFeaturesByMobilePath(pathname: string): MobileFeature[] {
  const clean = pathname.split(/[?#]/, 1)[0].replace(/\/$/, '') || '/';
  const seen = new Set<string>();
  return mobileRouteMatchers.flatMap(({ feature, matcher }) => {
    if (!matcher.test(clean) || seen.has(feature.id)) return [];
    seen.add(feature.id);
    return [feature];
  });
}

function matchesRule(
  rule: AccessRule,
  roles: ReadonlySet<string>,
  modules: ReadonlySet<string>,
): { allowed: boolean; missingRoles: string[]; missingModules: string[] } {
  const rolesAny = (rule.rolesAny ?? []).map(normalizeFeatureToken);
  const rolesAll = (rule.rolesAll ?? []).map(normalizeFeatureToken);
  const modulesAny = (rule.modulesAny ?? []).map(normalizeFeatureToken);
  const modulesAll = (rule.modulesAll ?? []).map(normalizeFeatureToken);
  const strictAdminRoles = new Set(['admin', 'fan', 'customer']);
  const strictAdminSatisfied = !rule.strictAdmin
    || (roles.has('admin') && Array.from(roles).every((role) => strictAdminRoles.has(role)));

  const missingRoles = Array.from(new Set([
    ...(!strictAdminSatisfied ? ['strict-admin'] : []),
    ...rolesAll.filter((role) => !roles.has(role)),
    ...(rolesAny.length > 0 && !rolesAny.some((role) => roles.has(role)) ? rolesAny : []),
  ]));
  const missingModules = Array.from(new Set([
    ...modulesAll.filter((moduleName) => !modules.has(moduleName)),
    ...(modulesAny.length > 0 && !modulesAny.some((moduleName) => modules.has(moduleName))
      ? modulesAny
      : []),
  ]));

  return {
    allowed: missingRoles.length === 0 && missingModules.length === 0,
    missingRoles,
    missingModules,
  };
}

export function evaluateFeatureAccess(
  featureOrId: MobileFeature | string,
  session: FeatureSession,
  action: FeatureAction = 'view',
): FeatureAccessDecision {
  const feature = typeof featureOrId === 'string' ? getFeatureById(featureOrId) : featureOrId;
  if (!feature) throw new Error(`Unknown feature: ${featureOrId as string}`);

  const maturity = feature.maturity as string;
  if (feature.technical || maturity === 'incomplete' || maturity === 'broken') {
    return { state: 'concealed', feature, missingRoles: [], missingModules: [], reason: 'concealed' };
  }
  if (feature.requiredAuth === 'authenticated' && !session.authenticated) {
    return {
      state: feature.safeLockedDisclosure ? 'locked' : 'concealed',
      feature,
      missingRoles: [],
      missingModules: [],
      reason: 'authentication',
    };
  }
  if (feature.featureFlag && !normalizedSet(session.featureFlags).has(normalizeFeatureToken(feature.featureFlag))) {
    return { state: 'concealed', feature, missingRoles: [], missingModules: [], reason: 'feature-flag' };
  }

  const roles = normalizedSet(session.roles);
  const modules = normalizedSet(session.modules);
  const actionRule = feature.permissions[action as keyof typeof feature.permissions] as AccessRule | undefined;
  if (!actionRule) {
    return { state: 'concealed', feature, missingRoles: [], missingModules: [], reason: 'concealed' };
  }
  const result = matchesRule({
    rolesAny: actionRule.rolesAny ?? (feature.requiredRoles.length > 0 ? feature.requiredRoles : undefined),
    rolesAll: actionRule.rolesAll,
    modulesAny: actionRule.modulesAny,
    modulesAll: [
      ...(feature.requiredModules ?? []),
      ...(actionRule.modulesAll ?? []),
    ],
    strictAdmin: actionRule.strictAdmin,
  }, roles, modules);

  if (result.allowed) {
    return { state: 'allowed', feature, missingRoles: [], missingModules: [], reason: 'allowed' };
  }
  return {
    state: feature.safeLockedDisclosure && feature.accessRequestEligible ? 'locked' : 'concealed',
    feature,
    missingRoles: result.missingRoles,
    missingModules: result.missingModules,
    reason: result.missingModules.length > 0 ? 'module' : 'role',
  };
}

export function featureLabel(feature: MobileFeature, locale: string | null | undefined): string {
  return locale?.toLowerCase().startsWith('en') ? feature.label.en : feature.label.es;
}

const searchableText = (feature: MobileFeature): string => [
  feature.label.es,
  feature.label.en,
  ...feature.synonyms.es,
  ...feature.synonyms.en,
  ...feature.keywords,
  feature.webRoute ?? '',
].map(normalizeFeatureToken).join(' ');

export function searchFeatures(
  query: string,
  features: readonly MobileFeature[] = mobileFeatureRegistry,
): MobileFeature[] {
  const terms = query.split(/\s+/).map(normalizeFeatureToken).filter(Boolean);
  return features.filter((feature) => {
    if (!feature.searchable || feature.technical) return false;
    const haystack = searchableText(feature);
    return terms.every((term) => haystack.includes(term));
  });
}

export function mobileDestination(feature: MobileFeature): string | null {
  const destination = feature.mobilePresentation.destination;
  return typeof destination === 'string' && destination.trim() ? destination : null;
}

export type ResolvedMobileDestination = { kind: 'native' | 'web'; value: string };

export function resolveMobileDestination(
  feature: MobileFeature,
  hqBaseUrl = process.env.EXPO_PUBLIC_HQ_URL?.trim() || 'https://tdf-app.pages.dev',
): ResolvedMobileDestination | null {
  const kind = feature.mobilePresentation.kind;
  if (kind === 'technical' || kind === 'security-concealed') return null;
  const configured = mobileDestination(feature);
  if (configured) {
    return configured.startsWith('https://')
      ? { kind: 'web', value: configured }
      : { kind: 'native', value: configured };
  }
  if ((kind === 'web-only' || kind === 'external-web') && feature.webRoute?.startsWith('/')) {
    return { kind: 'web', value: `${hqBaseUrl.replace(/\/$/, '')}${feature.webRoute}` };
  }
  return null;
}

export function mobileDiscoverableFeatures(session: FeatureSession): FeatureAccessDecision[] {
  return mobileFeatureRegistry.flatMap((feature) => {
    if (!feature.globalMenu || !resolveMobileDestination(feature)) return [];
    const decision = evaluateFeatureAccess(feature, session, 'discover');
    return decision.state === 'concealed' ? [] : [decision];
  });
}
