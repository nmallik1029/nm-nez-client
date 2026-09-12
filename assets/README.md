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

## sky-*.png

The map scenes the sky editor previews a colour against. `sky-sandstorm.png`
is labelled "Sandstorm": the name comes off the filename, so adding a scene is
dropping a file in here and nothing else.

Each one is a screenshot of a real map **with the sky cut out of it**:
transparent where the sky was, and part-transparent where the map's own fog
had already blended the distance into it. The editor puts the chosen colour
behind the picture, so the horizon tints along with the sky the way it does in
game, and changing the colour costs nothing: no canvas, no per-pixel work,
just a background colour under a PNG.

Making one:

1. Play the map with the client's sky colour set to something no map contains
   (magenta is ideal) and take a screenshot. Keying against a colour the
   scenery shares is what makes the buildings go see-through.
2. Cut the sky to transparent. A flood fill from the top edge, rather than
   "every pixel of that colour", keeps a wall of the same shade opaque.
3. Scale it to around 640px wide and save as PNG. The preview box is 600px
   across, and the file has to earn its place in the installer.

Missing files are not an error. With none of these the editor shows a plain
block of the colour, which is what it did before the scenes existed.
