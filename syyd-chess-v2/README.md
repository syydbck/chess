# Syyd Chess v2

Lichess-inspired chess UX with an educational analysis layer.

## Why This Project Exists

Most chess tools show a single engine number.
This project focuses on showing *where that score may come from* in a way that is useful for learning.

## Design Principles

- Keep Stockfish evaluation as source of truth.
- Separate truth from explanation:
  - `Engine score`: exact
  - `Factor breakdown`: explanatory, engine-aligned estimate
- Prioritize fast interaction and clear board feedback.

## Features

- **Play vs AI**
  - side selection
  - difficulty levels
  - clock + increment
- **Play with Friend**
  - host/join room flow
  - shareable room links (`?join=ROOMCODE`)
  - draw offer / resign
  - room chat
- **Game History**
  - local saved games
  - analyze from dashboard
- **Analysis**
  - left-side eval bar
  - move quality labels
  - top engine lines
  - piece overlays on board
  - legal target dots + candidate score hints
  - engine-aligned factor breakdown

## Stack

- React + TypeScript + Vite
- `chess.js`
- `react-chessboard`
- External Stockfish evaluation API

## Project Structure

```text
src/
  components/
    AnalysisPage.tsx
    AnalysisOverlayBoard.tsx
    GameArena.tsx
    ChessBoardPanel.tsx
    ...
  utils/
    engine.ts         # eval + best move calls
    chessInsight.ts   # insights, factor model, top lines
    clock.ts
    storage.ts
  types/
    index.ts
```

## Getting Started

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## Contribution Workflow

1. Fork repository.
2. Create feature branch: `feature/<short-name>`.
3. Run `npm run lint && npm run build`.
4. Open PR with:
   - problem statement
   - before/after screenshots (if UI change)
   - test/validation notes

## Engineering Guidelines

- Keep UI text in English.
- Do not mix truth and estimated values without clear labels.
- Keep board interactions smooth (selection, legal targets, last move visibility).
- Avoid breaking persisted game data shape in `src/types/index.ts`.

## Roadmap (MVP -> Next)

- MultiPV-quality top line visualization
- Better mobile board ergonomics
- Optional local Stockfish/worker backend
- Deeper explanation metrics with stronger calibration

## Deployment

Vite base is configured for GitHub Pages:

`/chess/`

Deployment is handled by GitHub Actions workflow in the repository root.
