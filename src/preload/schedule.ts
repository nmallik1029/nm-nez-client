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
