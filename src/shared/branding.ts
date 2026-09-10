/**
 * Every user-visible name and OS identifier lives here. Change a name in this
 * file and nowhere else.
 *
 * Two of these are awkward to change later: Windows keys taskbar pinning off
 * `appId`, and the OS keeps the registered URL handler for `protocolScheme`.
 *
 * `productName` has a slash in it, which is a path separator, so it can only
 * ever be printed. Anything that becomes a path uses `fileSafeName`.
 */
export const BRANDING = {
  /** Window titles, about box. Display only. */
  productName: 'NM/NEZ',
  /** Files, directories, installer artifacts. Keep in sync with electron-builder.yml. */
  fileSafeName: 'NM-NEZ',
  /** Log line prefix, e.g. `[NM] started`. */
  logPrefix: '[NM]',
  /** Reverse-DNS app id. Must match electron-builder's `appId`. */
  appId: 'com.nmnez.client',
  /** Custom URL scheme registered with the OS (`nmnez://...`). */
  protocolScheme: 'nmnez',
  /** Directory name under %APPDATA% for config and user assets. */
  userDataDirName: 'nmnez',
  /**
   * Folder names we've used before, oldest first.
   *
   * Renaming the product moves %APPDATA%, which orphans config, themes,
   * swapped assets and (the one that actually hurts) the logged-in Krunker
   * session, since that lives in Chromium's Local Storage under the same root.
   * Startup renames the newest match it finds.
   */
  legacyUserDataDirNames: ['krunker-client'],
} as const;

export type Branding = typeof BRANDING;
