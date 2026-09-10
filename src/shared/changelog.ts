/**
 * Client changelog, shown from the main menu.
 *
 * Kept as data rather than markdown so the renderer needs no parser and the
 * entries can be type-checked. Newest first; the UI does not sort.
 */

export type ChangeKind = 'added' | 'changed' | 'fixed';

export interface ChangelogEntry {
  readonly version: string;
  /** ISO date, rendered as-is so it cannot drift with locale. */
  readonly date: string;
  readonly changes: readonly { readonly kind: ChangeKind; readonly text: string }[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '0.1.7',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'The new section list appeared in the top left corner of the screen, over the menu, instead of inside the settings window.',
      },
      {
        kind: 'changed',
        text: 'Quieter settings rows. Each category is a heading and a rule now rather than a raised box, controls are no longer each in their own outlined card, and rows have more room.',
      },
    ],
  },
  {
    version: '0.1.6',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Update checks run as soon as the client starts instead of eight seconds in, and repeat every twenty minutes so a client left open still hears about a new version.',
      },
      {
        kind: 'fixed',
        text: 'A failed update check now leaves a note in update.log next to your settings, instead of failing silently with nothing to go on.',
      },
    ],
  },
  {
    version: '0.1.5',
    date: '2026-09-10',
    changes: [
      {
        kind: 'added',
        text: 'A list of sections down the left of the settings window. Click one to jump straight to it instead of scrolling for it, and the one you are reading stays highlighted. It works on Krunker’s own tabs too, not just Client.',
      },
    ],
  },
  {
    version: '0.1.4',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Updates install without the setup wizard. Pressing Restart now applies the update and reopens the client on its own.',
      },
    ],
  },
  {
    version: '0.1.3',
    date: '2026-09-10',
    changes: [
      { kind: 'changed', text: 'Splash screen for updates.' },
    ],
  },
  {
    version: '0.1.2',
    date: '2026-09-10',
    changes: [
      { kind: 'changed', text: 'Round app icon.' },
      {
        kind: 'changed',
        text: 'Every colour the client draws now comes from one palette file instead of being spread across nine stylesheets, which is the groundwork for proper theming.',
      },
      { kind: 'fixed', text: 'Releases publish with their patch notes attached rather than as an empty draft.' },
    ],
  },
  {
    version: '0.1.1',
    date: '2026-09-10',
    changes: [
      {
        kind: 'added',
        text: 'In-client updates. The client checks for a new version on launch and asks before downloading anything.',
      },
      {
        kind: 'added',
        text: 'These patch notes, shown once after an update installs.',
      },
      { kind: 'added', text: 'App icon.' },
      { kind: 'added', text: 'Check for updates button in the client settings tab.' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-09-07',
    changes: [
      {
        kind: 'fixed',
        text: 'Aim freeze at uncapped FPS. Runs a patched Electron whose scheduler no longer lets held mouse input starve WebSocket dispatch.',
      },
      {
        kind: 'fixed',
        text: 'Aim flicking. Pointer lock now requests unadjusted movement, so Windows pointer acceleration no longer skews fast flicks.',
      },
      {
        kind: 'added',
        text: "Alt manager. Saved accounts, passwords encrypted for your Windows user, signed in through Krunker's own login form.",
      },
      {
        kind: 'added',
        text: 'External ranked queuer in its own window, so queueing survives the game window closing.',
      },
      { kind: 'added', text: 'Matchmaker (F6): scans live lobbies and joins the best match for your filters.' },
      { kind: 'added', text: "Real ping: a measured round-trip to the match server, in the game's own HUD slot." },
      { kind: 'added', text: 'Frame-time HUD (F10) with 1% and 0.1% lows.' },
      { kind: 'added', text: "Client settings inside Krunker's own settings window, with rebindable hotkeys." },
      { kind: 'added', text: 'Resource swapper, CSS themes and userscripts, all loaded from the swap folder.' },
      { kind: 'added', text: "Merged team and match chat, with history retained past Krunker's own limit." },
      { kind: 'added', text: 'Menu promo hiding: battle pass, daily spin, Twitch drops and the corner ad slots.' },
      { kind: 'added', text: 'Network-level ad, tracker and telemetry blocking.' },
      { kind: 'added', text: 'Client name and version under the in-game round timer.' },
      { kind: 'changed', text: 'Loadout and Customize share one row, with the alt manager beneath them.' },
      { kind: 'changed', text: 'Opens in borderless fullscreen.' },
    ],
  },
];
