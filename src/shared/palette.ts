/**
 * Every colour the client draws, in one place.
 *
 * This is emitted as a `:root` custom-property block and injected ahead of
 * every other client stylesheet, so each surface says `var(--nm-accent)`
 * rather than carrying its own copy of a hex. Before this existed the same
 * accent blue was written as three different literals in three files and
 * changing the client's look meant a grep across nine of them.
 *
 * Two rules keep it that way:
 *
 *  - No colour literal anywhere else. `palette.test.ts` fails the build if one
 *    turns up in a stylesheet outside this file, and fails on a `var(--nm-*)`
 *    that no token defines, which is otherwise a silent no-op at runtime.
 *  - Tokens are colours, not composites. Shadow and outline *geometry* stays
 *    with the rule that uses it, because `0 3px 10px` reads as nothing here
 *    and as something obvious next to the element it lifts.
 *
 * Themes ride on this. A `.css` in `swap/themes/` is appended last in
 * `document.head` (see `preload/themes.ts`), so it out-cascades this block on
 * equal specificity and a ten-line file re-skins the whole client:
 *
 *     :root { --nm-accent: #ff4d6d; --nm-surface: #12121a; }
 *
 * Lives in `shared/` rather than `preload/` because the standalone ranked
 * queue window is its own document built in the main process, and one palette
 * that both windows read is the entire point.
 */

/**
 * Client chrome: the settings tab, toast, tooltip and frame-time HUD.
 *
 * Cooler and flatter than the game skin below. These surfaces sit *over*
 * Krunker rather than inside its own panels, so they read as ours.
 */
const CLIENT = `
  --nm-surface:#1b1d22;
  --nm-surface-sunken:#111;
  --nm-border:#2f323a;
  --nm-border-hover:#414652;
  --nm-text-hi:#fff;
  --nm-text:#e8e9ec;
  --nm-text-mid:#d6d9de;
  --nm-text-body:#c3c7ce;
  --nm-text-dim:#9aa0aa;
`;

/**
 * The client accent. Four steps of one blue: the pure hue for focus rings and
 * checkboxes, a border, and two fills for selected chips and map tiles.
 */
const ACCENT = `
  --nm-accent:#6d8cff;
  --nm-accent-border:#5570c8;
  --nm-accent-bg:#31417d;
  --nm-accent-bg-soft:#26314f;
`;

/**
 * Status colours for the client chrome.
 *
 * `restart` and `reload` are the two asterisk colours in the settings tab, and
 * they follow Krunker's own convention of flagging a setting in red. Keeping
 * them named for what they mean rather than what they are is what stops the
 * next person from "tidying" the red one into `--nm-danger`, which is a
 * different thing: danger is destructive, restart is merely pending.
 */
const STATUS = `
  --nm-restart:#e05a5a;
  --nm-reload:#4d90e0;
  --nm-danger:#c0504d;
  --nm-danger-hover:#e06663;
  --nm-danger-soft:#e79a9a;
  --nm-danger-border:#a35555;
  --nm-warn:#d7902f;
  --nm-warn-hover:#f0a840;
`;

/**
 * Popovers: the toast and the hover tooltip.
 *
 * Same family, kept as two tokens because the toast is translucent over the
 * game and the tooltip is not. Collapsing them is a deliberate call, not a
 * tidy-up.
 */
const POPOVER = `
  --nm-popover-bg:#0d0e11;
  --nm-popover-border:#33363f;
  --nm-popover-text:#dfe1e6;
  --nm-toast-bg:rgba(12,13,16,.9);
  --nm-toast-border:#2b2e36;
  --nm-hud-bg:rgba(10,11,13,.72);
`;

/**
 * Game skin: the alt manager, the changelog panel and the menu buttons.
 *
 * Warmer greys, hard 2px borders, no radius. These are full panels that open
 * over Krunker's menu and are meant to be mistaken for the game's own, which
 * is why they do not share the client tokens above.
 */
