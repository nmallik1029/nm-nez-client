/**
 * Every value the client's look is made of. Change it here or nowhere.
 *
 * This is emitted as a `:root` custom-property block and injected ahead of
 * every stylesheet in `sheets.ts`, so a rule says `var(--nm-accent)` rather
 * than carrying its own copy of a hex. Before this existed the same accent
 * blue was written as three different literals in three files, and changing
 * how the client looked meant a grep across nine of them.
 *
 * Three rules keep it that way, all three enforced by `tokens.test.ts`:
 *
 *  - No colour, font size, z-index, border weight or transition duration
 *    anywhere else. The test fails on one, and names the file it found it in.
 *  - No `var(--nm-*)` that nothing defines. That is a silent no-op at runtime
 *    — the property is simply dropped — so it has to be caught here.
 *  - No token nothing uses, so this file can't quietly fill up with values
 *    that stopped meaning anything two refactors ago.
 *
 * What is deliberately *not* here: one-off geometry. `width:38px` on the queue
 * button and `min-width:104px` on a keybind chip are facts about those two
 * elements, not a scale, and hoisting them would make both files harder to
 * read for no gain. The line is whether changing the value alone would ever
 * be a design decision.
 *
 * Themes ride on all of it. A `.css` in `swap/themes/` is appended last in
 * `document.head` (see `preload/themes.ts`), so it out-cascades this block on
 * equal specificity and a short file re-skins the whole client:
 *
 *     :root { --nm-accent: #ff4d6d; --nm-fs-md: 15px; --nm-radius: 0; }
 *
 * Lives in `shared/` rather than `preload/` because the standalone ranked
 * queue window is its own document built in the main process, and one set of
 * tokens that both windows read is the entire point.
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
  /*
   * The hardpoint enemy count. Its own token rather than --nm-warn, which is
   * a near neighbour: that one means something is wrong and a count of who
   * is on the point does not, so sharing it would recolour the HUD the next
   * time a warning gets retuned.
   *
   * sheets.ts references this, and a var() with no definition drops the
   * whole declaration, so removing it leaves the count unstyled rather than
   * erroring. tokens.test.ts is what catches that.
   */
  --nm-hp-count:#ffc107;
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
 * Krunker's own greys, for anything we draw ONTO one of its surfaces.
 *
 * The settings panel is the game's element, not ours: its background is that
 * mid grey, and a rule or a tint we add there has to sit on it. Reaching for
 * `--nm-surface` instead — a near-black tuned for our own floating panels —
 * paints dark stripes on light grey, which is exactly the bug this group was
 * added to fix.
 *
 * Read off the running game rather than guessed. They are close enough to be
 * worth re-checking against a screenshot if Krunker reskins.
 */
const KRUNKER = `
  --nm-kr-rule:#4a4a4a;
  --nm-kr-rule-soft:#464646;
  --nm-kr-fill:#464646;
  --nm-kr-text:#fff;
  --nm-kr-text-dim:#b4b4b4;
  --nm-kr-text-faint:#9a9a9a;
  --nm-kr-accent:#2f8ff5;
`;

/**
 * The `[T]`/`[M]` prefixes on merged chat. Green for team, red for match, which
 * is the association Krunker's own name colours already set up.
 */
/**
 * Chat: the two channel colours, and where the menu puts the box.
 *
 * `--nm-chat-lift` is how far chat rises off the bottom of the screen to
 * clear Krunker's own button block. The value here is a fallback measured at
 * 1920x1080; `preload/chat-place.ts` overwrites it with a real measurement,
 * because the block scales with the window and a fixed number is right at
 * exactly one size. If that measurement fails, this still clears the buttons.
 */
