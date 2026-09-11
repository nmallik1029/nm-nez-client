/**
 * The client's whole look, in one module.
 *
 *   tokens.ts  every value: colour, type, spacing, radius, motion, layers
 *   sheets.ts  every rule that spends those values
 *   ids.ts     the element and stylesheet ids the rules and the DOM share
 *
 * Nothing outside this directory should hold a colour, a font size, a
 * z-index, a border weight or a transition duration; `tokens.test.ts` fails
 * the build if one appears. Components import from here, mount their markup
 * and hand a sheet to `preload/style.ts`: they no longer own how they look.
 */
export { STYLE_IDS, UI_IDS } from './ids';
export { SHEETS } from './sheets';
export {
  GAME_WINDOW_BACKGROUND,
  QUEUE_WINDOW_BACKGROUND,
  SCAN_TIMING,
  TOKENS_CSS,
} from './tokens';