const GAME = `
  --nm-game-bg:#1e1e1e;
  --nm-game-bg-head:#171717;
  --nm-game-border:#3a3a3a;
  --nm-game-scrim:rgba(0,0,0,.72);
  --nm-game-text:#fff;
  --nm-game-text-body:#c8c8c8;
  --nm-game-text-dim:#8b8b8b;
  --nm-game-text-faint:#7a7a7a;
  --nm-game-text-fainter:#6a6a6a;
  --nm-game-row-bg:#262626;
  --nm-game-row-hover:#242424;
  --nm-game-rule:#2e2e2e;
  --nm-game-input-bg:#141414;
  --nm-game-input-focus:#5a5a5a;
  --nm-game-btn-bg:#2f2f2f;
  --nm-game-btn-bg-hover:#3b3b3b;
  --nm-game-btn-border:#4a4a4a;
  --nm-game-btn-text:#ddd;
`;

/**
 * Status colours inside the game skin: a muted sage for go/added/active and a
 * muted clay for delete/blocked. Desaturated on purpose — a saturated green
 * button next to Krunker's own menu looks like a web page.
 */
const GAME_STATUS = `
  --nm-ok:#a9c4a6;
  --nm-ok-border:#7d9d7a;
  --nm-ok-bg:#232922;
  --nm-ok-bg-hover:#2c3a2b;
  --nm-ok-text-hi:#d6e6d4;
  --nm-bad-border:#6d4b47;
  --nm-bad-text:#c98b84;
  --nm-bad-text-hi:#e8bab4;
  --nm-bad-bg:#3a2a28;
  --nm-caution-bg:#2a2320;
  --nm-caution-text:#d8a9a3;
  --nm-tag-fixed:#c9b184;
  --nm-tag-changed:#96a8bd;
`;

/**
 * The `[T]`/`[M]` prefixes on merged chat. Green for team, red for match, which
 * is the association Krunker's own name colours already set up.
 */
const CHAT = `
  --nm-chat-team:#4ade80;
  --nm-chat-all:#f87171;
`;

/**
 * The in-HUD watermark, which copies what Krunker does to `#matchInfo`: white
 * text on a hard four-way outline, because it sits straight on the map.
 */
const WATERMARK = `
  --nm-watermark-text:#fff;
  --nm-watermark-outline:#202020;
`;

/** The queue launcher wedged into Krunker's own ranked footer. */
const QUEUE_BUTTON = `
  --nm-queue-bg:#1f7a3d;
  --nm-queue-bg-hover:#2a9a4f;
  --nm-queue-border:#38c463;
  --nm-queue-icon:#eafff1;
`;

/**
 * The update prompt.
 *
 * Only the buttons live here. The panel chrome reuses the `--nm-game-*`
 * group, because it is meant to read as the same surface as the changelog it
 * opens alongside, and a second set of near-identical greys would be two
 * things to keep in step instead of one.
 */
const UPDATE = `
  --nm-upd-btn-bg:#2a2a2a;
  --nm-upd-btn-border:#3f3f3f;
  --nm-upd-btn-bg-hover:#343434;
  --nm-upd-go-bg:#2f6b3f;
  --nm-upd-go-border:#3f8a52;
  --nm-upd-go-bg-hover:#38804b;
`;

/**
 * The match-scan overlay.
 *
 * Its own group because the greens here are a deliberate ladder rather than
 * one colour: a line brightens to `accept-peak` as it lands and settles on
 * `accept`, and the flood that covers the screen is a third step. Folding them
 * into one token would flatten the animation.
 */
const SCAN = `
  --nm-scan-text:#fff;
  --nm-scan-note:rgba(255,255,255,.66);
  --nm-scan-reject:#e06060;
  --nm-scan-reject-end:#8c3030;
  --nm-scan-accept:#4ade80;
  --nm-scan-accept-peak:#6ef29a;
  --nm-scan-flood:#3ddc7f;
  --nm-scan-glow:rgba(74,222,128,.55);
  --nm-scan-glow-thumb:rgba(74,222,128,.6);
  --nm-scan-glow-peak:rgba(110,242,154,.75);
  --nm-scan-thumb-bg:rgba(0,0,0,.45);
`;

