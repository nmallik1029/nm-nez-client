import { CLIENT_SCRIPTS } from '../scripts/registry';
import { isScriptRunning, setScriptEnabled } from '../scripts/runner';
import type { PanelView, TabContext } from './context';
import { crosshairEditor } from './crosshair-editor';
import { hitmarkerEditor } from './hitmarker-editor';
import { featureRow, note } from './row';
import { skyEditor } from './sky-editor';

/**
 * The Built-in tab: the things the client does that Krunker does not.
 *
 * Two kinds of row. The first three are pieces of the game we draw ourselves,
 * and each opens an editor, because "which crosshair" is not a question with
 * a yes or a no. Under them are the scripts, which are.
 *
 * The scripts read from the runner rather than from config, because the
 * runner is what is actually true: one that threw on the way in is off
 * however the config has it. Config is written alongside so the choice
 * survives a restart.
 *
 * Unlike the userscripts in the other tab, everything here starts and stops
 * where you stand. The sky is the one exception and says so itself, since a
 * map's sky is built when the map loads.
 */

export function renderBuiltIn(body: HTMLElement, ctx: TabContext): void {
  const visuals = ctx.deps.getVisuals();

  const openable = (spec: {
    icon: string;
    name: string;
    sub: string;
    on: boolean;
    toggle: () => void;
    editor: () => PanelView;
  }): HTMLElement =>
    featureRow({
      icon: spec.icon,
      name: spec.name,
      sub: spec.sub,
      on: spec.on,
      onToggle: () => {
        spec.toggle();
        ctx.refresh();
      },
      action: { label: 'Edit', onClick: () => ctx.push(spec.editor()) },
    });

  body.append(
    openable({
      icon: 'gps_fixed',
      name: 'Crosshair',
      sub: 'Build one, or drop in an image. Stored as its own file, so a dead link can never leave you without a crosshair.',
      on: visuals.crosshair.on,
      toggle: () =>
        ctx.deps.patchVisuals({
          crosshair: { ...visuals.crosshair, on: !visuals.crosshair.on },
        }),
      editor: crosshairEditor,
    }),
    openable({
      icon: 'add',
      name: 'Hitmarker',
      sub: 'The same, for the marker that shows when you land a shot. Drag it off centre and pull its corner to resize.',
      on: visuals.hitmarker.on,
      toggle: () =>
        ctx.deps.patchVisuals({
          hitmarker: { ...visuals.hitmarker, on: !visuals.hitmarker.on },
        }),
      editor: hitmarkerEditor,
    }),
    openable({
      icon: 'wb_sunny',
      name: 'Sky colour',
      sub: 'One colour for every map, in place of its own sky. Lands when the next map loads.',
      on: visuals.sky.on,
      toggle: () => ctx.deps.patchVisuals({ sky: { ...visuals.sky, on: !visuals.sky.on } }),
      editor: skyEditor,
    }),
  );

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

  body.append(
    note(
      'The crosshair is drawn by the client, so it hides itself in the menu and while you are scoped. The hitmarker appears when the game plays its hit sound, which is Krunker saying you connected rather than the client guessing.',
    ),
  );
}