const CHAT = `
  --nm-chat-team:#4ade80;
  --nm-chat-all:#f87171;
  --nm-chat-lift:192px;
  --nm-chat-menu-height:min(340px,32vh);
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
  --nm-queue-bg:#5ce05a;
  /* Dark text, because the fill is bright enough that white disappears. */
  --nm-queue-text:#000;
  /*
   * The rejoin state, which is Krunker's own button rather than ours.
   *
   * The same button in every respect but the fill: one starts a search, the
   * other drops you back into a match already waiting for you, and those
   * want telling apart at a glance without looking like two different
   * controls. Yellow is bright enough to take the same dark text.
   */
  --nm-rejoin-bg:#f0c420;
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
 * The match-scan overlay's geometry and timings, as numbers.
 *
 * These are the values the animation and the code that drives it have to agree
 * on: the sweep waits `landingPauseMs` for a line to finish landing and
 * `expandMs` for the flood to cover the screen before it navigates, and a
 * rejected line is removed from the DOM after `fallMs` because that is exactly
 * how long its tumble lasts. Written once, read by both the stylesheet and
 * `preload/matchmaker/scan.ts`, so a change to one can't leave the other
 * behind. The durations also appear as `--nm-scan-*` tokens above; these are
 * the same numbers in the form `setTimeout` can use.
 */
export const SCAN_THUMB = { width: 52, height: 34 } as const;

export const SCAN_TIMING = {
  /** How long a rejected line takes to tumble off. Outlives the tick, so a few overlap. */
  fallMs: 780,
  landingPauseMs: 460,
  /** Duration of the flood that covers the screen. */
  expandMs: 720,
  /** Give preloading this long, then start anyway. Not worth stalling the sweep. */
  preloadBudgetMs: 450,
} as const;

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
 * Typefaces.
 *
 * One face for the whole client: `GameFont`, Krunker's own pixel type. The
 * game page has it loaded already so naming it is enough there, and the
 * windows that aren't the game page inline it themselves, in
 * `main/game-font.ts`.
 *
 * The two entries differ only in what they fall back to while that inline
 * copy is still arriving. Impact is much closer to GameFont's weight than a
 * default sans, so a heading caught mid-load still reads as a heading.
 */
const FONT = `
  --nm-font:'GameFont',sans-serif;
  --nm-font-display:'GameFont',Impact,'Arial Black',sans-serif;
`;

/**
 * The type scale. Every font size the client draws, and nothing else.
 *
 * Named by step rather than by role, because the same size does different jobs
 * on different surfaces and role names would end up lying. Sizes are the ones
 * that were already in use — this scale was read off the UI, not imposed on
 * it, so nothing moved when it landed.
 *
 * `--nm-fs-md` is the workhorse: settings rows, buttons, tooltips, chat.
 * Nudging one step here resizes everything that shares it, which is the whole
 * reason for the block.
 *
 * There is no 6xl. It was 21px, for the class-card buttons, and it stopped
 * being used when those went back to the size Krunker sets on them. The
 * hole is deliberate: the suffixes are names, not indices, and renumbering
 * 7xl and 8xl down to close it would touch a dozen files to say nothing.
 */
const TYPE_SCALE = `
  --nm-fs-2xs:11px;
  --nm-fs-xs:12px;
  --nm-fs-md:13px;
  --nm-fs-lg:14px;
  --nm-fs-xl:15px;
  --nm-fs-2xl:16px;
  --nm-fs-3xl:17px;
  --nm-fs-4xl:19px;
  --nm-fs-5xl:20px;
  --nm-fs-7xl:24px;
  --nm-fs-8xl:28px;
  --nm-fs-display:52px;
`;

/**
 * Line heights and letter-spacing.
 *
 * The wide tracking is Krunker's, not ours: the game sets its menu headings in
 * spaced-out caps and the panels that sit inside its UI copy that so they
 * don't read as someone else's work.
 *
 * Named in steps like the type scale rather than by role, so the set reads as
 * one scale rather than six siblings and an odd one out. Every step is a value
 * already in use.
 */
const TYPE_DETAIL = `
  --nm-lh-tight:1.2;
  --nm-lh:1.5;
  --nm-lh-loose:1.55;
  /* The perf HUD, whose stacked rows need the extra room. */
  --nm-lh-hud:1.45;
  --nm-track-xs:.02em;
  --nm-track-sm:.04em;
  --nm-track-md:.06em;
  --nm-track-lg:.08em;
  --nm-track-xl:.12em;
  --nm-track-2xl:.14em;
  --nm-track-3xl:.2em;
