# Riddles

A personal puzzle app for one phone. It generates Sudoku, Binairo and Nonogram puzzles with exactly one solution and lets you solve them the way you would on paper: no hints, no automatic error marks, check only when you ask.

Live app: https://weber-knecht.github.io/riddles/

It is a static web app (TypeScript, Vite, Preact) installed as a PWA. There is no backend. After the first load it runs fully offline; saved games live in the browser's localStorage.

## Install on the phone

1. Open https://weber-knecht.github.io/riddles/ in Chrome for Android while online.
2. Chrome menu (⋮), "Add to Home screen", then "Install".
3. Start the app from the home screen. From now on it works in airplane mode.

When a new version has been deployed, the app shows "A new version is available." with a Reload button the next time it is opened or brought back to the foreground while online. Nothing changes until you tap Reload. The menu footer shows the running version and build time.

DuckDuckGo is not supported: its data clearing removes the service worker, so offline use cannot be guaranteed there.

## Development

Requires Node 22 (see `.nvmrc`; with fnm: `fnm use`).

| Command | What it does |
|---------|--------------|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:5173/riddles/ |
| `npm test` | Unit tests of the puzzle logic and storage (Vitest) |
| `npm run build` | Type-check and build into `dist/` |
| `npm run preview` | Serve the built app at http://localhost:4173/riddles/ |
| `npm run format` | Format with Prettier |

### End-to-end smoke test

`tools/e2e-smoke.mjs` drives the built app in a headless Chromium at phone size over the Chrome DevTools Protocol. It needs no extra dependencies. It always tests the last build, so build first:

```sh
npm run build
npx vite preview --port 4174 --strictPort &
chromium --headless=new --disable-gpu --no-sandbox --remote-debugging-port=9223 \
         --user-data-dir=$HOME/snap/chromium/common/riddles-e2e about:blank &
node tools/e2e-smoke.mjs http://localhost:4174/riddles/ 9223
```

It prints one PASS or FAIL line per check, closes the browser when done and exits non-zero on a failure. Stop the preview server afterwards. The user data directory above is for the snap build of Chromium, which can only write inside `~/snap/chromium/common`; any writable directory works for other builds.

### Benchmark page

Opening the app with `?bench` (https://weber-knecht.github.io/riddles/?bench) generates ten hard puzzles per puzzle type and size on the device and lists the average and slowest time. Version 1 targets less than two seconds for the slowest one on the phone.

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`: install, `npm test`, `npm run build`, then publish `dist/` to GitHub Pages. A failing test stops the deploy. The phone picks the new build up through the update banner.

Releases are annotated git tags (`v1.0.0`). The version number comes from `package.json`.

## Documentation

- [docs/scope.md](docs/scope.md): what the app does and does not do, and the decisions behind it
- [docs/architecture.md](docs/architecture.md): plugin contract, worker, storage, screens, offline behaviour
- [docs/puzzles/](docs/puzzles/): how each generator works and how uniqueness and difficulty are guaranteed
- [design/README.md](design/README.md): the "printed puzzle book" design, with one reference artboard per screen in `design/project/`
- [CLAUDE.md](CLAUDE.md): working mode for development with Claude Code

Work is tracked as GitHub issues, one per iteration.
