import { CLIENT_SCRIPTS } from '../scripts/registry';
import { isScriptRunning, setScriptEnabled } from '../scripts/runner';
import { accuracyEditor } from './accuracy-editor';
import type { PanelView, TabContext } from './context';
import { crosshairEditor } from './crosshair-editor';
import { hitmarkerEditor } from './hitmarker-editor';
import { killStreakEditor } from './killstreak-editor';
import { featureRow } from './row';
import { showToast } from '../toast';
import { skyEditor } from './sky-editor';

/**
 * The Built-in tab: the things the client does that Krunker does not.
 *
 * Two kinds of row. The first four each open an editor, because "which crosshair" is not a question with
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
      sub: 'My fix for crosshairs disappearing randomly + trash native crosshair UI on krunker, might be buggy with images so please put any bugs in discord.',
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
      sub: 'Same fix for hitmarkers disappearing, you can also drag to resize/recenter the hitmarker or use sliders too (or an image ofc).',
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
      sub: 'Custom sky color!! For people nervous about using this, sky color scripts are okayed by developers.',
      on: visuals.sky.on,
      toggle: () => {
        ctx.deps.patchVisuals({ sky: { ...visuals.sky, on: !visuals.sky.on } });
        // The editor carries this notice permanently; the row is the other
        // way to flip it, and flipping it here looks like nothing happened.
        showToast('The sky is built when a map loads, so this lands on the next one', 3600);
      },
      editor: skyEditor,
    }),
    openable({
      icon: 'military_tech',
      name: 'Kill streak sounds',
      sub: 'Valorant-style: a sound and a banner for each kill in a row. Pick a pack, or add your own to swap/sounds/killstreak.',
      on: visuals.killStreak.on,
      toggle: () =>
        ctx.deps.patchVisuals({
          killStreak: { ...visuals.killStreak, on: !visuals.killStreak.on },
        }),
      editor: killStreakEditor,
    }),
  );

  const features = ctx.deps.getFeatures();
  body.append(
    featureRow({
      icon: 'visibility_off',
      name: 'Hide death stats',
      sub: 'Removes the stats panel that pops up when you die. Its shadows and images all load on the frame you die, which freezes the client for a lot of people.',
      on: features.hideDeathStats,
      onToggle: () => {
        ctx.deps.patchFeatures({ hideDeathStats: !ctx.deps.getFeatures().hideDeathStats });
        ctx.refresh();
      },
    }),
    openable({
      icon: 'track_changes',
      name: 'Live accuracy',
      sub: 'How many of your shots have landed this match and this life, side by side. Edit puts it top centre or bottom centre of the screen.',
      on: features.accuracyCounter,
      toggle: () =>
        ctx.deps.patchFeatures({ accuracyCounter: !ctx.deps.getFeatures().accuracyCounter }),
      editor: accuracyEditor,
    }),
    featureRow({
      icon: 'leaderboard',
      name: 'Ranks on the leaderboard',
      sub: 'Rank icons beside every name on the top right leaderboard in ranked matches. The same icons Krunker shows on its Tab scoreboard, copied across.',
      on: features.boardRankIcons,
      onToggle: () => {
        ctx.deps.patchFeatures({ boardRankIcons: !ctx.deps.getFeatures().boardRankIcons });
        ctx.refresh();
      },
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
}
