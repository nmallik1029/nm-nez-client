# assets

Files that ship inside the app package, as opposed to `build/`, which is only
read by electron-builder while making the installer and never ends up in it.

`electron-builder.yml` lists this folder under `files`, so everything here is
packed into the asar. Main resolves it with `app.getAppPath()`, which is the
repo root in development and the asar in a build, so the same path works
either way and there is nothing to special-case.

Keep it small. Every byte here is a byte on the installer that already weighs
109 MB, and anything large enough to notice belongs somewhere it can be
downloaded instead.

## match-found.mp3

Played when the ranked queue finds you a game.

Drop an mp3 in beside this file with exactly that name. It ships with the
client, so anyone who installs or updates gets it without having to find a
folder, which is the whole reason it lives here and not in `swap/`.

A few seconds at most, and quiet. It plays over whatever you were doing.

Anyone who would rather use their own can still put one at
`%APPDATA%\nmnez\swap\sounds\match-found.mp3`; that takes precedence and this
one is the fallback. With neither, the queue is silent and nothing breaks.
