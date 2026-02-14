# chess

Modern chess app with:
- Play vs AI (color, difficulty, clock + increment)
- Friend room mode (create/join, share link, draw offer, resign, room chat)
- Saved game dashboard
- Analysis page (left eval bar, move quality, best-move comparison, on-board positional overlays)

## Local Run

```bash
cd syyd-chess-v2
npm install
npm run dev
```

or from repo root:

```bash
npm run install:app
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages (Step by Step)

This repository already has a workflow file:

`.github/workflows/deploy-pages.yml`

Do this once:

1. Push all changes to `main`.
2. Open your repo on GitHub: `https://github.com/syydbck/chess`.
3. Go to `Settings` > `Pages`.
4. Under **Build and deployment**, set **Source** to `GitHub Actions`.
5. Go to `Actions` tab and open the `Deploy Pages` workflow run.
6. Wait until both jobs (`build`, `deploy`) are green.

Your live URL:

`https://syydbck.github.io/chess/`

Notes:
- New pushes to `main` redeploy automatically.
- Invite links use query param format: `?join=ROOMCODE`.