/**
 * What the game window paints before Krunker's first frame arrives. Black, so
 * the gap between the window appearing and the page drawing isn't a flash.
 */
export const GAME_WINDOW_BACKGROUND = '#000000';

/**
 * The queue window's backdrop, as a plain string as well as a token.
 *
 * Electron wants a colour for `BrowserWindow.backgroundColor` before any
 * document exists, so that one value has to be readable from JS. Exported
 * here and interpolated into the token below, rather than written twice.
 */
export const QUEUE_WINDOW_BACKGROUND = '#0a0b0d';

/**
 * The standalone ranked queue window, which is a separate document with a
 * deliberately quieter palette: it is a small always-on-top panel you leave
 * running with the game closed, not something layered over gameplay.
 *
 * Low-chroma on purpose. Brightness carries most of the state, with just
 * enough hue in the accents to tell them apart at a glance; a saturated
 * green/cyan/red set fought with the game's own UI, which is grey almost
 * everywhere.
 */
const QUEUE_WINDOW = `
  --nm-rq-ink:${QUEUE_WINDOW_BACKGROUND};
  --nm-rq-panel:#111318;
  --nm-rq-panel-hi:#14171a;
  --nm-rq-head:#0d0f13;
  --nm-rq-line:#2c313a;
  --nm-rq-line-hi:#444b57;
  --nm-rq-line-on:#7d8695;
  --nm-rq-text:#d7dbe2;
  --nm-rq-text-hi:#a7adb8;
  --nm-rq-dim:#6b717c;
  --nm-rq-go:#93a892;
  --nm-rq-go-dim:#4b5750;
  --nm-rq-go-wash:rgba(147,168,146,.18);
  --nm-rq-go-text:#e4eae2;
  --nm-rq-stop:#b47a72;
  --nm-rq-stop-wash:rgba(180,122,114,.18);
  --nm-rq-stop-text:#f0e2df;
  --nm-rq-go-fill:rgba(7,85,3,.97);
  --nm-rq-stop-fill:rgb(105,16,5);
  --nm-rq-rg-bg:rgba(255,255,255,.03);
  --nm-rq-on-wash:rgba(255,255,255,.08);
  --nm-rq-timer-shadow:rgba(0,0,0,.55);
`;

/**
 * Black at five alphas, for drop shadows and scrims.
 *
 * A ladder rather than one value because the scan overlay layers a tight dark
 * halo under a wide soft one and needs them to differ. They are close enough
 * that collapsing the middle three would be invisible — which is the sort of
 * decision this file exists to make cheap, so it is left as a choice rather
 * than made here.
 */
const SHADOW = `
  --nm-shadow-strong:rgba(0,0,0,.9);
  --nm-shadow:rgba(0,0,0,.85);
  --nm-shadow-soft:rgba(0,0,0,.8);
  --nm-shadow-softer:rgba(0,0,0,.6);
  --nm-shadow-mid:rgba(0,0,0,.5);
`;

/**
 * Type and shape.
 *
 * `GameFont` is Krunker's own pixel face, already loaded by the page, so
 * naming it is enough. The display stack adds Impact behind it for the panels
 * that want the game's heavier menu look.
 */
const SHAPE = `
  --nm-font:'GameFont',sans-serif;
  --nm-font-display:'GameFont',Impact,'Arial Black',sans-serif;
  --nm-font-mono:ui-monospace,'Cascadia Mono',Consolas,monospace;
  --nm-radius:6px;
  --nm-radius-sm:5px;
  --nm-radius-xs:4px;
  --nm-radius-2xs:3px;
`;

/**
 * The whole palette as one `:root` block.
 *
 * Injected by `preload/palette.ts` for the game window and interpolated into
 * the queue window's own `<style>` by `main/ranked/window.ts`.
 */
export const PALETTE_CSS = `:root{${[
  CLIENT,
  ACCENT,
  STATUS,
  POPOVER,
  GAME,
  GAME_STATUS,
  CHAT,
  WATERMARK,
  QUEUE_BUTTON,
  SCAN,
  UPDATE,
  QUEUE_WINDOW,
  SHADOW,
  SHAPE,
].join('')}}`;
