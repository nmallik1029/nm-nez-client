# assets

Files that ship inside the app package, as opposed to `build/`, which is only
read by electron-builder while making the installer and never ends up in it.

`electron-builder.yml` lists this folder under `files`, so everything here is
packed into the asar. Main resolves it with `app.getAppPath()`, which is the
repo root in development and the asar in a build, so the same path works
either way and there is nothing to special-case. The exceptions are
`killstreak/` and `soundpacks/`, below, which are in the repo and not in the
package at all.

Keep it small. Every byte here is a byte on the installer that already weighs
109 MB, and anything large enough to notice belongs somewhere it can be
downloaded instead, which is exactly what `killstreak/` turned into, and
`soundpacks/` started as.

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

The kill streak packs anyone can install: 76 Valorant packs, one folder each,
listed in QoL Features under Built-in, Soundpacks, Edit, on the Valorant tab.

**Where they come from.** [Kingdom Archives](https://kingdomarchives.com/killbanners),
which has every skin line's kill banner at 1 to 6 kills and its kill sounds.
It does not keep the per-kill pictures as files: the page draws each one on a
300px canvas from layers (frame, ring, emblem, and one pip per kill) and its
Download button zips that canvas with the sound for that kill. So a pack's
banners are the page's own drawing, taken by loading
`killbanners?banner=<slug>` in a hidden browser, calling its `setKills(1..6)`,
and saving the canvas, which reproduces what the button gives to within a
rounding step. Its sounds are the page's `audio-1` to `audio-5` (or `-6`).

The first 29 were downloaded from it by hand, one Download per kill, and some
presses were at the wrong kill count, which put the wrong sound and picture on
that kill. Every pack here was checked in September 2026: each banner against
the page's drawing for its kill count (by where its pips are, so a colour
variant still matches), and each sound against the Valorant wiki's
[Kill Banners](https://valorant.fandom.com/wiki/Kill_Banners) files by audio
fingerprint. Bolt, EX.O, Neptune, VCT 2025 and Default had kills out of order,
now fixed, and a pack keeps the colour variant it was downloaded in.

Lines that are the same as another in every picture and every sound (an
episode re-release, mostly) are left out. Ayakashi has no kill pips on the
site, so it is one banner. Default's sixth sound is from the wiki; the site
has five.

Any pack changed here reaches people who already installed it: installed
packs carry the version they were downloaded at, and the client fetches any
that are behind at launch (`refreshKillPacks` in `src/main/killpack-install.ts`).

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

## soundpacks/

Other games' sounds, played in place of Krunker's own. One folder per game,
each a pack installed the way a kill streak pack is: listed in QoL Features
under Built-in, Soundpacks, Edit, with a tab each. There is one so far,
`fortnite/`.

**What the Fortnite pack is.** A shot sound for each of 77 Fortnite guns, the
hit marker and the headshot, each named by what it is (`heavy-sniper-rifle.ogg`,
`hit-critical.ogg`). The editor lists every Krunker gun that has a Fortnite
gun that fits, and the player picks one for each: the SCAR or the Heavy AR or
another for the Assault Rifle, the Bolt-Action or the Heavy Sniper for the
Sniper Rifle. Which Fortnite guns each Krunker gun offers, best fit first, is
`KRUNKER_GUNS` in `src/shared/soundpacks.ts`, and the best fit is the default.

**How it plays.** Krunker loads every sound from
`assets.krunker.io/sound/<key>.mp3`, and main answers that request with the
picked file instead, as the resource swapper does: so it plays where Krunker's
would have, placed in 3D for other people's shots, at Krunker's volume. A gun
is `weapon_<n>` and every skin's `weapon_<n>_<m>`, so the pick holds whatever
skin is on it. The hit marker is `hit_0`, and the headshot is both `crit_0`,
which Krunker plays for a shot that lands on the head, and `headshot_0`, for
a kill with one.

**Where they come from.** The [Fortnite wiki](https://fortnite.fandom.com/)'s
ripped game audio, which has each gun's firing sounds as separate files, named
like `Nemesis AR (Shooting - 01) - Weapon - Fortnite.ogg`. Each file here is
one close-range, first person shot of that gun, processed:

- the lead-in cut to 3 ms before the shot starts;
- automatic guns cut at the next shot inside the file, no shorter than 200 ms
  and no longer than 1.2 s, and single-shot guns at 2.5 s, each with a fade;
- levelled to the loudness of Krunker's own Assault Rifle over its first
  quarter second, the hit sounds by peak instead, so nothing is much louder
  or quieter than the game around it;
- encoded as Ogg Vorbis, and re-encoded quieter until it decodes without
  clipping.

The hit marker and headshot are Fortnite's older set, from before Chapter 7;
the wiki does not have the newer ones.

**Adding or changing a sound** is the same two commits as a kill streak pack:
change the folder and commit it, then `npm run packs:catalog` and commit what
it writes, which is `src/main/soundpack-catalog.json`. A new sound also needs
a name in `FORTNITE_SOUNDS` and a place in some gun's options, or
`src/main/soundpack-catalog.test.ts` fails: the pack and the editor have to
agree, so nothing is offered that is not there and nothing is downloaded that
nobody can pick. A pack in a folder of its own for another game needs its own
tab in `src/preload/qol/soundpacks-editor.ts`.

Like `killstreak/`, **this folder does not ship**: `electron-builder.yml`
leaves it out, and Install downloads it from here on GitHub into
`%APPDATA%\nmnez\soundpacks`, checked against the catalog. A change reaches
people who already installed it at their next launch, through the same
`refreshKillPacks`.

These are Epic Games' sounds, not ours, and the project's licence does not
cover them, the same as the Valorant packs.

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
