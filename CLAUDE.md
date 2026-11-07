# Riddles — personal puzzle app

Personal puzzle-generator web app for Jakob's Samsung Galaxy A26 5G. One user, no Play Store, no backend.

## Working mode

- **Every piece of work is a GitHub issue.** Development happens only through issues. The first prompt names the issue; its body is the brief, and the prompt may add context beyond it.
- **Every issue starts the same way, every time:** enter plan mode, then run the `grilling` skill (`/mattpocock-skills:grilling`) on the issue body plus any context from the prompt. Implementation starts only after Jakob approves the plan.
- **Iterations are the unit of work.** Each iteration is one issue labelled `iteration` with a task checklist and acceptance criteria. Pick the lowest-numbered open iteration whose blockers are closed, tick tasks off in the issue body as they are done, and record decisions or surprises as issue comments.
- **Scope lives in `docs/scope.md`.** If a requirement changes, update that file in the same session, not just the chat.
- **Open decisions** are listed at the bottom of `docs/scope.md`. Ask Jakob before resolving one on your own.
- Keep this file short. Record facts that cannot be derived from the code here; put everything else in `docs/`.

## Hard requirements (summary, details in docs/scope.md)

- Runs in the DuckDuckGo Android browser (Android system WebView). Use only broadly supported web standards, no Chrome-only APIs.
- Fully offline after the first load: service worker caches the app, saved games live in localStorage.
- English UI.
- Pen-and-paper feel: no automatic error marking, no auto candidates, no hints, check only on request.

## Technical decisions

- Stack: TypeScript, Vite, Preact. Puzzle generation runs in a Web Worker.
- Each puzzle type is a plugin: generator, solver, validator, board component. The shell never contains puzzle-specific logic.
- Every puzzle is reproducible from a seed plus difficulty.
- Machine has Node 18. No Java, no Android SDK; an APK wrap is the fallback only if the browser test in iteration 0 fails.

## Conventions

- Commit only when asked. Use small commits per task.
- Document generator algorithms in `docs/puzzles/<name>.md` when they are built, including how uniqueness and difficulty are guaranteed.

## Agent skills

### Issue tracker

Issues live in GitHub Issues of weber-knecht/riddles, one issue per iteration. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily. See `docs/agents/domain.md`.
