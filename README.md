# Chess Analysis Platform

Educational chess platform focused on one core problem:
make engine evaluation understandable for humans.

This repository uses `syyd-chess-v2/` as the active app folder.

## Product Vision

- Play quickly (AI or Friend room).
- Save and revisit games.
- Analyze with engine score + explainable factor overlays.
- Keep engine truth intact and show explanatory breakdowns clearly.

## Current MVP

- AI game mode (color, level, clock, increment).
- Friend room flow (host/join, shareable room link, room chat, draw/resign).
- Dashboard with saved games and one-click analyze.
- Analysis page:
  - Eval bar (left side of board)
  - Move quality labels
  - Best-move comparison
  - On-board piece values and candidate move labels
  - Top engine lines
  - Engine-aligned factor breakdown

## Tech Stack

- React + TypeScript + Vite
- `chess.js` move legality and game state
- `react-chessboard` board rendering
- Stockfish API integration for evaluation and best moves

## Local Development

```bash
cd syyd-chess-v2
npm install
npm run dev
```

From repository root:

```bash
npm run install:app
npm run dev
```

## Build and Quality

```bash
npm run lint
npm run build
npm run preview
```

## Deployment (GitHub Pages)

Workflow file:

`.github/workflows/deploy-pages.yml`

Setup:

1. Push changes to `main`.
2. Open repo settings: `Settings > Pages`.
3. Set source to `GitHub Actions`.
4. Verify `Deploy Pages` workflow is green.

Live URL:

`https://syydbck.github.io/chess/`

## Contribution

For implementation-level contribution rules, see:

`syyd-chess-v2/README.md`

Core principle:

- Engine score is the source of truth.
- Explanatory overlays must be labeled and mathematically aligned.
