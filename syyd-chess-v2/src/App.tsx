import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { AiGameScreen } from "./components/AiGameScreen";
import { AiSetup } from "./components/AiSetup";
import { AnalysisPage } from "./components/AnalysisPage";
import { Dashboard } from "./components/Dashboard";
import { FriendRoomScreen } from "./components/FriendRoomScreen";
import { FriendSetup } from "./components/FriendSetup";
import type { AiConfig, HostRoomConfig, JoinRoomConfig, SavedGame } from "./types";
import { getGameById, loadGames, loadPlayerName, savePlayerName } from "./utils/storage";

type ScreenState =
  | { type: "dashboard" }
  | { type: "ai-setup" }
  | { type: "ai-game"; config: AiConfig }
  | { type: "friend-setup"; joinCode?: string }
  | { type: "friend-host"; config: HostRoomConfig }
  | { type: "friend-guest"; config: JoinRoomConfig }
  | { type: "analysis"; gameId: string };

const initialJoinCodeFromUrl = (): string | undefined => {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("join")?.trim().toUpperCase();
  if (!raw) {
    return undefined;
  }

  const cleaned = raw.replace(/[^A-Z0-9]/g, "").slice(0, 10);
  return cleaned || undefined;
};

function App() {
  const initialJoinCode = initialJoinCodeFromUrl();

  const [screen, setScreen] = useState<ScreenState>(
    initialJoinCode ? { type: "friend-setup", joinCode: initialJoinCode } : { type: "dashboard" }
  );
  const [playerName, setPlayerName] = useState(() => loadPlayerName());
  const [games, setGames] = useState<SavedGame[]>(() => loadGames());

  useEffect(() => {
    savePlayerName(playerName);
  }, [playerName]);

  const refreshGames = () => {
    setGames(loadGames());
  };

  const onOpenAnalysis = (gameId: string) => {
    refreshGames();
    setScreen({ type: "analysis", gameId });
  };

  const analysisGame = useMemo(() => {
    if (screen.type !== "analysis") {
      return null;
    }
    return getGameById(screen.gameId);
  }, [screen]);

  return (
    <div className="app-shell">
      {screen.type === "dashboard" ? (
        <Dashboard
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
          games={games}
          onStartAi={() => setScreen({ type: "ai-setup" })}
          onStartFriend={() => setScreen({ type: "friend-setup" })}
          onAnalyze={onOpenAnalysis}
        />
      ) : null}

      {screen.type === "ai-setup" ? (
        <AiSetup
          defaultName={playerName}
          onBack={() => setScreen({ type: "dashboard" })}
          onNameChange={setPlayerName}
          onStart={(config) => setScreen({ type: "ai-game", config })}
        />
      ) : null}

      {screen.type === "ai-game" ? (
        <AiGameScreen
          config={screen.config}
          onBack={() => {
            refreshGames();
            setScreen({ type: "dashboard" });
          }}
          onOpenAnalysis={onOpenAnalysis}
        />
      ) : null}

      {screen.type === "friend-setup" ? (
        <FriendSetup
          defaultName={playerName}
          initialJoinCode={screen.joinCode}
          onBack={() => setScreen({ type: "dashboard" })}
          onNameChange={setPlayerName}
          onHostStart={(config) => setScreen({ type: "friend-host", config })}
          onJoinStart={(config) => setScreen({ type: "friend-guest", config })}
        />
      ) : null}

      {screen.type === "friend-host" ? (
        <FriendRoomScreen
          mode="host"
          hostConfig={screen.config}
          onBack={() => {
            refreshGames();
            setScreen({ type: "dashboard" });
          }}
          onOpenAnalysis={onOpenAnalysis}
        />
      ) : null}

      {screen.type === "friend-guest" ? (
        <FriendRoomScreen
          mode="guest"
          joinConfig={screen.config}
          onBack={() => {
            refreshGames();
            setScreen({ type: "dashboard" });
          }}
          onOpenAnalysis={onOpenAnalysis}
        />
      ) : null}

      {screen.type === "analysis" ? (
        analysisGame ? (
          <AnalysisPage
            game={analysisGame}
            onBack={() => {
              refreshGames();
              setScreen({ type: "dashboard" });
            }}
          />
        ) : (
          <div className="card setup-root">
            <h2>Game not found</h2>
            <button type="button" className="btn primary" onClick={() => setScreen({ type: "dashboard" })}>
              Back to Dashboard
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}

export default App;
