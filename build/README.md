# build resources

Put the app icon here as **`icon.ico`**.

That one file covers everything: the exe, the installer and uninstaller, the Start menu
and desktop shortcuts, and the window and taskbar icon when you run `npm start`.

## Making the .ico

It needs to contain a **256x256** layer or electron-builder refuses to build. Include the
smaller sizes too, because Windows picks whichever fits the context and will otherwise
scale your 256 down to 16 for the taskbar, which looks rough on a pixel-art icon.

A good set of layers: 256, 128, 64, 48, 32, 16.

If you'd rather not deal with .ico files, drop a square **`icon.png`** here instead, at
512x512 or larger. electron-builder converts it at package time. The conversion is fine
for a photographic or soft-edged icon and worse for pixel art, since it has no way to know
you wanted nearest-neighbour when it scales down.

## Optional extras

electron-builder falls back to `icon.ico` for all of these, so only add one if you want it
to differ:

| File | Used for |
|---|---|
| `installerIcon.ico` | the installer window |
| `uninstallerIcon.ico` | the uninstaller |
| `installerHeader.bmp` | 150x57 header on the installer pages |
| `installerSidebar.bmp` | 164x314 panel on the welcome and finish pages |

The two bitmaps have to be genuine `.bmp` at exactly those dimensions. NSIS will not
scale them and will not tell you why it looks wrong.

## Linux icons

The Linux build can't use the .ico. electron-builder only takes PNGs there, and if it finds
nothing else it tries to convert `icon.ico` and fails the build. So `icons/` holds one PNG per
size, named `WIDTHxHEIGHT.png`: the layers of `icon.ico`, taken out one by one rather than
scaled, so the hand-made small sizes survive. `icons/256x256.png` is also the window icon at
runtime on Linux.

Change `icon.ico` and these need redoing. Any tool that can export an .ico's layers as PNGs
will do; for example, with Python and Pillow:

```python
from PIL import Image
ico = Image.open('build/icon.ico')
for size in ico.info['sizes']:
    ico.ico.getimage(size).save(f'build/icons/{size[0]}x{size[1]}.png')
```

## A note on the name

The icon is the one bit of branding that doesn't come from `src/shared/branding.ts`, since
it's a binary. If you rename the client, these files don't follow.
