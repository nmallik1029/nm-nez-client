# NM/NZ

Krunker client FOR WINDOWS made by competitive players, there are tons of very good, capable clients (Glorp, Crankshaft, KCC, etc) but, for us atleast, they don't work 100% of the time and sometimes have weird bugs that take a little long to resolve. Like KCC (and maybe Glorp idk) NM/NZ uses a patched build of electron that eliminates mouse flicks and keeps FPS high and smooth. Older electron builds had weird frametime bugs, so many electron-based apps across games in general are using patched builds like this one. We are not professionals so keep that in mind when downloading the client or using any software :3

## What's in it

### Performance

The client uses several fixes and settings modifications to stabilize FPS and make the game overall smoother to play.
- In a lot of clients (and official at some point) the FPS cap just straight up doesn't work. In our testing, NM/NZ client's FPS cap works fully with no aim freezes or anything.
- Proper raw mouse input
- Chromium switch layer: ANGLE backend, GPU rasterisation, debloat, which are all toggleable if it doesn't work for you. <- These are EXPERIMENTAL!!
- Optional prop culling for bunny NPCs and Turf Wars clan banners (basically you can hide them and it'll be like they don't exist, not that they're hidden because it increases performance a bit on specific machines)

### Frame-time HUD (`F10`)

This is pretty useless but if you want a more specific, tuned FPS and ping meter for your game you can use this. 

### Matchmaker (`F6`)

Set your filters once in settings (region, mode, map, player count, time left), then one
key scans the live lobby list and drops you into the best match.

### External ranked queue

Like basically everybody knows, clients like Glorp basically revolutionized queueing ranked with an External Ranked Queue. This isn't necessarily a bad thing but another window on my screen when I alt+tab was really annoying. So queuing for ranked is in basically the same layout as the normal ranked menu, but persists throughout lobby hopping, refreshing, etc. Closing the client will remove you from queue. 

### Tournament links (`nmnez://`)

This was one of the main reasons we made this client. KCC is a very useful, feature-rich client but unfortunately it simply does not have this (atleast rn). As the owners of CKL, where we host pugs daily, we need a way to use a custom URL scheme to host through a link with the Krunker webhook in order to receive data, push automation, etc. 

### QoL Features

A row at the bottom of Krunker's left menu, with your own userscripts on one tab and the
client's own features on the other. Three of those open an editor.

**Crosshair.** Build one out of a shape, a length, a thickness, a gap, a dot, an outline
and a colour, or drop in a PNG and use that. The preview sits on one of Krunker's own wall
textures, because a thin dark crosshair that looks fine on a panel disappears on brick.

The image half is the point. Krunker takes a custom crosshair as a URL, and a URL from
Discord stops resolving when the CDN expires it, so people lose their crosshair mid-match
with nothing to explain it. What you drop here is read off your disk once and stored as its
own bytes; nothing is ever fetched again, so there is nothing left to go missing.

It is drawn by the client rather than handed to the game, because Krunker's crosshair is
drawn in the canvas: the `<img>` in the page that looks like one has been dead for a while.
So the client decides when it is on screen, and hides it in the menu, while a window is
open, and while you are scoped. The game's own crosshair is still drawn underneath, so the
editor has a switch for that as well; it presses Krunker's own setting, and puts it back.

**Hitmarker.** The same, plus the two things a hitmarker wants: drag it off centre, and
pull its corner to resize. It appears on the frame Krunker plays the sound it plays for a
landed shot, so it is not a guess about when you hit someone, it is the game saying so.

**Sky colour.** One colour in place of every map's own sky. Krunker builds the sky when a
map loads, so this lands on the next map rather than the one you are standing in, and the
editor says so and offers the reload. Fog, lighting and shadows are left exactly as the map
made them.

### Alt manager

Saved accounts under the Loadout row in the main menu. Add one with `+`, click it to
switch. You don't need to be signed in to save an account.

Passwords are encrypted with Windows DPAPI, keyed to your Windows user, so another account
on the same machine can't read them even holding the file. If DPAPI isn't available the
manager hides its save button rather than writing your password somewhere readable.

One thing to know: Krunker only allows one sign-in per page load. If you're already signed
in, or you've signed in and out once this session, the manager will tell you up front
instead of failing with a confusing error. Restart the client to switch again.

### Customisation

- **Resource swapper.** Drop files in `swap/` to replace textures, sounds and models.
  Either an exact path (`swap/textures/wall.png`) or a bare filename that matches any
  asset with that name.
- **CSS themes.** Any `.css` in `swap/themes/`. Edit one in a text editor and it lands in
  the game when you save; the folder is watched.

  Everything the client's look is made of (colour, type, spacing, radius, border
  weight, motion, stacking order) is a `--nm-*` custom property on `:root`, and a theme
  is loaded last, so overriding a token re-skins everything that uses it without having
  to match a single one of our selectors:

  ```css
  :root {
    --nm-accent: #ff4d6d;   /* selected chips, map tiles, keybind capture */
    --nm-surface: #12121a;  /* settings-tab cards */
    --nm-radius: 0;         /* square corners everywhere */
    --nm-fs-md: 15px;       /* the workhorse size: rows, buttons, tooltips */
  }
  ```

  The full list is `src/shared/ui/tokens.ts`, grouped by surface.

  **Designing against the running client.** `npm run tokens:dev` writes every token to
  `swap/themes/dev-tokens.css` at its current value. Select it in the settings tab, then
  edit it beside the game: each save lands immediately, so the whole look can be worked
  out live rather than through a rebuild. Paste what you keep back into `tokens.ts`.
  (The standalone queue window is a separate document with no theme loader, so its
  `--nm-rq-*` group is reference only.)
- **Match sound.** Drop an mp3 at `swap/sounds/match-found.mp3` and the ranked queue
  plays it when it finds you a game. No file, no sound. It is read once at
  startup, so a new file needs a reload (F5).

- **Userscripts.** Any `.js` in `swap/scripts/`. Off by default, and worth keeping that
  way unless you wrote them.

Buttons in the settings tab open the swap, themes and scripts folders.

(`swap/backgrounds/` exists and the swapper leaves it alone, but nothing reads it yet.
Custom loading backgrounds aren't implemented.)

### Everything else

- Real ping: a measured TCP round-trip to the match server you're actually on, drawn in
  Krunker's own HUD slot instead of its estimate.
- Merged team and all chat, with `[T]`/`[M]` tags and history that survives Krunker's
  pruning. Tab switches which channel you're sending to while the chat box has focus.
- Rank icons on the top-right leaderboard in ranked, beside each name like FACEIT's old
  one. They're the icons Krunker already draws on its Tab scoreboard, copied across.
- Menu promo hiding: battle pass, daily spin, Twitch drops, the corner ad slots.
- Escape releases the cursor, which Krunker otherwise swallows.
- Client name and version under the in-game round timer, and a changelog in the left menu.
- Window position and size persist. The renderer reloads itself if it crashes.
- External links open in your real browser, and the game window refuses to navigate off
  Krunker.

### Hotkeys

| Key | Action |
|---|---|
| `F1` | Client settings |
| `F5` | Reload |
| `F6` | Find match |
| `F9` | Screenshot to clipboard |
| `F10` | Frame-time HUD |
| `F11` | Fullscreen |
| `F12` | DevTools |
| `Ctrl+L` | Copy game link |
| `Ctrl+J` | Join from clipboard |

All rebindable in the settings tab.