`;

/**
 * Gaps between things in a row or a stack.
 *
 * Only the three that actually repeat. The one-off paddings stay written out
 * where they are used: a sixteen-step "scale" of consecutive pixel values is a
 * lookup table pretending to be a system, and `padding:7px 14px` reads better
 * than two variables that each mean one number.
 */
const SPACE = `
  --nm-gap-sm:8px;
  --nm-gap:10px;
  --nm-gap-lg:14px;
`;

/**
 * Corner radius and border weight.
 *
 * The two levers that decide how hard-edged the client looks. Setting every
 * radius to 0 and every border to 2px is most of the way to a panel that
 * passes for Krunker's own; the reverse gives you a web dashboard.
 */
const SHAPE = `
  --nm-radius:6px;
  --nm-radius-sm:5px;
  --nm-radius-xs:4px;
  --nm-radius-2xs:3px;
  --nm-bw:1px;
  --nm-bw-thick:2px;
  --nm-bw-heavy:3px;
  /*
   * Krunker own weight for a menu button, which is 4px with a 4px radius
   * on every one of them. Read off the game, not chosen: .buttonP and its
   * siblings all say "border: 4px solid <hue> !important".
   */
  --nm-bw-chunky:4px;
`;

/**
 * How long things take.
 *
 * `--nm-fast` is the hover-feedback duration on nearly everything. The named
 * ones below it belong to a specific animation whose timing is tied to what
 * the JS is doing at the same moment, so they are not interchangeable with it.
 */
const MOTION = `
  --nm-fast:.12s;
  --nm-quick:.1s;
  --nm-med:.16s;
  --nm-slow:.2s;
  --nm-blink:1.4s;
  --nm-scan-land:420ms;
  --nm-scan-fade:260ms;
  --nm-scan-cut:130ms;
`;

/**
 * Stacking order.
 *
 * Krunker's own UI runs into the tens of thousands, so anything of ours that
 * has to cover it starts near the 32-bit ceiling. They are laid out as one
 * ordered list here for the reason you'd expect: written out separately in
 * five files, the next overlay gets a number picked by guesswork and lands
 * under something it was supposed to cover.
 *
 * Modals are the exception and sit low on purpose — they open over the menu,
 * not over gameplay, and a toast fired while one is up should still be read.
 */
const LAYER = `
  /* One step above its own siblings, for something that has to sit over the
     content beside it without leaving the stack it is in. */
  --nm-z-raise:1;
  --nm-z-modal:100000;
  --nm-z-update:100001;
  --nm-z-hud:2147483000;
  --nm-z-toast:2147483200;
  --nm-z-scan:2147483260;
  --nm-z-tooltip:2147483400;
`;

/**
 * The main-menu skin.
 *
 * Its own group rather than an extension of `--nm-kr-*`, and the distinction
 * matters: that group exists to *match* Krunker's greys because we are drawing
 * onto its surfaces. This one *replaces* how the menu looks, which is the
 * opposite intent, and folding the two together would leave every future edit
 * ambiguous about which was meant.
 *
 * The neutrals are warm on purpose — hue around 38 degrees, chroma barely off
 * zero. The menu renders over a live map, and Krunker's maps are sand, brick
 * and rust far more often than they are anything cool; a neutral mixed toward
 * blue reads as a system dialog dropped on top of the game. Bone rather than
 * pure white for the same reason.
 *
 * One accent. Status colours are not it: the frame counter already carries
 * Krunker's own green-to-red, and that is semantic, so the skin leaves it be.
 */
const MENU = `
  --nm-menu-ink:#0c0b0a;
  --nm-menu-line:#2e2a23;
  --nm-menu-line-hi:#4a4238;
  --nm-menu-bone:#f2eee6;
  --nm-menu-bone-hi:#fff;
  --nm-menu-ash:#9a9285;
  --nm-menu-ash-dim:#6e675d;
  --nm-menu-ember: #68e42e;
  --nm-menu-panel:#15130f;
  --nm-menu-fill:rgba(0, 0, 0, 0.85);
  --nm-menu-wash:rgba(252, 252, 252, 0.83);
  --nm-menu-ember-wash:rgb(0, 0, 0);
