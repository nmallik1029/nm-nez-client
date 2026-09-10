# Releasing

Getting a change from `main` into people's clients. Takes about five minutes,
most of which is CI building.

**Merging a PR does not release anything.** Commits on `main` sit there until
someone cuts a release. Nobody's client sees them until a version tag exists.

## The steps

```bash
# 1. Start from current main. Two of us push to this repo; if you skip this
#    you will end up merging mid-release, which is a mess.
git switch main
git pull

# 2. Add your entry to the TOP of src/shared/changelog.ts.
#    See "Writing the entry" below. The version has to be the one you are
#    about to release, so decide it now.

# 3. Check it before CI does.
npm run verify

# 4. Commit the changelog on its own.
git add -A
git commit -m "changelog for 0.1.4"

# 5. Bump and tag. This is npm, not git. It edits package.json AND creates
#    the v0.1.4 tag in one go.
npm version patch

# 6. Push the commits and the tag.
git push --follow-tags
```

That's it. The `Release` workflow picks up the tag, builds on Windows,
publishes a GitHub release titled `NM/NEZ 0.1.4` with your changelog as the
notes, and uploads the installer plus `latest.yml`.

Anyone running an installed client gets a prompt within about eight seconds of
their next launch.

## Writing the entry

Newest at the top of the array. Nothing is ever deleted; the list is the
release history and the client renders it as a collapsible panel.

```ts
export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '0.1.4',            // must match what npm version produces
    date: '2026-09-11',
    changes: [
      { kind: 'added', text: 'Short sentence about the thing.' },
      {
        kind: 'fixed',
        text: 'Longer ones go on their own lines; there is no line-length rule.',
      },
    ],
  },
  // every previous version stays below, untouched
];
```

`kind` is `'added' | 'changed' | 'fixed'` and nothing else. TypeScript rejects
anything else, which is the good kind of failure.

Write it for whoever is running the client, not for us. Refactors, CI fixes and
test changes are real work but invisible to them, and a changelog they read
after an update is better for having only things they can actually notice.

## Which number to bump

| Command | Use it for |
|---|---|
| `npm version patch` | fixes, small features. Almost always this one. |
| `npm version minor` | something big enough that you would tell someone about it |
| `npm version major` | don't, not yet |

## Things that will catch you out

**`npm version`, not `git version`.** `git version patch` prints the git
version and does nothing else. It looks like it worked.

**`--follow-tags`, not plain `git push`.** A plain push sends commits but not
tags, and the tag is the entire trigger. If nothing happens after you push,
this is why: check `git tag -l` against the tags on GitHub.

**The tag has to match the changelog.** The workflow generates the release
notes from the entry matching the tag, and it does that *before* building. Tag
`v0.1.4` with no `0.1.4` entry and the run fails with
`no changelog entry for 0.1.4`. That is deliberate: better a failed run than a
published release with an empty body.

**Don't add a changelog entry ahead of the bump.** The in-game version
watermark reads the newest changelog entry, so an entry sitting there for an
unreleased version makes the HUD claim a version nobody is running. Add it as
part of the release, which is why it's step 2 and not something you do earlier.

**`npm version` needs a clean working tree.** Commit or stash first. It refuses
otherwise, which is why the changelog gets its own commit in step 4.

## Checking it worked

- Actions tab: a `Release` run for your tag, green.
- Releases: `NM/NEZ 0.1.4`, not a draft, with **four** assets. `latest.yml` is
  the one that matters; without it no installed client can find the update.
- Your own client should prompt you on next launch.

## Who actually gets the update

Only people who installed via **`NM-NEZ-x.y.z-Setup.exe`**. The portable exe
has no install directory to replace, so it cannot update itself, and the
settings tab tells those users as much.

Anyone on a build from before the updater existed (0.1.0) also has to install
once by hand. There's no way around that: a build can only update itself if it
already contains the updater.

## If you need to undo one

Deleting a release and its tag is fine as long as nobody has updated to it yet.
Delete the release on GitHub first, then:

```bash
git push --delete origin v0.1.4
git tag -d v0.1.4
```

Once someone has installed it, don't. Ship `0.1.5` with the fix instead. Going
backwards means their client sees a lower version than it's running and offers
them nothing.
