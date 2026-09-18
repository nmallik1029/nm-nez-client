# assets

Files that ship inside the app package, as opposed to `build/`, which is only
read by electron-builder while making the installer and never ends up in it.

`electron-builder.yml` lists this folder under `files`, so everything here is
packed into the asar. Main resolves it with `app.getAppPath()`, which is the
repo root in development and the asar in a build, so the same path works
either way and there is nothing to special-case. The one exception is
`killstreak/`, below, which is in the repo and not in the package at all.

Keep it small. Every byte here is a byte on the installer that already weighs
109 MB, and anything large enough to notice belongs somewhere it can be
downloaded instead, which is exactly what `killstreak/` turned into.

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

The kill streak packs anyone can install: 59 Valorant packs, one folder each,
listed in QoL Features under Built-in, Kill streak sounds, Edit.

**Where they come from.** The first 29 came from a community userscript
builder (xWater's, on Asterea's template) as it stood in September 2025. The
rest, and every fix since, come from the Valorant wiki's
[Kill Banners](https://valorant.fandom.com/wiki/Kill_Banners) page, which has
every skin line's kill sounds as `<Line> Kill <n>.mp3` and one banner each.
Its files are fetched through the wiki's API with `format=original` (without
it the banners come back as WebP under a `.png` name) and checked against the
SHA-1 the API gives.

That builder named each kill's file by hand, and some names were wrong. Every
sound here was matched against the wiki's by audio fingerprint in September
2026: Bolt, EX.O, Neptune and VCT 2025 were playing some kills' sounds on the
wrong kill (a kill repeated, the next one missing) and are back in order, with
the two sounds they never had taken from the wiki. Default has its sixth. Any
pack changed here reaches people who already installed it: installed packs
carry the version they were downloaded at, and the client fetches any that
are behind at launch (`refreshKillPacks` in `src/main/killpack-install.ts`).

A wiki banner is one picture for every kill, where the first 29 have a frame
per kill. They are cropped to the emblem and scaled to fill the same share of
a 300px canvas as those frames do, so the grid reads as one set.

A pack is a folder named by its id (lowercase letters, digits and hyphens,
nothing else) holding `<id>_1.mp3` for the first kill, `<id>_2.mp3` for the
second and so on, an optional `<id>_N.png` banner beside each, and an optional
`pack.json` of `{"name": "Shown Name"}`. Numbering stops at the first gap. The
rules are in `src/shared/killstreak.ts` and `src/main/killsounds.ts`.

**This folder does not ship.** `electron-builder.yml` leaves it out of the
package, and it is not in the no-installer update either. The client knows the
packs by name from `src/main/killstreak-catalog.json`, and when somebody
presses Install on one it downloads that pack from this folder on GitHub,
checks every file against the catalog's size and SHA-512, and puts it in
`%APPDATA%\nmnez\killstreak`. It plays straight away, and the x on its tile
deletes it again. `src/main/killpack-install.ts` is all of that.

0.1.53 to 0.1.59 did ship the folder, 34 MB on every install whether anyone
used a pack or not. Updating from one of those clears it out, and anyone who
had kill streaks on gets the pack they were using fetched back on its own.

**Adding or changing a pack** is two commits:

1. Change the folder here and commit it.
2. Run `npm run packs:catalog`, which rewrites the catalog, and commit that.

The catalog points at the commit that last touched this folder, not at `main`,
so clients already out there keep finding exactly the files they were built to
expect however this folder changes later. That is also why the script refuses
while the folder has uncommitted changes: the commit it would point at would
not have them. Forget step 2 and `src/main/killstreak-catalog.test.ts` fails,
because the catalog no longer matches the folder byte for byte. Amend or
rebase the pack commit after step 2 and it fails too, because the catalog
then names a commit that is not in the history; that one needs the full
history, so it runs in preflight and is skipped on CI's single-commit
checkout. The pack commit has to reach GitHub before anyone can install from
it, which a merged PR takes care of, since branches here are merged rather
than squashed.

Anyone can still add their own in `%APPDATA%\nmnez\swap\sounds\killstreak`. One
there with the same id as an installed pack replaces it whole: its own sounds,
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