`;

/**
 * Krunker's own button hues, for the five across the bottom of the menu.
 *
 * Read off the game's stylesheet rather than picked. It colours that row with
 * four classes — `.buttonP` purple, `.buttonPI` pink, `.buttonR` red and
 * `.buttonG` cyan, each a 4px border — and that coding is most of what makes
 * its menu readable at a glance. The skin used to flatten all five to one
 * grey, which is what made ours look like a different game's menu.
 *
 * One deliberate departure: the game spends its red twice, on Host Game and
 * Find Game, and puts its pink on Ranked. Ranked takes the client accent here
 * instead, which frees the pink for Find Game, so no two of the five match.
 *
 * `--nm-menu-red` also draws the "2x KR" badge. The game sets that at #ff4444,
 * three points off its own button red — close enough that a second token
 * would be two values to keep in step for no visible difference.
 */
const MENU_HUES = `
  --nm-menu-purple:#b447ff;
  --nm-menu-red:#ff4747;
  --nm-menu-pink:#fa50ae;
  --nm-menu-cyan:#31caec;
`;

/**
 * Near-black, at the two opacities the menu still needs it.
 *
 * These were a four-stop ladder for the backdrop that used to sit behind the
 * whole menu, where the three gradients had to meet in the corners without
 * seaming. The backdrop is gone; what is left is the fill behind Krunker's
 * own popups and the transparent end, which several borders fade out to.
 */
const MENU_SCRIM = `
  --nm-menu-scrim:rgba(12,11,10,.94);
  --nm-menu-scrim-0:rgba(12,11,10,0);
  --nm-menu-cta-shadow:rgba(12,11,10,.9);
`;

/**
 * The menu's face and its one bespoke measurement.
 *
 * This was a separate typeface for the small labels for a while, with
 * GameFont kept for headings and buttons. Two faces on one screen read as
 * two pieces of software, so the menu is set in GameFont like the rest.
 *
 * Still its own token rather than `--nm-font` written out everywhere: these
 * rules all carry `!important` to beat Krunker's own, and one name for them
 * means retuning the menu is one line rather than twenty-odd.
 *
 * It used to carry a `--nm-menu-track-cta` of .42em for the click-to-play
 * label, the one thing in the client set that wide. It is gone, and so is
 * the rest of the skin's tracking on the game's own labels: measured against
 * Krunker, every one of them is GameFont at natural size with no tracking
 * and no case change, and adding both made the menu read as a more modern,
 * more generic piece of software. Track our own panels, not the game's.
 */
const MENU_TYPE = `
  --nm-menu-font:'GameFont',sans-serif;
`;

/**
 * How long the click-to-play label takes to breathe.
 *
 * Krunker pulses it at 0.8s on a `scale()`, which is the single loudest thing
 * on an otherwise still screen. This is slow enough to read as ambient rather
 * than as something demanding a click, and it drives opacity instead of size
 * so it never nudges the layout around it.
 */
const MENU_MOTION = `
  --nm-menu-breathe:3.4s;
  --nm-menu-arrow:.34s;
`;

/**
 * Every token as one `:root` block.
 *
 * Injected first by `preload/style.ts` for the game window, and interpolated
 * into the queue window's own `<style>` by `main/ranked/window.ts`.
 */
export const TOKENS_CSS = `:root{${[
  CLIENT,
  ACCENT,
  STATUS,
  POPOVER,
  GAME,
  GAME_STATUS,
  KRUNKER,
  CHAT,
  WATERMARK,
  QUEUE_BUTTON,
  SCAN,
  UPDATE,
  QUEUE_WINDOW,
  MENU,
  MENU_HUES,
  MENU_SCRIM,
  MENU_TYPE,
  MENU_MOTION,
  SHADOW,
  FONT,
  TYPE_SCALE,
  TYPE_DETAIL,
  SPACE,
  SHAPE,
  MOTION,
  LAYER,
].join('')}}`;
