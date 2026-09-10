/*
 * Headshot sound on every kill.
 *
 * Krunker only dings when you actually hit a head. This plays that same ding
 * for any kill, and silences the real one so a headshot kill dings once
 * rather than twice.
 *
 * KCC does this by reading the game's websocket frames and watching for the
 * kill event. That is more precise and needs machinery a script does not
 * have, so this takes Glorp's route instead: the killfeed is in the chat
 * list, and a kill of yours is a line whose first coloured name is "You".
 * Checking the first one is what separates your kill from your death, since
 * the killer's name always comes first.
 *
 * Runs through `new Function`, so a top-level return is how it hands back
 * its teardown. Everything it touches is put back on the way out.
 */
'use strict';

var HEADSHOT = 'headshot_0';
/** Krunker's own ding is the only one called without a volume. */
var NATIVE_CALL_ARGS = 1;

var originalPlay = null;
var observer = null;
var waitTimer = null;

/** Play the ding ourselves, with a volume so our own wrapper lets it past. */
function ding() {
  var sound = window.SOUND;
  if (sound && typeof sound.play === 'function') sound.play(HEADSHOT, 1, false);
}

/**
 * Is this chat line you killing someone?
 *
 * A killfeed line carries a weapon image; an ordinary message does not. The
 * names in it are coloured spans, and the first is always the killer, so
 * "You" first means the kill is yours and "You" later means you were the one
 * killed.
 */
function isOwnKill(node) {
  if (!node || node.nodeType !== 1) return false;

  var message = node.querySelector('span.chatMsg');
  if (!message || !message.querySelector('img')) return false;

  var names = message.querySelectorAll('span[style*="color"]');
  if (names.length === 0) return false;
  return names[0].textContent.trim() === 'You';
}

function onChatMutations(mutations) {
  for (var i = 0; i < mutations.length; i += 1) {
    var added = mutations[i].addedNodes;
    for (var j = 0; j < added.length; j += 1) {
      if (isOwnKill(added[j])) {
        ding();
        return;
      }
    }
  }
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

function watchChat() {
  if (observer) return true;
  var list = document.getElementById('chatList');
  if (!list) return false;

  observer = new MutationObserver(onChatMutations);
  observer.observe(list, { childList: true });
  return true;
}

// Neither the sound manager nor the chat list exists when a script first
// runs; both are built by the game. Poll until they turn up, then stop.
function attach() {
  var soundReady = hookSound();
  var chatReady = watchChat();
  if (soundReady && chatReady && waitTimer !== null) {
    clearInterval(waitTimer);
    waitTimer = null;
  }
}

attach();
if (waitTimer === null && (!originalPlay || !observer)) {
  waitTimer = setInterval(attach, 500);
}

return function stop() {
  if (waitTimer !== null) {
    clearInterval(waitTimer);
    waitTimer = null;
  }
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  // Only put ours back if nothing else has wrapped it since.
  if (originalPlay && window.SOUND) {
    window.SOUND.play = originalPlay;
    originalPlay = null;
  }
};
