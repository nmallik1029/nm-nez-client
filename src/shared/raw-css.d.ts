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
