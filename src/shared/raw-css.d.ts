/**
 * Stylesheets imported for their text.
 *
 * A user-supplied theme is a .css file rather than a template literal in
 * `sheets.ts`: it is somebody else's look, not part of this client's design
 * system, and the token guard in `tokens.test.ts` only scans .ts — so this
 * keeps it out of the guard's way by construction rather than by exception.
 */
declare module '*.css?raw' {
  const css: string;
  export default css;
}

/**
 * Userscripts imported for their text.
 *
 * A built-in script is a .js file rather than a template literal, because it
 * is a userscript: the same thing you could drop in the swap folder, kept in
 * the repo so it ships with an update. Importing the text means it is still
 * an ordinary file with ordinary syntax highlighting.
 */
declare module '*.js?raw' {
  const source: string;
  export default source;
}
