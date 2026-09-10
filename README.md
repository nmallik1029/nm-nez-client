# NM/NEZ

A Krunker client for Windows, built around one thing: the game should feel exactly as
responsive as your hardware says it is. Everything else here is quality of life on top of
that.

It runs a patched Electron so uncapped FPS doesn't come with the aim freeze, takes raw
mouse deltas so flicks land where you point them, and adds the usual client features
(resource swapper, themes, alt manager, external ranked queue) without anything that would
give you an unfair advantage.

## Getting it running

```bash
npm install
npm start
```

`npm install` pulls the patched Electron build as part of postinstall, which is a 380MB
download the first time and cached afterwards. See [the section on it](#why-a-patched-electron)
if you want to know what you're running.

Settings live under `F1`, in a Client tab inside Krunker's own settings window.

**Unlock frame rate is off by default.** On a stock Electron it makes the game feel worse
than a browser tab, so leave it off until the patched build is in place. Everything else
in here works fine on stock Electron 44.

## What's in it

### Performance

- Unlocked frame rate with no aim freeze, and an exact FPS cap that holds above your
  monitor's refresh rate. Both need the patched build.
- **Raw mouse input.** Pointer lock hands you OS-adjusted deltas by default, which on
  Windows means "Enhance pointer precision" is baked into every movement. That curve
  multiplies fast movement more than slow, so tracking feels right and then a flick sails
  past. This asks for the sensor deltas instead.
- **Scroll frame-pacing fix.** Chromium paces frames to vsync for the length of a wheel
  gesture, which drops an uncapped framerate to your refresh rate until you stop
  scrolling. In-game the wheel is your weapon switch, so that lands mid-fight.
- Full frame rate while alt-tabbed. Chromium halves it otherwise, and you feel the lurch
  coming back.
- Chromium switch layer: ANGLE backend, GPU rasterisation, debloat, all toggleable.
- Ad, tracker and telemetry blocking at the network layer. The URL filter is matched down
  in Chromium's C++ layer, so anything that doesn't match never reaches JavaScript, which
  matters on a map load that fires thousands of requests.
- Optional prop culling for bunny NPCs and Turf Wars clan banners.

### Frame-time HUD (`F10`)

FPS, frame time, and your worst 1% and 0.1% of frames. The lows are the number worth
watching: 300 FPS with regular hitches feels considerably worse than a steady 200, and a
plain FPS counter hides exactly that.

It samples every frame but only repaints four times a second, because a HUD that reflows
text 300 times a second is its own performance problem.

### Matchmaker (`F6`)

Set your filters once in settings (region, mode, map, player count, time left), then one
key scans the live lobby list and drops you into the best match. No browsing.

The scan animation flicks through candidates with their map previews so you can see what
got rejected. That's presentation only; the filtering always considers every lobby.

### External ranked queue

Krunker's own ranked queue dies with the tab holding it. This one is a socket the app
owns, in its own little window, so you can close the game, reload it, or go and do
something else and keep your place in line. It brings itself to the front when you match.

Launch it from the button next to FIND MATCH in Krunker's ranked panel.

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

  Every colour the client draws is a `--nm-*` custom property on `:root`, and a theme is
  loaded last, so overriding a token re-skins everything that uses it without having to
  match a single one of our selectors:

  ```css
  :root {
    --nm-accent: #ff4d6d;      /* selected chips, map tiles, keybind capture */
    --nm-surface: #12121a;     /* settings-tab cards */
    --nm-game-bg: #14100f;     /* alt manager, changelog */
  }
  ```

  The full list is `src/shared/palette.ts`, grouped by surface.
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

## Why a patched Electron

`--disable-frame-rate-limit` is how you uncap the frame rate, and on stock Chromium it
also causes the aim freeze: 50 to 300ms where your shots don't register, always while
you're holding the mouse and moving.

The cause is scheduling. Continuous mouse input runs at `kHighestPriority` on the
renderer's main-thread scheduler, and Chromium's task-queue selector has no cross-priority
anti-starvation, so held input plus the compositor cascade behind it monopolises the main
thread and WebSocket `onmessage` never gets a turn. None of that is reachable from
JavaScript or from a command-line flag, because the priorities are compiled in.

Three patches fix it:

| Patch | What it does |
|---|---|
| `ws-priority` | Drops input from `kHighestPriority` to `kNormalPriority` and caps compositor priority the same way. Counterintuitively this *raises* both FPS and input throughput. |
| `frame-pacing` | Puts back the pending-frame limits that `--disable-frame-rate-limit` throws away, so the compositor stops flooding the main thread with begin-frame tasks. |
| `frame-cap` | Adds a pacing gate in `DidReceiveSwapBuffersAck()`, giving an exact FPS cap that holds above the display refresh rate plus a runtime `win.setFrameCap()` API. |

Worth being clear that the aim *flick* is a completely separate bug with a one-line fix in
the preload (`unadjustedMovement` on pointer lock). Patching the binary does nothing for
it, and it took us an embarrassingly long time to work that out.

### Installing it

The build comes from
[bigjakk/Electron-Websocket-Fix](https://github.com/bigjakk/Electron-Websocket-Fix)
(GPL-3.0), the same binary Krunker Civilian Client ships. `npm install` fetches it. To
reinstall by hand:

```bash
npm run electron:patch
```

It unpacks over `node_modules/electron/dist` and writes `path.txt`, which stops the
electron package pulling a stock binary down on top of it.

Be aware of what this is: a prebuilt, unsigned Chromium from someone else's GitHub
release, running with full local privileges. Upstream publishes no checksums, so
[`scripts/fetch-electron.mjs`](scripts/fetch-electron.mjs) pins the SHA-256 of the build
we actually downloaded and looked at. A mismatch aborts, because a mismatch means the
asset was swapped after we pinned it. After extracting it greps the binary for
`setFrameCap`, a patch symbol that isn't in stock builds, so a quiet fallback to stock
fails loudly instead of turning up weeks later as "aim still freezes".

`electron-builder.yml` points `electronDist` at the same tree. Without that, `npm run
dist` packages a stock Electron from electron-builder's own CDN cache and puts the freeze
back into every installer, while `npm start` stays fine and you have no idea why.

One gotcha from upstream: **don't combine `CustomFrameCap` with
`CustomMaxPendingFrames:count/N` where N is 2 or more.** The frame rates invert.
`computeSwitches()` won't let you: `count/2` is only emitted when no frame cap is set.

## Contributing

```bash
npm run verify
```

Typecheck, lint and tests. All three have to pass.

| Script | What it does |
|---|---|
| `npm run typecheck` | `tsc` across all three projects. Vite strips types without checking them, so this is the only thing actually type-checking anything. |
| `npm run lint` | ESLint, type-aware rules on |
| `npm test` | Vitest (230 tests) |
| `npm run build` | Bundle main and preload into `dist/` |
| `npm start` | Build, then launch |
| `npm run dist` | Verify, build, package a Windows installer |
| `npm run electron:patch` | Force-reinstall the patched Electron |

### Layout

```
src/
  shared/       branding, config contract, IPC channel names, pure logic
  krunker/      every coupling to Krunker's internals, one file
  main/
    platform/   Chromium switch computation, user-agent
    config/     dependency-free atomic config store
    ipc/        origin-checked IPC registry and handlers
    net/        request blocking and real ping
    ranked/     external queue socket and its window
    swapper/    asset index and the swap:// protocol
    accounts.ts encrypted account storage
  preload/
    hud/        frame-time statistics and overlay
    settings/   the in-page settings panel
    accounts/   alt manager UI and the login driver
    matchmaker/ the scan animation
```

### Things to know before you change anything

**All IPC goes through the registry. Never call `ipcMain.handle` directly.**
`contextIsolation` is off on the game view, because hooking page globals ahead of
Krunker's script means sharing the main world. That in turn means page script (including
any userscript you've enabled) can reach the preload and call any channel we register. The
registry throws out calls from a frame that isn't a Krunker origin before the handler body
runs. Lint enforces this.

**Anything Krunker-specific belongs in `src/krunker/constants.ts`.** DOM ids, the
`windows[]` index of the player list, blockable asset ids. These are the things that break
when the game updates, and having them in one file means a break is one file to read
rather than a repo-wide search.

**Keep the logic pure and the wiring thin.** Switch computation, block decisions, swap
resolution, hotkey matching, lobby filtering and frame statistics are all pure functions
with no Electron import, which is why they're testable at all. The Electron-touching layer
is a shell over the top.

**No `innerHTML` in the renderer.** Our overlays share a world with Krunker's script and
render values that have been round-tripped through disk. `textContent` and
`createElement`, always.

**Three tsconfigs, and main has no `DOM` lib.** Partly accuracy, mostly one specific
headache: the DOM lib declares a global `Clipboard` that shadows Electron's, so
`clipboard.readText()` types as `Promise<string>` and `writeImage` looks like it doesn't
exist. Leaving DOM out fixes that and stops main-process code reaching for `window`.

**Every user-visible string comes from
[`src/shared/branding.ts`](src/shared/branding.ts).** Rename there and nowhere else. The
display name has a slash in it, so anything that becomes a path or an installer artifact
uses `fileSafeName` (`NM-NEZ`) instead.

The one exception is the app icon, which is a binary and lives in
[`build/`](build/README.md). Drop an `icon.ico` in there and it covers the exe, the
installer, the shortcuts and the dev window.

### Electron 44 changed the clipboard

`writeImage`/`readImage` are gone, `readText()` returns a promise, and images go through
`clipboard.write([new ClipboardItem({ 'image/png': blob })])`. Both clients we cribbed
from are still on Electron 43 and use the old synchronous calls everywhere, so anything
ported across needs [`src/main/clipboard.ts`](src/main/clipboard.ts).

## Scope

Performance, quality of life, cosmetics. **Nothing that gives you an unfair advantage.**
No aim assistance, no seeing through geometry, no reading game state you're not meant to
have. Not interested in PRs that add any of it.

## Licence

GPL-3.0-or-later, see [LICENSE](LICENSE).

Built on [Krunker Civilian Client](https://github.com/bigjakk/Krunker-Civilian-Client)
(bigjakk), with a look at [Crankshaft](https://github.com/KraXen72/crankshaft) (KraXen72)
and [Glorp](https://github.com/slavcp/glorp) (slavcp) along the way. All GPL-3.0. Any
build you distribute has to ship its source and keep these credits.
