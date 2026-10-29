# content

`client.json` is what the team publishes to every client: who wears which
badge, and the settings library in the Presets tab.

**Every client reads it from `main` when it starts**, so an edit here reaches
everyone at their next launch, with no release. It comes from GitHub, or
jsDelivr on networks that block GitHub. A client that can reach neither uses
the last copy it fetched, and a fresh install uses the copy its release was
built with.

Editing it on `main` is publishing it. Check it is valid JSON before you push:
a broken file is ignored, and clients keep their last good copy.

## Badges

```json
"badges": {
  "players": [
    { "name": "SomeCreator", "badges": ["cc"] },
    { "name": "SomeTester", "badges": ["beta"] }
  ],
  "clans": [
    { "tag": "Fame", "badges": ["clan"] }
  ]
}
```

- `name` is the Krunker name exactly as the game shows it (case does not
  matter). `tag` is a clan tag without its brackets.
- Each badge id is a picture in `assets/badges/`, without the extension, so
  `cc` is `assets/badges/cc.png`. **The pictures ship with the client**: a
  new kind of badge needs a release with its picture in it before anyone can
  see it. Giving an existing badge to someone new does not.
- Three badges each at most. These add to the lists in `src/shared/badges.ts`;
  someone in both gets both.

The badges there are pictures for: `cc` (content creator), `beta` (beta
user), `pro`, `owner`, and `nack` and `kpc` (which the Pro picks use as the
two servers' icons, and work as badges too). A badge with no picture says so
once in the console.

## Pro picks (the settings library)

Each pick is one entry in `settings`. A tournament placement:

```json
{
  "id": "kpc-autumn-2026-someplayer",
  "name": "SomePlayer",
  "date": "2026-10-25",
  "placement": 2,
  "region": "EU",
  "event": "KPC Autumn Cup",
  "screenshot": "kpc-autumn-2026-someplayer.jpg",
  "settings": { "fov": 120, "shadows": false }
}
```

Pro settings posted outside a tournament:

```json
{
  "id": "someplayer-2026-10",
  "name": "SomePlayer",
  "date": "2026-10-28",
  "pro": true,
  "screenshot": "someplayer-2026-10.jpg",
  "settings": { "fov": 120 }
}
```

| Field | | |
|---|---|---|
| `id` | required | Lowercase letters, numbers, `-` and `_`. Never change it once published. |
| `name` | required | The player, as the pick is titled. |
| `date` | required | When they were posted, `YYYY-MM-DD`. The list is newest first. |
| `settings` | required | What Export in Krunker's settings gives you (the whole `settings.txt`), pasted in as it is. |
| `placement` | | `1`, `2` or `3`: a gold, silver or bronze background. Leave it out for settings that did not place. |
| `region` | | `NA` (shown as NACK) or `EU` (shown as KPC), the scene it placed in, as that server's icon. |
| `pro` | | `true` for pro settings: the pro badge. Works with a placement too, for both. |
| `event` | | The tournament's name. |
| `description` | | A line about the settings. |
| `author` | | Who posted them, if not the player. |
| `screenshot` | | A file in `screenshots/`: an in-game screenshot with these settings, PNG, JPEG or WEBP, under 3 MB. 16:9 fills the frame. |

- A pick missing a required field, or with a date that is not a real day, is
  dropped by every client without a word. `npm run verify` checks this file
  and says which picks would be dropped, and which screenshots are missing:
  run it before you push.
- Picks open on hover to show the screenshot, the placement, region and date,
  and Apply. Closed, they show only the name, the badges and the colour.
- The marks are badge pictures: `assets/badges/pro.png` for pro,
  `assets/badges/nack.png` and `assets/badges/kpc.png` for the two servers'
  icons. Until a picture ships, its tag (PRO, NACK, KPC) is shown instead.
- `customize` (loadouts, custom reticles, favourites) is always dropped: the
  library never touches anyone's loadouts. Anything else the settings leave
  out is reset to Krunker's default when someone applies them, the same as
  Krunker's own Import.
- Applying a pick keeps whatever the player's Keep switches say, which is
  their own sensitivity, sounds and keybinds unless they turn that off.
