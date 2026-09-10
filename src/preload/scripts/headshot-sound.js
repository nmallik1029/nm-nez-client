/*
 * Headshot sound on every kill.
 *
 * Krunker only dings when you actually hit a head. This plays that same ding
 * for any kill, and silences the real one so a headshot kill dings once
 * rather than twice.
 *
 * The kill is read off the HUD's own kill counter, `#killsVal`. Both clients
 * this idea comes from do it differently and neither route works here:
 *
 *  - Glorp watches the killfeed in the chat list. That only carries kill
 *    lines when "show old scoreboard" is on, which is off by default, so on
 *    a default profile it never fires. Confirmed in a live match: a bot hit
 *    a 10 kill streak and chat showed the streak announcement and nothing
 *    else.
 *  - KCC reads the game's websocket frames, which is reliable but needs
 *    frame decoding a script has no business carrying.
 *
 * The counter has neither problem. Confirmed in the same match that Krunker
 * keeps it up to date even while the counter is hidden: deaths went 1 to 2
 * with `#deathCount` at `display:none` throughout. So this works whatever
 * the player has switched on in the HUD.
 *
 * Runs through `new Function`, so a top-level return is how it hands back
 * its teardown. Everything it touches is put back on the way out.
 */
'use strict';

var HEADSHOT = 'headshot_0';
/** Krunker's own ding is the only one called without a volume. */
var NATIVE_CALL_ARGS = 1;
/** How often to check the counter element is still the one we are watching. */
var REATTACH_MS = 2000;

var originalPlay = null;
var observer = null;
var watched = null;
var lastKills = null;
var timer = null;

function ding() {
  var sound = window.SOUND;
  if (sound && typeof sound.play === 'function') sound.play(HEADSHOT, 1, false);
}

/**
 * React to the counter changing.
 *
 * Only an increase is a kill. It going down is a new match or a round reset,
 * which re-baselines rather than dinging, and the very first reading only
 * sets the baseline — joining a match already on 12 kills is not 12 kills
 * just now.
 */
function onCount() {
  if (!watched) return;
  var value = parseInt(watched.textContent, 10);
  if (isNaN(value)) return;

  var previous = lastKills;
  lastKills = value;
  if (previous === null || value <= previous) return;
  ding();
}

/**
 * Drop Krunker's own headshot ding.
 *
 * Told apart from ours by its arguments: the game calls play('headshot_0')
 * with nothing else, and every replay of ours passes a volume.
 */
function hookSound() {
  var sound = window.SOUND;
  if (!sound || typeof sound.play !== 'function' || originalPlay) return false;

  originalPlay = sound.play;
  sound.play = function (name) {
    if (name === HEADSHOT && arguments.length <= NATIVE_CALL_ARGS) return undefined;
    return originalPlay.apply(this, arguments);
  };
  return true;
}

/**
 * Point the observer at the current counter.
 *
 * Re-checked on a timer rather than attached once, because Krunker rebuilds
 * chunks of its HUD and an observer left on a detached node goes quiet
 * without ever erroring.
 */
function watchCounter() {
  var el = document.getElementById('killsVal');
  if (!el || el === watched) return el !== null;

  if (observer) observer.disconnect();
  watched = el;
  lastKills = null;
  observer = new MutationObserver(onCount);
  observer.observe(el, { childList: true, characterData: true, subtree: true });
  // Take the baseline now so the first real change is a change.
  onCount();
  return true;
}

hookSound();
watchCounter();
timer = setInterval(function () {
  hookSound();
  watchCounter();
}, REATTACH_MS);

return function stop() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  watched = null;
  lastKills = null;
  if (originalPlay && window.SOUND) {
    window.SOUND.play = originalPlay;
    originalPlay = null;
  }
};
