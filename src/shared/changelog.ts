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
    version: '0.1.13',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The bottom of the menu is now one bar across the full width: the match you are in and your region, FPS and ping on one line, a rule under it, and the five play buttons spread evenly beneath. Your class card sits above it rather than overlapping.',
      },
      {
        kind: 'added',
        text: 'NM/NEZ and the version sit at the top of the left menu.',
      },
      {
        kind: 'changed',
        text: 'Alt Manager has moved to the top left, beside Login or Register, so the client’s own buttons are together.',
      },
      {
        kind: 'changed',
        text: 'Login or Register is drawn as a button, and the flat black strip behind the top bar is gone so the menu’s own shading shows through.',
      },
    ],
  },
  {
    version: '0.1.12',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'The main menu works again. In 0.1.11 the map behind it stayed black, Click to Play did nothing and several buttons were dead. Hiding the game’s own promos was taking them out of the page entirely, which broke Krunker’s menu setup partway through. They are hidden now instead, and everything wires up as it should.',
      },
    ],
  },
  {
    version: '0.1.11',
    date: '2026-09-10',
    changes: [
      {
        kind: 'added',
        text: 'The main menu has been restyled. One accent colour instead of five, so Quick Match is obviously the button you press. The screen is grounded, so labels no longer need a heavy outline to be readable over the map. Your FPS and ping are set as numbers with units instead of buried in the text beside them.',
      },
      {
        kind: 'changed',
        text: 'Alt Manager has moved up to the header, beside Settings and More Krunker.',
      },
      {
        kind: 'changed',
        text: 'The class card shows your weapon first and the class under it, and the Get Signup Rewards button is gone.',
      },
      {
        kind: 'added',
        text: 'Restyle the main menu is a toggle in Settings under Interface, on by default. Turning it off gives you Krunker’s own menu back with no reload.',
      },
    ],
  },
  {
    version: '0.1.10',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Krunker’s Default / Pro / Performance / Custom preset boxes are gone from the top of the settings. The same four are still in the dropdown in the header if you want them.',
      },
      {
        kind: 'fixed',
        text: 'The section list stays put while the settings scroll. It held for a couple of hundred pixels and then rode away with everything else.',
      },
      {
        kind: 'fixed',
        text: 'The quieter row styling now applies to Krunker’s own tabs, not just the Client tab. It had never reached them.',
      },
      {
        kind: 'fixed',
        text: 'Section names no longer pick up the “* requires restart” note from the heading they belong to.',
      },
    ],
  },
  {
    version: '0.1.9',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Krunker’s Default / Pro / Performance / Custom preset tiles are hidden. They sat above every tab and overwrote all your settings in one click.',
      },
      {
        kind: 'fixed',
        text: 'The section list stays put while the settings scroll. It was still riding down the page.',
      },
      {
        kind: 'fixed',
        text: 'Section names in the list match the sections. Some picked up the text of a dropdown sitting in the heading, and long names were cut off mid-word.',
      },
      {
        kind: 'changed',
        text: 'Settings rows are set a size smaller, so more fits on screen.',
      },
    ],
  },
  {
    version: '0.1.8',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'The section list scrolled away with the settings instead of staying put beside them.',
      },
      {
        kind: 'fixed',
        text: 'Jumping to one of the last sections no longer leaves an earlier one highlighted.',
      },
      {
        kind: 'changed',
        text: 'Settings rows are separated by a thin line instead of alternating shading, which was drawn in the wrong grey for the game’s panel.',
      },
    ],
  },
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
