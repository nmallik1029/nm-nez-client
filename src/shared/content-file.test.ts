import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { normaliseClientContent } from './client-content';

/**
 * The team's content file as it is in the repo, read the way a client reads it.
 *
 * Every client reads this file from main, and an entry it cannot make sense
 * of is dropped without a word, so a typo in one pick (a date written out, a
 * placement of "2nd") is that pick quietly missing for everyone. This is the
 * word: run before a push, it names what a client would drop. And a pick
 * whose screenshot is not in the folder would show "Screenshot unavailable"
 * to everyone who opened it.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const FILE = join(ROOT, 'assets', 'content', 'client.json');
const SCREENSHOTS = join(ROOT, 'assets', 'content', 'screenshots');

const raw = JSON.parse(readFileSync(FILE, 'utf8')) as {
  badges?: { players?: unknown[]; clans?: unknown[] };
  settings?: { id?: unknown }[];
};
const content = normaliseClientContent(raw);

describe('assets/content/client.json', () => {
  it('is a content file', () => {
    expect(content).not.toBeNull();
  });

  it('has nothing in it a client would drop', () => {
    expect(content?.players).toHaveLength(raw.badges?.players?.length ?? 0);
    expect(content?.clans).toHaveLength(raw.badges?.clans?.length ?? 0);
    const kept = new Set(content?.settings.map((pick) => pick.id));
    const dropped = (raw.settings ?? []).map((pick) => String(pick.id)).filter((id) => !kept.has(id.toLowerCase()));
    expect(dropped, 'picks a client would drop: check their id, name, date and settings').toEqual([]);
  });

  it('has every screenshot it names in the folder', () => {
    const missing = (content?.settings ?? [])
      .filter((pick) => pick.screenshot !== '' && !existsSync(join(SCREENSHOTS, pick.screenshot)))
      .map((pick) => `${pick.id}: ${pick.screenshot}`);
    expect(missing).toEqual([]);
  });
});
