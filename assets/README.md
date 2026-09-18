# assets

Files that ship inside the app package, as opposed to `build/`, which is only
read by electron-builder while making the installer and never ends up in it.

`electron-builder.yml` lists this folder under `files`, so everything here is
packed into the asar. Main resolves it with `app.getAppPath()`, which is the
repo root in development and the asar in a build, so the same path works
either way and there is nothing to special-case. The one exception is
`killstreak/`, below.

Keep it small. Every byte here is a byte on the installer that already weighs
109 MB, and anything large enough to notice belongs somewhere it can be
downloaded instead. `killstreak/` is the deliberate exception, and why is
written down with it.

## match-found.mp3

Played when the ranked queue finds you a game.

Drop an mp3 in beside this file with exactly that name. It ships with the
client, so anyone who installs or updates gets it without having to find a
folder, which is the whole reason it lives here and not in `swap/`.

A few seconds at most, and quiet. It plays over whatever you were doing.

Anyone who would rather use their own can still put one at
`%APPDATA%\nmnez\swap\sounds\match-found.mp3`; that takes precedence and this
one is the fallback. With neither, the queue is silent and nothing breaks.

## killstreak/

The kill streak packs everyone gets: 29 Valorant packs, one folder each,
picked from in QoL Features under Built-in.

A pack is a folder named by its id (lowercase letters, digits and hyphens,
nothing else) holding `<id>_1.mp3` for the first kill, `<id>_2.mp3` for the
second and so on, an optional `<id>_N.png` banner beside each, and an optional
`pack.json` of `{"name": "Shown Name"}`. Numbering stops at the first gap. The
rules are in `src/shared/killstreak.ts` and `src/main/killsounds.ts`. Adding
one to the client is dropping a folder in here.

**This folder is not in the asar.** `electron-builder.yml` leaves it out of
`files` and copies it to `resources/killstreak` with `extraResources`, and
main finds it through `process.resourcesPath` (`bundledKillPacks` in
`src/main/paths.ts`). The page loads the audio in byte ranges, and Electron can
only open a file inside an asar for that by copying it out to a temp file
first.

**Why it ships at all, at about 34 MB.** The same reason as the match sound:
until this, kill streak sounds only played for someone who had found the packs
somewhere and knew which folder to put them in. They are 320 kbps mp3 and PNG,
which do not compress, so the installer grows by about what the folder weighs.

Anyone can still add their own in `%APPDATA%\nmnez\swap\sounds\killstreak`. One
there with the same id as a pack here replaces it whole: its own sounds,
banners and name, never a mix of the two.

These are Riot Games' sounds and art from Valorant, not ours, and the
project's licence does not cover them. They are here the way they are in the
community scripts they came from, as a fan-made extra for a free game.

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

## badges/

Badges that appear beside a name on the two scoreboards: the running one in
the corner of a match, and the one at the end of it.

Two steps, and one of them is dropping a file in here.

1. Put the picture in `assets/badges/`. **The file name is the badge's id**,
   so `owner.png` is the badge called `owner`. PNG, GIF and WEBP are read;
   anything else in the folder is ignored, as is anything over 1 MB. A file
   that misses that says so in the console rather than going quiet.
2. Hand it to someone in `src/shared/badges.ts`, in the two lists at the
   bottom of that file. By name:

       { name: 'PvlseFN', badges: ['owner'] },

   or to a whole clan by tag:

       { tag: 'Bnto', badges: ['clan'] },

   Three badges each at most, and a person's own come before their clan's.

Size them square and small. They are drawn at the height of the name they sit
beside, about 20px on the in-match board and 17px at the end of a match, which
is the same size as Krunker's own mark, so 64x64 is already more than enough:
over twice the drawn size for a high-DPI screen, and a couple of KB. Anything
past that is detail nobody will see, on an installer that already weighs
109 MB. Transparent background, since they sit straight on the board.

A badge given to someone with no file behind it draws nothing and says so once
in the console, so a typo in an id is quiet rather than broken.

These are ours, not Krunker's: they show for everyone running this client and
for nobody else.
