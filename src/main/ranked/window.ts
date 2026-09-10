import { join } from 'node:path';
import { BrowserWindow } from 'electron';
import { BRANDING } from '../../shared/branding';
import { PALETTE_CSS, QUEUE_WINDOW_BACKGROUND } from '../../shared/palette';
import { RANKED_REGIONS } from '../../shared/ranked';
import { gameFontFace } from '../game-font';
import { iconOption } from '../app-icon';

/**
 * The standalone ranked queue window.
 *
 * An ordinary window, not an overlay. Normal frame, sits in the taskbar,
 * normal z-order, closes with its own X. Something you leave running while
 * you get on with something else.
 *
 * Styled after Krunker instead of the usual dark dashboard: the game's own
 * typeface, hard edges, dark fill inside a thick border for buttons. Colours
 * are the `--nm-rq-*` group in `shared/palette.ts`, deliberately low-chroma.
 */

const REGION_BUTTONS = RANKED_REGIONS.map(
  (r) =>
    `<button class="rg" data-region="${r.id}">${r.id === 'as' ? 'ASIA' : r.id.toUpperCase()}</button>`,
).join('');

function buildHtml(fontFace: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
${fontFace}

/*
 * Shared with the game window. This document has no preload of its own to
 * inject it, so the block is interpolated straight in; the --nm-rq-* group
 * is the part that belongs to this window.
 */
${PALETTE_CSS}

*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;overflow:hidden;-webkit-user-select:none;
  background:var(--nm-rq-ink);color:var(--nm-rq-text);
  font-family:var(--nm-font-display)}

.frame{height:100%;display:flex;flex-direction:column;
  border:2px solid var(--nm-rq-line);background:var(--nm-rq-panel)}

/*
 * While queued the window edge steps between two flat greens. No blur, no
 * gradient, no easing.
 *
 * A soft glow was my first attempt and it was wrong. There's no ambient light
 * anywhere in Krunker's UI, it's all solid fill and sharp border, so a diffuse
 * pulse reads as a web dashboard sitting on top of the game. A hard blink
 * reads as an indicator lamp, which is the right idea.
 *
 * steps(1,end) is what makes it snap instead of fade. border-color has no
 * transition, which would only smooth the edge we want hard.
 */
.frame.live{animation:edge 1.4s steps(1,end) infinite}
@keyframes edge{
  0%,50%{border-color:var(--nm-rq-go);background:var(--nm-rq-panel-hi)}
  50.01%,100%{border-color:var(--nm-rq-go-dim);background:var(--nm-rq-panel)}
}

.head{display:flex;align-items:center;justify-content:center;
  padding:12px 16px 10px;border-bottom:2px solid var(--nm-rq-line);
  background:var(--nm-rq-head)}
.head .t{font-size:17px;letter-spacing:.2em}

/* The header rule steps with the frame edge, on the same beat. */
.frame.live .head{animation:headEdge 1.4s steps(1,end) infinite}
@keyframes headEdge{
  0%,50%{border-bottom-color:var(--nm-rq-go)}
  50.01%,100%{border-bottom-color:var(--nm-rq-go-dim)}
}

.body{flex:1;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:18px;padding:20px}

/* Hard offset shadow, the way the game draws its own text. Not a soft halo. */
#timer{font-size:52px;letter-spacing:.08em;line-height:1;
  text-shadow:0 4px 0 var(--nm-rq-timer-shadow)}
.frame.live #timer{color:var(--nm-rq-go)}

/* Krunker's button look: dark fill, thick border, uppercase. */
#go{padding:13px 0;width:260px;cursor:pointer;font-family:inherit;
  font-size:17px;letter-spacing:.14em;
  background:var(--nm-rq-go-fill);border:3px solid var(--nm-rq-go);color:var(--nm-rq-go);
  transition:background .12s,color .12s}
#go:hover{background:var(--nm-rq-go-wash);color:var(--nm-rq-go-text)}
#go.on{background:var(--nm-rq-stop-fill);border-color:var(--nm-rq-stop);
  color:var(--nm-rq-stop)}
#go.on:hover{background:var(--nm-rq-stop-wash);color:var(--nm-rq-stop-text)}
#go:disabled{opacity:.45;cursor:default}

/* Selected regions read brighter rather than bluer. Brightness does the work. */
.regions{display:flex;gap:10px}
.rg{padding:9px 22px;cursor:pointer;font-family:inherit;font-size:13px;
  letter-spacing:.12em;background:var(--nm-rq-rg-bg);
  border:2px solid var(--nm-rq-line);color:var(--nm-rq-dim);transition:all .12s}
