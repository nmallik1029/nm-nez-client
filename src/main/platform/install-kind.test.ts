import { describe, expect, it } from 'vitest';
import { appImageRestart, installKind, selfUpdateBlocker, type InstallRuntime } from './install-kind';

const runtime = (over: Partial<InstallRuntime> = {}): InstallRuntime => ({
  isPackaged: true,
  platform: 'win32',
  env: {},
  ...over,
});

describe('installKind', () => {
  it('reads an unpackaged run as dev on every OS', () => {
    expect(installKind(runtime({ isPackaged: false }))).toBe('dev');
    expect(installKind(runtime({ isPackaged: false, platform: 'linux', env: { APPIMAGE: '/a' } }))).toBe(
      'dev',
    );
  });

  it('tells the Windows installer from the portable exe', () => {
    expect(installKind(runtime())).toBe('installer');
    expect(installKind(runtime({ env: { PORTABLE_EXECUTABLE_DIR: 'C:\\x' } }))).toBe('portable');
  });

  it('only counts Linux as an AppImage when the runtime says which file it is', () => {
    expect(installKind(runtime({ platform: 'linux', env: { APPIMAGE: '/home/u/NM-NZ.AppImage' } }))).toBe(
      'appimage',
    );
    expect(installKind(runtime({ platform: 'linux' }))).toBe('unpacked');
    expect(installKind(runtime({ platform: 'linux', env: { APPIMAGE: '' } }))).toBe('unpacked');
  });
});

describe('selfUpdateBlocker', () => {
  it('lets the installer and the AppImage update, and names the reason for the rest', () => {
    expect(selfUpdateBlocker('installer')).toBeNull();
    expect(selfUpdateBlocker('appimage')).toBeNull();
    for (const kind of ['dev', 'portable', 'unpacked'] as const) {
      expect(selfUpdateBlocker(kind)).toMatch(/\w/);
    }
  });
});

describe('appImageRestart', () => {
  const argv = ['/tmp/.mount_x/nmnez-bin', '--ozone-platform=x11', 'nmnez://game'];

  it('waits on our pid, then runs the AppImage file with the same arguments', () => {
    const restart = appImageRestart('appimage', { APPIMAGE: '/home/u/NM NZ.AppImage' }, argv, 4242);
    expect(restart?.command).toBe('/bin/bash');
    // bash -c <script> <$0> <$@...>: the pid is $0 and everything after it is
    // exec'd as-is, so a path with a space in it stays one argument.
    expect(restart?.args.slice(2)).toEqual([
      '4242',
      '/home/u/NM NZ.AppImage',
      '--ozone-platform=x11',
      'nmnez://game',
    ]);
    expect(restart?.args[1]).toMatch(/kill -0 "\$0"[\s\S]*exec "\$@"/);
  });

  it("leaves everything else to Electron's own relaunch", () => {
    expect(appImageRestart('installer', {}, argv, 1)).toBeNull();
    expect(appImageRestart('unpacked', { APPIMAGE: '/stale' }, argv, 1)).toBeNull();
  });
});
