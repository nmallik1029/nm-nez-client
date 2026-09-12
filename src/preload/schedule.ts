/**
 * Collapse a burst of calls into one pass on the next frame.
 *
 * Every menu component here reacts to a MutationObserver, and Krunker mutates
 * a lot: a match fires childList records for every killfeed line, chat message,
 * ammo tick and leaderboard update. A handler wired straight to the observer
 * runs once per batch, which in a round is dozens of times a second, on the
 * same main thread the frame is drawn on.
 *
 * Nothing any of these handlers do needs to happen more than once per frame: 
 * they put a button back where it belongs, and the DOM is not painted between
 * batches anyway. Coalescing is therefore free: the work still lands before the
 * next paint, it just lands once.
 *
 * `chat-place.ts` and `menu-skin.ts` each grew their own copy of this before it
 * was worth sharing. This is that, with the id-vs-boolean trap removed:
 * `requestAnimationFrame` ids start at 1 in browsers but nothing guarantees it,
 * so a flag says what is meant instead of leaning on 0 being falsy.
 */
export function coalesced(run: () => void): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  };
}

/**
 * Run once, `delayMs` after the calls stop.
 *
 * The other half of the same problem, for work that should not happen once a
 * frame either. Dragging a slider in the crosshair editor produces a change
 * event per frame, and each one is an IPC round trip and a write to
 * config.json at the far end of it: what is wanted is the value you let go
 * on, not the sixty on the way there.
 *
 * Trailing edge only, deliberately. The picture is already being redrawn on
 * every change by whoever called this; the thing being held back is the
 * saving, and saving the first value of a drag is the one value nobody
 * chose.
 */
export function debounced(run: () => void, delayMs: number): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      run();
    }, delayMs);
  };
}
