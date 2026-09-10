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
    version: '0.1.21',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The settings index now shows one section at a time instead of scrolling to it. Pick a section and only that section is on screen. Nothing jumps, nothing slides, and there is nowhere to get lost.',
      },
      {
        kind: 'fixed',
        text: 'The index no longer drifts down the page while you scroll, and it is clickable again.',
      },
      {
        kind: 'fixed',
        text: 'The empty gap under the first heading is gone. It was as tall as the index, because the index was a float and Krunker clears every settings row past one.',
      },
      {
        kind: 'fixed',
        text: 'Sections that do not apply to you, like KPD and Developer, no longer appear in the index or under the section above them.',
      },
      {
        kind: 'fixed',
        text: 'Manage Ads is really gone this time, and the dead black strip down the right of the window with it.',
      },
      {
        kind: 'fixed',
        text: 'The settings window is as tall as whatever section you are on, instead of a fixed height with a screenful of nothing under it. It grows downward from the same place, so nothing shifts as you move between sections.',
      },
    ],
  },
  {
    version: '0.1.20',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'Clicking a section in the settings index no longer scrolls the whole game off the top of the window. 0.1.18 handed the job to the browser, which moved every scrollable thing on the page rather than just the settings.',
      },
      {
        kind: 'changed',
        text: 'The login, loadout, customize and popup windows are skinned now, not just the settings. They are found by their shape rather than by name, so the ones nobody has listed get caught too.',
      },
      {
        kind: 'fixed',
        text: 'Clicking a section in the settings index lands on that section. It had been stopping short by a fraction of however far it travelled, because Krunker scales its whole interface and the jump was measuring in one unit and scrolling in another.',
      },
      {
        kind: 'fixed',
        text: 'Invite no longer resizes when you click it. Its label becomes “Copied URL” and back, which is wider than “Invite”, so the row moved twice each time.',
      },
    ],
  },
  {
    version: '0.1.19',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Manage Ads is gone from the settings header, and the Advanced switch no longer keeps Krunker’s blue.',
      },
      {
        kind: 'fixed',
        text: 'Import, Export and Reset are the same height as the preset dropdown beside them instead of a size smaller.',
      },
      {
        kind: 'changed',
        text: 'The section index down the left of the settings is drawn in the skin’s own colours, with the accent marking where you are.',
      },
    ],
  },
  {
    version: '0.1.18',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'Clicking a section in the settings index takes you to that section. It was working out where to scroll to by hand and getting it wrong; the browser does that part now.',
      },
      {
        kind: 'fixed',
        text: 'Invite and Join no longer shrink when you click them.',
      },
    ],
  },
  {
    version: '0.1.17',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Krunker’s own windows now match the menu. Settings, login, loadout, customize and the popups all get the same palette, the same one accent, hairlines instead of heavy borders, and dark inputs instead of white boxes.',
      },
      {
        kind: 'changed',
        text: 'The menu is set in Consolas.',
      },
    ],
  },
  {
    version: '0.1.16',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The top right is just labels now. Notifications is gone, Settings and More Krunker have lost their icons, and hovering one lights the word rather than drawing a box around it.',
      },
      {
        kind: 'changed',
        text: 'The Summer Finale spin badge no longer hangs off Store.',
      },
      {
        kind: 'fixed',
        text: 'The menu items down the left are evenly spaced. Krunker grouped them with dividers, which is what made some gaps twice the size of others.',
      },
      {
        kind: 'fixed',
        text: 'Login or Register and Alt Manager sit the same distance from the divider between them.',
      },
    ],
  },
  {
    version: '0.1.15',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'Contact and Terms really are gone from the bottom right now, and Changelog really has moved up beside More Krunker. 0.1.14 claimed to do this and did nothing.',
      },
      {
        kind: 'changed',
        text: 'The menu items down the left are set larger, and the odd extra gap between two of them is gone.',
      },
      {
        kind: 'changed',
        text: 'Login or Register has lost its icon, and it and Alt Manager are now exactly the same size.',
      },
    ],
  },
  {
    version: '0.1.14',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The bottom bar sits on the floor of the window now. Contact and Terms are gone from the bottom right, and Changelog has moved up beside More Krunker, which is what was holding the bar off the bottom.',
      },
      {
        kind: 'fixed',
        text: 'Menu items no longer shift sideways when you hover them. The row lights up instead, and the red mark on its left grows into an arrow.',
      },
      {
        kind: 'changed',
        text: 'Alt Manager is drawn as the same button as Login or Register, and More Krunker has lost its globe icon.',
      },
    ],
  },
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
