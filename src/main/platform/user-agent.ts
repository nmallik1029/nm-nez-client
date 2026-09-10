/**
 * Electron's default UA carries two tokens no real browser sends:
 *
 *   ...(KHTML, like Gecko) nmnez/0.1.0 Chrome/152.0.7977.54 Electron/44.0.0 Safari/537.36
 *
 * The Electron one is a well-known automation signal, and the bot check in
 * front of krunker.io picks up on it and throws a verification challenge at
 * you on startup. Dropping both tokens makes us look like plain Chrome.
 *
 * Built from the runtime default rather than a hardcoded string, or the Chrome
 * version drifts away from the Chromium we actually ship, which is its own
 * bot signal.
 */
export function browserUserAgent(defaultUserAgent: string): string {
  return (
    defaultUserAgent
      // The app token is whatever sits right before Chrome/, hence the lookahead.
      .replace(/ [^ /]+\/[^ ]+(?= Chrome\/)/, '')
      .replace(/ Electron\/[^ ]+/, '')
  );
}
