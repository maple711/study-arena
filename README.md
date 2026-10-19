# Study Arena

Obsidian plugin: pen-and-tablet practice with step-by-step feedback, plus interactive lessons, for Alexandre's Carleton courses.

## Installing on a new device
Copy `manifest.json`, `main.js`, `styles.css` and the `courses/` folder into `<vault>/.obsidian/plugins/study-arena/`, then enable **Study Arena** under Settings → Community plugins.

## Updating
Settings → Study Arena → Updates: set the GitHub repo (`owner/name`) once, then press **Update now**, run the command **Update Study Arena**, or tap the notice that appears on startup when a newer version is published. Progress (`data.json`) is never touched.

## Publishing a new version
1. Change the files and bump `version` in `manifest.json`.
2. `node tools/check-course.js` — must say "All good".
3. `node tools/build-release.js "what changed"` — rewrites `update.json`.
4. Commit and push. Devices pick it up on their next update check.

The repo must be **public** (the plugin downloads from raw.githubusercontent.com without signing in).
