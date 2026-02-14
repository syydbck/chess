import type { SavedGame } from "../types";

interface DashboardProps {
  playerName: string;
  games: SavedGame[];
  onPlayerNameChange: (next: string) => void;
  onStartAi: () => void;
  onStartFriend: () => void;
  onAnalyze: (gameId: string) => void;
}

const formatGameDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

const modeLabel = (mode: SavedGame["mode"]): string => {
  return mode === "ai" ? "AI" : "Friend Room";
};

const winnerLabel = (game: SavedGame): string => {
  if (game.resultWinner === "draw") {
    return `Draw (${game.resultReason})`;
  }
  if (game.resultWinner === "white") {
    return `${game.whiteName} won (${game.resultReason})`;
  }
  if (game.resultWinner === "black") {
    return `${game.blackName} won (${game.resultReason})`;
  }
  return game.resultReason;
};

export const Dashboard = ({
  playerName,
  games,
  onPlayerNameChange,
  onStartAi,
  onStartFriend,
  onAnalyze,
}: DashboardProps) => {
  return (
    <div className="dashboard-root">
      <header className="hero-panel">
        <div>
          <p className="hero-kicker">Syyd Chess Lab</p>
          <h1>Play, Review, Improve</h1>
          <p>
            AI mode, friend rooms, saved games and analysis with board-level positional overlays.
          </p>
        </div>
        <div className="name-box">
          <label htmlFor="player-name">Your Name</label>
          <input
            id="player-name"
            value={playerName}
            onChange={(event) => onPlayerNameChange(event.target.value)}
            maxLength={24}
          />
        </div>
      </header>

      <section className="mode-grid">
        <article className="mode-card">
          <h2>Play vs AI</h2>
          <p>Set color, level, clock and increment, then start instantly.</p>
          <button type="button" className="btn primary" onClick={onStartAi}>
            Play vs AI
          </button>
        </article>

        <article className="mode-card">
          <h2>Play with Friend</h2>
          <p>Create or join a room, configure time control and share a direct invite link.</p>
          <button type="button" className="btn primary" onClick={onStartFriend}>
            Play with Friend
          </button>
        </article>
      </section>

      <section className="history-panel card">
        <div className="card-header">
          <h2>Game History</h2>
          <span>{games.length} saved games</span>
        </div>

        {games.length === 0 ? (
          <p className="empty-line">No games saved yet. Finish a game and it will appear here.</p>
        ) : (
          <div className="history-grid">
            {games.map((game) => (
              <article key={game.id} className="history-card">
                <header>
                  <strong>{game.whiteName}</strong>
                  <span>vs</span>
                  <strong>{game.blackName}</strong>
                </header>
                <p>{winnerLabel(game)}</p>
                <div className="history-meta">
                  <span>{modeLabel(game.mode)}</span>
                  <span>{formatGameDate(game.createdAt)}</span>
                </div>
                <button type="button" className="btn subtle" onClick={() => onAnalyze(game.id)}>
                  Analyze
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
