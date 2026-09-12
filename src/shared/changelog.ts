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
    version: '0.1.43',
    date: '2026-09-12',
    changes: [
      {
        kind: 'fixed',
        text: 'Opening settings while queued no longer puts the settings window behind the queue readout. The readout was sitting on a layer above anything the game opens; it now sits above the HUD but below Krunker’s own windows.',
      },
    ],
  },
  {
    version: '0.1.42',
    date: '2026-09-12',
    changes: [
      {
        kind: 'fixed',
        text: 'A tournament link only hosted if the client was already open. Clicking one with the client closed started it and then did nothing, which is the way most people will click one. Two things were wrong: the link was handed over at the moment the page finished loading, and the check for whether the page was ready asked a question that is never true on Krunker, so it was dropped every time. Past that, the host window was being opened while the game was still loading, which draws it with an empty map list that never fills in, so the lobby went up on whatever map happened to be ticked. It now waits for the game to actually be up first.',
      },
      {
        kind: 'changed',
        text: 'Your browser now asks to open "NM/NZ Client" rather than "Performance-focused Krunker client for Windows", which is what it had been reading off the exe.',
      },
    ],
  },
  {
    version: '0.1.41',
    date: '2026-09-12',
    changes: [
      {
        kind: 'fixed',
        text: 'Clicking the userscript box to pick a file works again. It refused every file with "Userscripts have to be .js files", including .js ones, because the panel cleared the file input before reading what you had picked — so it was answering about an empty list. Dragging a file on was never affected.',
      },
    ],
  },
  {
    version: '0.1.40',
    date: '2026-09-12',
    changes: [
      {
        kind: 'added',
        text: 'QoL Features, at the bottom of the left menu. Two tabs: Userscripts, where your own .js files go, and Built-in, where the extras that ship with the client live. Drop a script straight onto the panel instead of going and finding the folder, switch any of them off without deleting it, or delete it with two clicks. Scripts run when the page loads and one that has already run cannot be un-run, so adding, removing or switching one lands on the next reload, and the panel says so and gives you the button.',
      },
      {
        kind: 'added',
        text: 'Tournament links. The client answers to nmnez:// links now, so a bot can post a button that brings the client up and puts the match lobby on: the comp server setup opens with the map, both team names, both rosters, the team size and any class limits already filled in, and the room is created. The result webhook is a field Krunker already has, so the game posts the final scoreboard straight to the bot. Your browser asks before handing a link to the client, and a link it does not recognise does nothing at all.',
      },
      {
        kind: 'changed',
        text: 'The Scripts button in the top bar is gone. Everything it opened is the Built-in tab of QoL Features now, and one panel with a tab for each kind of script beats two doors onto the same switches.',
      },
      {
        kind: 'fixed',
        text: 'A config file saved with a byte-order mark, which is what PowerShell and a few Windows editors write, read as corrupt: the client started on defaults and then wrote them back, so editing config.json by hand could cost you every setting in it. Found the hard way, on a real config.',
      },
    ],
  },
  {
    version: '0.1.39',
    date: '2026-09-11',
    changes: [
      {
        kind: 'added',
        text: 'A setup walkthrough on your first launch after installing. Three questions: whether you want the NM/NZ look or the game exactly as it ships, which of the built-in scripts to switch on, and whether to load a stylesheet of your own. The look question shows you a screenshot of each, and picking one changes the menu behind the panel straight away so you can see what you are choosing. Every answer is a setting you can change later, and there is a Run walkthrough button in Settings if you want it again.',
      },
      {
        kind: 'changed',
        text: 'Finding a match is a loading bar now. It used to flick through every lobby it had rejected, map preview and all, which took about three and a half seconds and looked busier than it was. Title, bar, and a line telling you which region you are joining or what went wrong.',
      },
      {
        kind: 'changed',
        text: 'Custom CSS is off while Menu style is set to NM/NZ. That already styles the menu, the windows it opens and the in-game HUD, and a theme loads after all of it, so the two were fighting over anything they both touched. The picker says so and tells you which switch to flip; set Menu style to Krunker (original) and it comes back.',
      },
      {
        kind: 'fixed',
        text: 'The settings window no longer flashes the wrong layout for a moment every time you change tab. It was drawing the panel before the section list down the left had been worked out, then correcting itself about 50ms later.',
      },
    ],
  },
  {
    version: '0.1.38',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The menu has its colour back. The five buttons along the bottom are five colours again, the way Krunker draws them, and the menu list down the left is white rather than grey. The counts along the top keep the game’s own coding too (gold KR, a purple pickaxe, a green trophy) instead of every one of them the same grey.',
      },
      {
        kind: 'changed',
        text: 'Text through the menu and the settings window is back at the size Krunker sets it. The skin had been shrinking labels by about a third and spacing the letters out, which made the whole thing read as a different and more modern piece of software: Click to Play was a third the size the game draws it at. Nothing has moved, everything is just the size it should have been.',
      },
      {
        kind: 'changed',
        text: 'Rounded corners and thicker edges on the buttons, matching what Krunker puts on its own. Loadout, Customize and Alt Manager get a colour each to go with them.',
      },
      {
        kind: 'fixed',
        text: 'Clicking Invite no longer nudges Join sideways. The button grows to fit “Copied URL” and the space set aside for it was too narrow.',
      },
    ],
  },
  {
    version: '0.1.37',
    date: '2026-09-10',
    changes: [
      { kind: 'added', text: 'YBG_Wallace now shows in their own colour on the leaderboard and player list.' },
    ],
  },
  {
    version: '0.1.36',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'The menu code no longer costs you frame time during a match. Five components reacted to every DOM change Krunker made (every killfeed line, chat message and ammo tick), and one of them measured element positions each time, which forces the browser to stop and re-layout the page. They now do their work once per frame instead, which is all any of them needed.',
      },
      {
        kind: 'fixed',
        text: 'Hidden props are actually hidden. Blocked models were redirected in a way Chromium refuses, so the request failed and logged an error instead of loading nothing. Turf War banners in particular were never being blocked.',
      },
    ],
  },
  {
    version: '0.1.35',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The ranked queue is in the page now instead of a separate window. QUEUE replaces Find Match, and the panel it opens keeps the timer, the regions and the start/stop in one place. Shift-click the button if you still want the old window, which is the one to use when you are queueing with the game shut.',
      },
      {
        kind: 'changed',
        text: 'Closing the panel no longer stops the queue. It carries on through a reload, a server change and closing the window, because it runs outside the page. A small readout shows the time elapsed while the panel is shut, under Click to Play on the menu and under the counters in a match.',
      },
      {
        kind: 'added',
        text: 'A sound when the queue finds you a game. Drop your own at swap/sounds/match-found.mp3 to replace it.',
      },
      {
        kind: 'changed',
        text: 'The panel blinks while it is searching, and the regions lock once you are in the queue, since you only ever queue into the ones you started with.',
      },
    ],
  },
  {
    version: '0.1.34',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The client is called NM/NZ now. Same client, shorter name: it is in the window title, the menu wordmark, the in-game watermark and the installer. Your settings, themes, swapped files and Krunker login all carry over untouched.',
      },
      {
        kind: 'changed',
        text: 'New accent colour through the menu, and the Ranked button sits quieter against it.',
      },
    ],
  },
  {
    version: '0.1.33',
    date: '2026-09-10',
    changes: [
      {
        kind: 'added',
        text: 'Hardpoint enemy counter: how many of them are standing on the point, beside the other counters top right. Nothing in the game reports that, so it is worked out from how fast their score is climbing: Hardpoint pays 10 a second for each player on the point. Hardpoint only, and there is a switch for it in Settings under Interface.',
      },
      {
        kind: 'added',
        text: 'Friends and clans can have their own colours on the leaderboard and the player list. Names go in src/shared/highlights.ts with a colour each and an optional bold; clans go in by tag. A friend keeps their own colour and their clan tag keeps the clan’s, so someone who is both shows both.',
      },
    ],
  },
  {
    version: '0.1.32',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'The NM/NZ look no longer switches itself off in a comp lobby. Every HUD rule was excluding Krunker’s comp menu state along with its main menu, so hosting or joining a comp game dropped the theme until the round started. It now covers a match, the comp lobby, spectate and the end screen, everything but the main menu.',
      },
    ],
  },
  {
    version: '0.1.31',
    date: '2026-09-10',
    changes: [
      {
        kind: 'added',
        text: 'A Scripts button in the top bar, next to Settings. It opens an empty window for now. Quality-of-life and fun scripts go in there as they are written.',
      },
      {
        kind: 'changed',
        text: 'Alt Manager moved back under Loadout and Customize to make room for it. Same one click, just on the class card instead of the top bar.',
      },
    ],
  },
  {
    version: '0.1.30',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'The character preview on the menu no longer sits over the middle of its own card. It moves right, so the weapon points out across empty space instead of the whole model reading as shifted left. NM/NZ menu style only.',
      },
    ],
  },
  {
    version: '0.1.29',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Picking NM/NZ for Menu style now restyles the in-game HUD to match: no panels behind the ammo, timer, leaderboard or player block, your FPS and ping as bare figures, and a flatter chat box. It is one look rather than two switches, and it only applies in a match. The menu is untouched by it.',
      },
    ],
  },
  {
    version: '0.1.28',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'Alt Manager is back in the top bar when you are signed in. It was being put inside the signed-out bar, which Krunker leaves in the page and hides, so the button went and hid with it.',
      },
      {
        kind: 'fixed',
        text: 'Chat is no longer stuck behind the play buttons on the menu. It sits above them, and it shrinks to fit rather than climbing up into the menu list, which is what it did if you had the UI scale turned up.',
      },
      {
        kind: 'changed',
        text: 'The menu no longer dims the top, left and bottom of the screen. The map behind it is just the map.',
      },
      {
        kind: 'changed',
        text: 'On the NM/NZ menu style, chat is dressed like the rest of it: one flat panel, hairline border, square corners. Message colours are untouched, so you can still tell team from all.',
      },
      {
        kind: 'changed',
        text: 'The map name and Invite/Join sit lower, clear of chat.',
      },
      {
        kind: 'changed',
        text: 'The accent colour is cyan instead of orange. It is one value, so the Ranked button, the toggles, the settings tabs and the slash in NM/NZ all moved together.',
      },
    ],
  },
  {
    version: '0.1.27',
    date: '2026-09-10',
    changes: [
      {
        kind: 'added',
        text: 'Menu style, in Settings under Themes: Krunker (original) or NM/NZ. Original is what a fresh install gets: the game’s own look is what you came for, and it is not this client’s place to rearrange it before you have asked.',
      },
      {
        kind: 'changed',
        text: 'The menu restyle moved out of Interface and into Themes as that choice, so how the client looks is one question in one place. If you already had it on, it stays on.',
      },
    ],
  },
  {
    version: '0.1.26',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'The settings index keeps up with the tab you are on. Switching to the Client tab left the previous tab’s sections listed down the side, and every section on that tab showing at once.',
      },
      {
        kind: 'fixed',
        text: 'The index appears with the tab instead of a moment after it, and no longer sometimes fails to appear at all.',
      },
    ],
  },
  {
    version: '0.1.24',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'The client is set in Krunker’s own font throughout. The menu labels, the settings rows and the performance readout were all in a second typeface, which made the whole thing look like two programs stapled together.',
      },
    ],
  },
  {
    version: '0.1.23',
    date: '2026-09-10',
    changes: [
      {
        kind: 'fixed',
        text: 'Invite really is the same distance from the divider as Join now. 0.1.22 claimed to even them up and did not.',
      },
    ],
  },
  {
    version: '0.1.22',
    date: '2026-09-10',
    changes: [
      {
        kind: 'changed',
        text: 'Invite and Join sit on the same line as the mode and map, to their right, instead of orphaned underneath. They are set a size larger and spaced evenly either side of the divider between them.',
      },
      {
        kind: 'fixed',
        text: 'Invite and Join no longer look switched off. They rested two thirds of the way to the background, so letting go of one right after clicking it read as the button greying out.',
      },
      {
        kind: 'fixed',
        text: 'The Advanced switch in the settings header is no longer Krunker blue.',
      },
      {
        kind: 'fixed',
        text: 'The section index no longer sits on top of the changelog listing settings sections that are not there.',
      },
    ],
  },
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
        text: 'The settings window is as tall as whatever section you are on, instead of a fixed height with a screenful of nothing under it, and it stays centred on screen.',
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
        text: 'NM/NZ and the version sit at the top of the left menu.',
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