.rg:hover{border-color:var(--nm-rq-line-hi);color:var(--nm-rq-text-hi)}
.rg.on{background:var(--nm-rq-on-wash);border-color:var(--nm-rq-line-on);
  color:var(--nm-rq-text)}

#msg{font-size:12px;letter-spacing:.08em;color:var(--nm-rq-dim);min-height:15px;
  text-align:center}
#msg.bad{color:var(--nm-rq-stop)}
#msg.good{color:var(--nm-rq-go)}
</style></head>
<body>
  <div class="frame" id="frame">
    <div class="head"><span class="t">LOCK TF IN</span></div>
    <div class="body">
      <div id="timer">00:00:00</div>
      <button id="go">START QUEUE</button>
      <div class="regions">${REGION_BUTTONS}</div>
      <div id="msg"></div>
    </div>
  </div>
<script>
  const $ = (id) => document.getElementById(id);
  let ticking = null;
  let regions = [];

  const clock = (s) => {
    s = Math.max(0, Math.floor(s));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return [h, m, x].map((n) => String(n).padStart(2, '0')).join(':');
  };
  const stopTick = () => { if (ticking) { clearInterval(ticking); ticking = null; } };

  const paintRegions = () => {
    document.querySelectorAll('.rg').forEach((b) => {
      b.classList.toggle('on', regions.includes(b.dataset.region));
    });
  };

  document.querySelectorAll('.rg').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.region;
      regions = regions.includes(id) ? regions.filter((r) => r !== id) : [...regions, id];
      paintRegions();
      window.rankedQueue.setRegions(regions);
    });
  });

  $('go').addEventListener('click', () => {
    if ($('go').classList.contains('on')) window.rankedQueue.stop();
    else window.rankedQueue.start();
  });

  window.rankedQueue.onState((s) => {
    if (Array.isArray(s.regions)) { regions = s.regions; paintRegions(); }

    const go = $('go'), msg = $('msg'), frame = $('frame');
    msg.className = '';
    msg.textContent = '';
    go.disabled = false;
    go.classList.remove('on');
    frame.classList.remove('live');
    stopTick();

    if (s.status === 'queued') {
      // The wave and the green frame say enough; no status label needed.
      frame.classList.add('live');
      go.classList.add('on');
      go.textContent = 'LEAVE QUEUE';
      const paint = () => { $('timer').textContent = clock((Date.now() - s.since) / 1000); };
      paint();
      ticking = setInterval(paint, 500);
    } else if (s.status === 'connecting') {
      go.disabled = true;
      go.textContent = 'START QUEUE';
      $('timer').textContent = '00:00:00';
    } else if (s.status === 'matched') {
      go.textContent = 'START QUEUE';
      msg.className = 'good';
      msg.textContent = 'MATCH FOUND: ' + s.mapLabel + ' · ' + s.regionLabel;
      $('timer').textContent = '00:00:00';
    } else if (s.status === 'cooldown') {
      go.textContent = 'START QUEUE';
      msg.className = 'bad';
      msg.textContent = 'ON COOLDOWN';
      const paint = () => {
        const left = (s.until - Date.now()) / 1000;
        if (left <= 0) { stopTick(); msg.textContent = ''; $('timer').textContent = '00:00:00'; return; }
        $('timer').textContent = clock(left);
      };
      paint();
      ticking = setInterval(paint, 500);
    } else if (s.status === 'error') {
      go.textContent = 'START QUEUE';
      msg.className = 'bad';
      msg.textContent = (s.message || s.code).toUpperCase();
      $('timer').textContent = '00:00:00';
    } else {
      go.textContent = 'START QUEUE';
      $('timer').textContent = '00:00:00';
    }
  });
</script>
</body></html>`;
}

export interface RankedWindow {
  readonly window: BrowserWindow;
  send(channel: string, payload: unknown): void;
  focus(): void;
  isAlive(): boolean;
}

export function createRankedWindow(fontBase64: string, onClosed: () => void): RankedWindow {
  const window = new BrowserWindow({
    width: 520,
    height: 400,
    minWidth: 440,
    minHeight: 380,
    frame: true,
    autoHideMenuBar: true,
    backgroundColor: QUEUE_WINDOW_BACKGROUND,
    ...iconOption(),
    title: `${BRANDING.productName}`,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'ranked-queue.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.removeMenu();
  const html = buildHtml(gameFontFace(fontBase64));
  void window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  window.once('ready-to-show', () => window.show());
  window.on('closed', onClosed);

  return {
    window,
    send(channel, payload) {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      try {
        window.webContents.send(channel, payload);
      } catch {
        // Frame gone mid-send.
      }
    },
    focus() {
      if (window.isDestroyed()) return;
      if (window.isMinimized()) window.restore();
      window.focus();
    },
    isAlive() {
      return !window.isDestroyed();
    },
  };
}
