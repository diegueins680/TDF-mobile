import { readFileSync } from 'node:fs';
import path from 'node:path';

const eventDetail = readFileSync(path.join(process.cwd(), 'app/eventDetail.tsx'), 'utf8');
const liveBroadcasts = readFileSync(path.join(process.cwd(), 'src/lib/liveBroadcasts.ts'), 'utf8');
const socialScreen = readFileSync(path.join(process.cwd(), 'app/(tabs)/social.tsx'), 'utf8');

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
});
