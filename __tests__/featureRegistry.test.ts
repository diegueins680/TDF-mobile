import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  evaluateFeatureAccess,
  featureLabel,
  getFeatureById,
  getFeaturesByMobilePath,
  resolveMobileDestination,
  searchFeatures,
} from '../src/features/featureRegistry';
import { mobileFeatureRegistry } from '../src/features/generatedFeatureRegistry';

const appFileForDestination = (destination: string): string | null => {
  if (!destination.startsWith('/') || destination.startsWith('https://')) return null;
  const clean = destination.split(/[?#]/, 1)[0].replace(/^\//, '');
  const direct = path.join(process.cwd(), 'app', `${clean}.tsx`);
  if (existsSync(direct)) return direct;
  const index = path.join(process.cwd(), 'app', clean, 'index.tsx');
  if (existsSync(index)) return index;
  const contextual = path.join(process.cwd(), 'app', clean, '[id].tsx');
  if (existsSync(contextual)) return contextual;
  return null;
};

const expoRouteFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return expoRouteFiles(absolute);
  return entry.isFile() && entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx' ? [absolute] : [];
});

const expoRouteForFile = (filename: string): string => {
  const relative = path.relative(path.join(process.cwd(), 'app'), filename).replace(/\\/g, '/').replace(/\.tsx$/, '');
  const withoutIndex = relative === 'index' ? '' : relative.replace(/\/index$/, '');
  return withoutIndex ? `/${withoutIndex}` : '/';
};

describe('mobile feature registry', () => {
  it('contains unique stable ids and valid parent references', () => {
    const ids = mobileFeatureRegistry.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const feature of mobileFeatureRegistry) {
      if (feature.parentId) expect(getFeatureById(feature.parentId)).not.toBeNull();
      expect(feature.label.es.trim()).not.toBe('');
      expect(feature.label.en.trim()).not.toBe('');
      expect(feature.telemetryId).toBe(feature.id);
    }
  });

  it('keeps DDEX view separate from import authorization', () => {
    const session = { authenticated: true, roles: ['ReadOnly'], modules: ['CRM', 'Catalog'] };
    expect(evaluateFeatureAccess('label.ddex.inbox', session, 'view').state).toBe('allowed');
    const importDecision = evaluateFeatureAccess('label.ddex.inbox', session, 'import');
    expect(importDecision.state).toBe('locked');
    expect(importDecision.missingRoles).toContain('admin');
  });

  it('does not inherit view access for an undeclared action', () => {
    const session = { authenticated: true, roles: ['Admin', 'Customer', 'Fan'], modules: ['Catalog'] };
    expect(evaluateFeatureAccess('label.ddex.document', session, 'publish').state).toBe('concealed');
  });

  it('requires the authoritative session flag for flagged destinations', () => {
    const session = { authenticated: true, roles: ['Fan', 'Customer'], modules: ['Packages'] };
    expect(evaluateFeatureAccess('social.discovery', session, 'view').state).toBe('concealed');
    expect(evaluateFeatureAccess('social.discovery', {
      ...session,
      featureFlags: ['EVENT_DISCOVERY_ENABLED'],
    }, 'view').state).toBe('allowed');
  });

  it('uses each route exact action instead of merely allowing page view', () => {
    const feature = getFeatureById('artist.onboarding')!;
    const fan = { authenticated: true, roles: ['Fan', 'Customer'], modules: ['Packages'] };
    const artist = { authenticated: true, roles: ['Artist', 'Fan', 'Customer'], modules: ['Scheduling', 'Packages'] };
    expect(feature.routeAction).toBe('create');
    expect(evaluateFeatureAccess(feature, fan, feature.routeAction).state).not.toBe('allowed');
    expect(evaluateFeatureAccess(feature, artist, feature.routeAction).state).toBe('allowed');
  });

  it('conceals technical and security-sensitive routes from discovery', () => {
    expect(evaluateFeatureAccess('technical.auth-login', { authenticated: true }, 'view').state).toBe('concealed');
    expect(searchFeatures('oauth callback').some((feature) => feature.technical)).toBe(false);
    const tokenFeature = getFeatureById('tools.admin-token');
    expect(tokenFeature?.mobilePresentation.kind).toBe('security-concealed');
    expect(tokenFeature && resolveMobileDestination(tokenFeature)).toBeNull();
  });

  it('searches Spanish and English labels and synonyms', () => {
    expect(searchFeatures('bandeja ddex').map((feature) => feature.id)).toContain('label.ddex.inbox');
    expect(searchFeatures('ddex inbox').map((feature) => feature.id)).toContain('label.ddex.inbox');
    expect(featureLabel(getFeatureById('label.ddex.inbox')!, 'es')).toBe('DDEX / Bandeja');
    expect(featureLabel(getFeatureById('label.ddex.inbox')!, 'en')).toBe('DDEX / Inbox');
  });

  it('maps every native destination to an Expo route', () => {
    const missing = mobileFeatureRegistry.flatMap((feature) => {
      const kind = feature.mobilePresentation.kind;
      const destination = feature.mobilePresentation.destination;
      if (!destination || (kind !== 'native' && kind !== 'native-contextual')) return [];
      return appFileForDestination(destination) ? [] : [`${feature.id}:${destination}`];
    });
    expect(missing).toEqual([]);
  });

  it('classifies every Expo screen, including contextual, incomplete, and technical routes', () => {
    const unregistered = expoRouteFiles(path.join(process.cwd(), 'app')).flatMap((filename) => {
      const route = expoRouteForFile(filename);
      if (route === '/+html') return [];
      return getFeaturesByMobilePath(route).length > 0 ? [] : [route];
    });
    expect(unregistered).toEqual([]);
    expect(getFeaturesByMobilePath('/ddex/document/42').map((feature) => feature.id)).toContain('label.ddex.document');
    expect(getFeaturesByMobilePath('/contracts/NewContractScreen')[0]?.maturity).toBe('incomplete');
  });

  it('documents every web-only mobile treatment and resolves non-sensitive web links', () => {
    for (const feature of mobileFeatureRegistry) {
      const kind = feature.mobilePresentation.kind;
      if (kind === 'web-only' || kind === 'external-web') {
        expect(feature.mobilePresentation.documentedException || feature.mobilePresentation.destination).toBeTruthy();
        expect(resolveMobileDestination(feature)).not.toBeNull();
      }
    }
  });
});
