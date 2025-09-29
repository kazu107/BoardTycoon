# Repository Guidelines

## Project Structure & Module Organization
- `index.html` houses markup, styles, and gameplay logic for the Board Tycoon prototype. Sections are already annotated (Board, Sidebar, Dialogs, Script); keep new code within the matching comment block.
- `.idea/` contains WebStorm settings. Leave user-specific files untracked.
- Create future modules under `src/` and mirror the current layout (`src/board`, `src/ui`). Place shared constants in `src/config/`.

## Build, Test, and Development Commands
- `npm install` prepares the workspace for adding linters or bundlers; it will generate `package-lock.json`.
- `npx http-server .` (or WebStorm Local Development Server) serves the static app at `http://localhost:8080` so dynamic asset paths stay relative to the repo root.
- `npm test` is a placeholder and exits with code 1; replace it once automated tests land.

## Coding Style & Naming Conventions
- Keep 4-space indentation across HTML, CSS, and embedded JS. Use single quotes in JS and maintain CSS custom properties under `:root`.
- Name constants in `UPPER_SNAKE_CASE`, mutable variables in `camelCase`, and DOM nodes with a role suffix (`boardEl`, `forkDialog`).
- When scripts move into modules, run `npx eslint --fix` with the default config and ensure formatting stays Prettier-compatible.

## Testing Guidelines
- Perform manual smoke tests in Chromium and Firefox: render the board, move each pawn through forks, and validate chance/tax tile effects.
- Add automated coverage with Playwright or Vitest once modules exist; target >80% coverage for movement, tile typing, and dialog flows.
- Store specs as `tests/<feature>.spec.ts` and wire them into a future `npm test` script.

## Commit & Pull Request Guidelines
- Follow Conventional Commits in present tense (`feat(board): add fork navigation cues`). Keep scope names aligned with feature areas (`board`, `sidebar`, `ai`).
- For pull requests, include a summary, before/after screenshots or GIFs, manual test notes, and linked issue IDs.
- Rebase on `main` before review and confirm the static build runs cleanly via `npx http-server .`.
