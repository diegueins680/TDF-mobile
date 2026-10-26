// Uses the parent repository's existing Playwright installation; no mobile dependency.
const { chromium, devices, expect } = await import(process.env.TDF_PLAYWRIGHT_MODULE || '@playwright/test');
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const origin = process.env.TDF_PREVIEW_ORIGIN || 'http://127.0.0.1:8119', api = process.env.TDF_PREVIEW_API || 'http://127.0.0.1:18129';
for (const url of [origin, api]) {
  const u = new URL(url);
  if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(u.hostname) || u.origin !== url)
    throw new Error('Preview origins must be distinct HTTP loopback origins.');
}
if (origin === api)
  throw new Error('UI and synthetic API origins must differ.');
const out = process.env.TDF_PREVIEW_OUTPUT || `/private/tmp/tdf-mobile-author-preview-${Date.now()}`;
mkdirSync(out, { recursive: true });
const old = '2026-10-26T08:00:00.123456Z';
let moment = { emId: '77', emEventId: '42', emAuthorPartyId: '7', emAuthorName: 'Autor sintético', emCaption: 'Mi recuerdo original', emMediaType: 'text', emMediaUrl: '', emCreatedAt: old, emUpdatedAt: old };
const report = { scope: 'Expo Web preview of native source; all API responses synthetic and external egress blocked, connectivity HEAD fulfilled locally; not a physical native device or real backend integration', status: 'NOT_EXECUTED', startedAt: new Date().toISOString(), node: process.version, sourceHashes: {}, syntheticConnectivityProbes: 0, apiRequests: [], blockedExternal: 0, pageErrors: [], edits: [], deletions: 0 };
for (const path of ['app/eventDetail.tsx', 'src/api/events.ts', 'src/components/EventMomentCard.tsx', 'src/localization/eventExperienceCopy.ts'])
  report.sourceHashes[path] = createHash('sha256').update(readFileSync(path)).digest('hex');
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'es-EC', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('tdf-auth-token', 'synthetic-author-preview-token'));
  await context.route('**/*', async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin === origin)
      return route.continue();
    // Reply locally to the app's connectivity probe; never contact Google.
    if (req.url() === 'https://connectivitycheck.gstatic.com/generate_204' && req.method() === 'HEAD') {
      report.syntheticConnectivityProbes++;
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (u.origin !== api) {
      report.blockedExternal++;
      return route.abort('blockedbyclient');
    }
    report.apiRequests.push({ method: req.method(), path: u.pathname });
    const cors = { 'access-control-allow-origin': origin, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS', 'access-control-allow-credentials': 'true' };
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
    if (req.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers: cors });
    if (u.pathname === '/session')
      return json({ partyId: 7, username: 'synthetic-author', displayName: 'Autor sintético', roles: ['fan'], modules: [], featureFlags: [] });
    if (u.pathname === '/session/preferences')
      return json({ localeId: '54000000-0000-4000-8000-000000000001', locale: 'es', currencyId: '54000000-0000-4000-8000-000000000002', currency: 'USD', timezone: 'America/Guayaquil' });
    if (u.pathname === '/session/onboarding/reconcile')
      return json({ progress: { eligible: false, signupCompletedAt: null, onboardingIntent: 'events', completedAt: '2026-01-01T00:00:00Z', firstValue: null, firstValueCompletedAt: null, updatedAt: '2026-01-01T00:00:00Z' }, newlyCompleted: false });
    if (u.pathname === '/social-events/events/42')
      return json({ eventId: '42', eventTypeId: '54000000-0000-4000-8000-000000000003', eventOrganizerPartyId: '8', eventTitle: 'Evento sintético de recuerdos', eventStart: '2026-10-24T19:00:00Z', eventEnd: '2026-10-25T02:00:00Z', eventIsPublic: true, eventPublicListable: true, eventRsvpEligible: false, eventWorkflowStateCode: 'completed', eventWorkflowStateId: '54000000-0000-4000-8000-000000000004', eventWorkflowStateNameEs: 'Finalizado', eventWorkflowStateNameEn: 'Completed', eventArtists: [] });
    if (u.pathname === '/social-events/me/memory-invitations')
      return json({ inApp: false, supportsExtendedMoments: true });
    if (u.pathname === '/social-events/events/42/moments')
      return json(moment ? [moment] : []);
    if (u.pathname === '/social-events/events/42/moments/77' && req.method() === 'PUT') {
      const body = req.postDataJSON();
      report.edits.push(body);
      if (body.emeExpectedUpdatedAt !== old || body.emeCaption !== 'Mi recuerdo corregido')
        return json({ message: 'Invalid synthetic edit contract' }, 400);
      moment = { ...moment, emCaption: body.emeCaption, emUpdatedAt: '2026-10-26T08:01:00.654321Z' };
      return json(moment);
    }
    if (u.pathname === '/social-events/events/42/moments/77' && req.method() === 'DELETE') {
      report.deletions++;
      moment = null;
      return route.fulfill({ status: 204, headers: cors });
    }
    if (u.pathname.endsWith('/rsvp'))
      return json(null);
    if (u.pathname.endsWith('/rsvp-summary'))
      return json({ rsvpAcceptedCount: 0, rsvpMaybeCount: 0 });
    if (u.pathname.endsWith('/ticket-orders') || u.pathname.endsWith('/ticket-tiers') || u.pathname.endsWith('/invitations'))
      return json([]);
    if (u.pathname === '/social-events/me/favorites')
      return json([]);
    return json({ message: 'Synthetic unavailable endpoint' }, 503);
  });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(String(e)));
  await page.goto(origin + '/eventDetail?eventId=42', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByText(/^Momentos \(\d+\)$/).click({ timeout: 90000 });
  await expect(page.getByText('Momentos (1)', { exact: true })).toBeVisible();
  const edit = page.getByRole('button', { name: 'Editar recuerdo', exact: true });
  await expect(edit).toBeVisible();
  await edit.scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + '/author-controls.png', fullPage: true });
  await edit.click();
  await page.getByRole('textbox', { name: 'Descripción del recuerdo', exact: true }).fill('Mi recuerdo corregido');
  expect(report.edits).toHaveLength(0);
  await page.screenshot({ path: out + '/author-edit.png', fullPage: true });
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByText('Recuerdo actualizado en TDF.', { exact: true })).toBeVisible();
  expect(report.edits).toHaveLength(1);
  expect(report.edits[0]).toEqual({ emeCaption: 'Mi recuerdo corregido', emeExpectedUpdatedAt: old });
  await page.screenshot({ path: out + '/author-saved.png', fullPage: true });
  await page.getByRole('button', { name: 'Eliminar recuerdo', exact: true }).click();
  await expect(page.getByText('Se eliminará la publicación del evento. Los archivos públicos y las copias externas pueden seguir existiendo.', { exact: true })).toBeVisible();
  expect(report.deletions).toBe(0);
  await page.screenshot({ path: out + '/author-delete-confirmation.png', fullPage: true });
  await page.getByRole('button', { name: 'Cancelar eliminación', exact: true }).click();
  expect(report.deletions).toBe(0);
  await page.getByRole('button', { name: 'Eliminar recuerdo', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
  await expect(page.getByText('Publicación eliminada del evento.', { exact: true })).toBeVisible();
  await expect(page.getByText('Mi recuerdo corregido', { exact: true })).toHaveCount(0);
  expect(report.deletions).toBe(1);
  await page.screenshot({ path: out + '/author-deleted.png', fullPage: true });
  report.knownBlockedExternalWorkerErrors = report.pageErrors.filter(e => e.includes("importScripts") && e.includes('https://cdn.jsdelivr.net/npm/jsqr@1.2.0/dist/jsQR.min.js'));
  report.unexpectedPageErrors = report.pageErrors.filter(e => !report.knownBlockedExternalWorkerErrors.includes(e));
  expect(report.unexpectedPageErrors).toEqual([]);
  report.status = 'PASS';
}
catch (e) {
  report.status = 'FAIL';
  report.error = String(e);
  if (browser)
    for (const c of browser.contexts())
      for (const p of c.pages())
        await p.screenshot({ path: out + '/failure.png', fullPage: true }).catch(() => { });
  process.exitCode = 1;
}
finally {
  report.finishedAt = new Date().toISOString();
  await browser?.close();
  report.browserClosed = true;
  writeFileSync(out + '/results.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, error: report.error, pageErrors: report.pageErrors }));
