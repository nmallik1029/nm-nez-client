import { describe, expect, it } from 'vitest';
import { resetModsScript, windowIndexByLabel, withResetInLoader, withResetInManager } from './mods-markup';

/**
 * The HTML here is what the live game returned on 2026-09-18, so a change to
 * the insertion is checked against Krunker's real markup, not a guess at it.
 */

const LOADER =
  "<div id='modPckHead' class='setHed' style='margin-top:0px;margin-bottom:20px;'>Mod Loader</div>" +
  "<form id='modDropper'><input onchange='loadMod()' id='modInput'type='file'><p id='modLInfo'>drop mod file here or click</p></form>" +
  "<input type='text' id='modURL' class='accountInput' style='width:78%' placeholder='Paste Mod Url'>" +
  "<a class='menuLink' style='display:inline-block;margin-left:10px' onclick='loadModURL()'>Load Mod</a>";

const MANAGER =
  "<a href='javascript:;' onclick='showWindow(18)' class='menuLink'>Load Mod</a> | " +
  "<a href='javascript:;' onclick='showWindow(19)' class='menuLink'>Upload Mod</a>" +
  "<div style='float:right'> <span>30,000+</span> Mods | <a href='/viewer.html' class='menuLink'>Model Viewer</a></div>" +
  "<div id='modList'></div>";

describe('windowIndexByLabel', () => {
  const windows = [{ label: 'settings' }, null, { label: 'customize' }, { label: 'mods' }, undefined, 'x'];

  it('finds a window by its label', () => {
    expect(windowIndexByLabel(windows, 'mods')).toBe(3);
  });

  it('is -1 when no window has it, holes and all', () => {
    expect(windowIndexByLabel(windows, 'mods_load')).toBe(-1);
  });
});

describe('resetModsScript', () => {
  it("runs what Krunker's own Ctrl+/ runs", () => {
    expect(resetModsScript(3)).toBe("setLastMod('');windows[3].reset(true)");
  });

  it('follows the Mod Manager wherever it sits', () => {
    expect(resetModsScript(5)).toContain('windows[5].reset(true)');
  });

  it('redraws the Mod Manager when asked, by its showWindow number', () => {
    expect(resetModsScript(3, true)).toMatch(/updateWindow\(4\)$/);
  });

  it('never needs double quotes, so it sits in a double-quoted onclick', () => {
    expect(resetModsScript(3, true)).not.toContain('"');
  });
});

describe('withResetInLoader', () => {
  const out = withResetInLoader(LOADER, 3);

  it('keeps everything Krunker wrote, in order, and adds after it', () => {
    expect(out.startsWith(LOADER)).toBe(true);
  });

  it('adds one Reset Mods link wired to the reset', () => {
    expect(out.match(/>Reset Mods</g)).toHaveLength(1);
    expect(out).toContain(`onclick="${resetModsScript(3)}"`);
  });

  it("wears Krunker's own link class", () => {
    expect(out).toMatch(/<a [^>]*class='menuLink'[^>]*>Reset Mods</);
  });

  it('does not add a second one to HTML that has it', () => {
    expect(withResetInLoader(out, 3)).toBe(out);
  });
});

describe('withResetInManager', () => {
  // mods_pub is windows[18] and mods_load windows[17]: showWindow(19) and (18).
  const out = withResetInManager(MANAGER, 3, [18, 17]);

  it('goes straight after Upload Mod, before the right-hand links', () => {
    expect(out).toContain(">Upload Mod</a> | <a href='javascript:;' class='menuLink'");
    expect(out.indexOf('Reset Mods')).toBeLessThan(out.indexOf('Model Viewer'));
  });

  it('redraws the manager after resetting, since it is open', () => {
    expect(out).toContain(resetModsScript(3, true));
  });

  it('falls back to after Load Mod when there is no Upload Mod link', () => {
    const noUpload = MANAGER.replace(/ \| <a[^>]*showWindow\(19\)[^>]*>Upload Mod<\/a>/, '');
    expect(withResetInManager(noUpload, 3, [18, 17])).toContain(">Load Mod</a> | <a href='javascript:;'");
  });

  it('leaves markup it does not recognise alone', () => {
    const other = "<div id='modList'></div>";
    expect(withResetInManager(other, 3, [18, 17])).toBe(other);
    expect(withResetInManager(MANAGER, 3, [-1, -1])).toBe(MANAGER);
  });

  it('does not add a second one to HTML that has it', () => {
    expect(withResetInManager(out, 3, [18, 17])).toBe(out);
  });
});
