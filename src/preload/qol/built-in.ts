import { CLIENT_SCRIPTS } from '../scripts/registry';
import { isScriptRunning, setScriptEnabled } from '../scripts/runner';
import type { TabContext } from './context';
import { empty, featureRow, note } from './row';

/**
 * The Built-in tab: the things the client does that Krunker does not.
 *
 * Read from the runner rather than from config, because the runner is what
 * is actually true: one that threw on the way in is off however the config
 * has it. Config is written alongside so the choice survives a restart.
 *
 * This list used to have a second home, a Scripts window opened from a button
 * in the top bar. That button is gone: one panel with a tab for these and a
 * tab for your own scripts is the whole point of this one.
 *
 * Unlike the userscripts in the other tab, these start and stop where you
 * stand. Each ships with its own teardown, which is what the reload over
 * there buys and this does not need.
 */

export function renderBuiltIn(body: HTMLElement, ctx: TabContext): void {
  if (CLIENT_SCRIPTS.length === 0) {
    body.append(empty('Nothing here yet.'));
    return;
  }

  for (const script of CLIENT_SCRIPTS) {
    body.append(
      featureRow({
        icon: script.icon,
        name: script.name,
        sub: script.description,
        on: isScriptRunning(script.id),
        onToggle: () => {
          setScriptEnabled(script.id, !isScriptRunning(script.id));
          ctx.deps.patchFeatures({
            enabledScripts: CLIENT_SCRIPTS.filter((entry) => isScriptRunning(entry.id)).map(
              (entry) => entry.id,
            ),
          });
          ctx.refresh();
        },
      }),
    );
  }

  body.append(note('More is going in here: crosshair and hitmarker pickers, and sky colours.'));
}
