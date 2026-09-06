import { readFileSync } from 'node:fs';
import path from 'node:path';

const eventDetail = readFileSync(path.join(process.cwd(), 'app/eventDetail.tsx'), 'utf8');
const liveBroadcasts = readFileSync(path.join(process.cwd(), 'src/lib/liveBroadcasts.ts'), 'utf8');
const socialScreen = readFileSync(path.join(process.cwd(), 'app/(tabs)/social.tsx'), 'utf8');
const eventMomentCard = readFileSync(path.join(process.cwd(), 'src/components/EventMomentCard.tsx'), 'utf8');
const eventMoments = readFileSync(path.join(process.cwd(), 'src/lib/eventMoments.ts'), 'utf8');
const vcardScreen = readFileSync(path.join(process.cwd(), 'app/(tabs)/vcard.tsx'), 'utf8');

describe('mobile Party identity copy', () => {
  it('never asks a person to configure or save a Party ID', () => {
    expect(eventDetail).not.toMatch(/(?:configura|guarda) tu Party ID/i);
    expect(liveBroadcasts).not.toMatch(/(?:configura|guarda) tu Party ID/i);
  });

  it('describes missing canonical identity as an account or session state', () => {
    expect(eventDetail).toContain('Inicia sesión con una cuenta vinculada');
    expect(liveBroadcasts).toContain('Tu sesión no tiene una identidad vinculada');
  });

  it('renders relationship names supplied by the social API without downloading the directory', () => {
    expect(socialScreen).not.toContain('Parties.list');
    expect(socialScreen).not.toContain('Party ID:');
    expect(socialScreen).not.toContain('ID #{targetId}');
    expect(socialScreen).toContain('item.pfFollowerName');
    expect(socialScreen).toContain('item.pfFollowingName');
  });

  it('does not expose recipient Party IDs in invitation history', () => {
    expect(eventDetail).not.toContain('Para #{inv.toUserId}');
    expect(eventDetail).toContain('Invitación a una cuenta TDF');
  });

  it('does not expose an author Party ID in event moment cards', () => {
    expect(eventMomentCard).not.toMatch(/Party\s*#/i);
    expect(eventMoments).not.toMatch(/Party\s*#/i);
    expect(eventMomentCard).toContain('moment.authorName');
  });

  it('keeps the canonical identifier inside vCard payloads instead of rendering it', () => {
    expect(vcardScreen).not.toContain('Party ID:');
    expect(vcardScreen).toContain('partyId: parsePositivePartyId(effectivePartyId)');
    expect(vcardScreen).toContain('exchangeVCard(scanned.partyId)');
  });
});
