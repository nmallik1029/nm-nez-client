import headshotSound from './headshot-sound.js?raw';

/**
 * The scripts that ship with the client.
 *
 * These are userscripts in the ordinary sense: plain `.js` files, run through
 * `new Function` in the page, no build step of their own. They live in the
 * repo rather than in the swap folder because we wrote them and they should
 * arrive with an update, but nothing about them is privileged: anything one
 * of these can do, a file you drop in `scripts/` can do too.
 *
 * A script's body may end with `return <function>`, and if it does, that
 * function is its teardown. Toggling one off calls it. A script without one
 * simply cannot be switched off until a restart, which is worth avoiding.
 *
 * `icon` is a Material Icons ligature. Krunker already loads that font for
 * its own UI, so naming one costs nothing.
 */
export interface ClientScript {
  /** Stable id. This is what gets written to the config, so do not rename. */
  readonly id: string;
  readonly name: string;
  /** One line, in the panel under the name. */
  readonly description: string;
  /** Material Icons ligature, e.g. `volume_up`. */
  readonly icon: string;
  readonly source: string;
}

export const CLIENT_SCRIPTS: readonly ClientScript[] = [
  {
    id: 'headshot-sound',
    name: 'Headshot Sound On Every Kill',
    description:
      'Plays the headshot ding for any kill, not just headshots. The real one is silenced so a headshot kill still dings once.',
    icon: 'volume_up',
    source: headshotSound,
  },
];

export function findScript(id: string): ClientScript | undefined {
  return CLIENT_SCRIPTS.find((script) => script.id === id);
}
