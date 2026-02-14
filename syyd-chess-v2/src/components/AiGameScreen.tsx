import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { GameArena } from "./GameArena";
import type { AiConfig, ChatMessage, MoveRecord, SavedGame, Side, Winner } from "../types";
import { aiLevelToDepth, aiLevelToThinkDelayMs, getBestMoveForPosition } from "../utils/engine";
import { createId, oppositeSide, sideToLabel } from "../utils/clock";
import { saveGame } from "../utils/storage";

interface AiGameScreenProps {
  config: AiConfig;
  onBack: () => void;
  onOpenAnalysis: (gameId: string) => void;
}

type LiveState = {
  fen: string;
  turn: Side;
  status: "playing" | "ended";
  resultWinner: Winner;
  resultReason: string;
  moves: MoveRecord[];
  lastMoveUci?: string;
  clocks: {
    w: number;
    b: number;
  };
  initialMs: number;
  incrementMs: number;
  activeColor: Side | null;
  lastTickAt: number;
};

const START_CHESS = new Chess();
const START_FEN = START_CHESS.fen();

const sideName = (side: Side): string => {
  return side === "w" ? "White" : "Black";
};

const applyUci = (game: Chess, uci: string) => {
  return game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: (uci[4] as "q" | "r" | "b" | "n") ?? "q",
  });
};

const resolveGameOutcome = (game: Chess): { winner: Winner; reason: string } | null => {
  if (!game.isGameOver()) {
    return null;
  }

  if (game.isCheckmate()) {
    return {
      winner: game.turn() === "w" ? "black" : "white",
      reason: "Checkmate",
    };
  }

  if (game.isStalemate()) {
    return {
      winner: "draw",
      reason: "Stalemate",
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      winner: "draw",
      reason: "Threefold repetition",
    };
  }

  if (game.isInsufficientMaterial()) {
    return {
      winner: "draw",
      reason: "Insufficient material",
    };
  }

  return {
    winner: "draw",
    reason: "Draw",
  };
};

const buildPgn = (moves: MoveRecord[]): string => {
  const game = new Chess();
  for (const move of moves) {
    applyUci(game, move.uci);
  }
  return game.pgn();
};

const advanceClock = (state: LiveState, now: number): LiveState => {
  if (state.status !== "playing" || !state.activeColor) {
    return state;
  }

  const elapsed = now - state.lastTickAt;
  if (elapsed <= 0) {
    return state;
  }

  const color = state.activeColor;
  const remaining = state.clocks[color] - elapsed;
  const updated: LiveState = {
    ...state,
    clocks: {
      ...state.clocks,
      [color]: Math.max(0, remaining),
    },
    lastTickAt: now,
  };

  if (remaining <= 0) {
    return {
      ...updated,
      status: "ended",
      activeColor: null,
      resultWinner: sideToLabel(oppositeSide(color)),
      resultReason: "Flag",
    };
  }

  return updated;
};

export const AiGameScreen = ({ config, onBack, onOpenAnalysis }: AiGameScreenProps) => {
  const aiSide: Side = config.playerSide === "w" ? "b" : "w";
  const aiName = useMemo(() => `AI Lv${config.aiLevel}`, [config.aiLevel]);

  const [state, setState] = useState<LiveState>(() => {
    const initialMs = config.timeControl.initialMinutes * 60 * 1000;
    return {
      fen: START_FEN,
      turn: "w",
      status: "playing",
      resultWinner: null,
      resultReason: "",
      moves: [],
      clocks: { w: initialMs, b: initialMs },
      initialMs,
      incrementMs: config.timeControl.incrementSeconds * 1000,
      activeColor: "w",
      lastTickAt: Date.now(),
    };
  });

  const [isThinking, setIsThinking] = useState(false);
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const savedRef = useRef(false);
  const thinkCycleRef = useRef(0);

  useEffect(() => {
    setChats([
      {
        id: createId("system"),
        sender: "System",
        text: `Game started. You are ${sideName(config.playerSide)}.`,
        timestamp: Date.now(),
        system: true,
      },
    ]);
  }, [config.playerSide]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setState((previous) => advanceClock(previous, Date.now()));
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const appendChat = (message: ChatMessage) => {
    setChats((previous) => [...previous, message]);
  };

  const finalize = (winner: Winner, reason: string) => {
    setState((previous) => ({
      ...previous,
      status: "ended",
      activeColor: null,
      resultWinner: winner,
      resultReason: reason,
    }));
  };

  const tryApplyMove = (uci: string, mover: Side): boolean => {
    let accepted = false;

    setState((previous) => {
      const current = advanceClock(previous, Date.now());
      if (current.status !== "playing") {
        return current;
      }
      if (current.turn !== mover) {
        return current;
      }

      const game = new Chess(current.fen);
      const move = applyUci(game, uci);
      if (!move) {
        return current;
      }

      accepted = true;
      const moveRecord: MoveRecord = {
        ply: current.moves.length + 1,
        side: mover,
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion ?? ""}`,
        fenAfter: game.fen(),
      };

      const outcome = resolveGameOutcome(game);

      return {
        ...current,
        fen: game.fen(),
        turn: game.turn(),
        moves: [...current.moves, moveRecord],
        lastMoveUci: moveRecord.uci,
        clocks: {
          ...current.clocks,
          [mover]: current.clocks[mover] + current.incrementMs,
        },
        activeColor: outcome ? null : (game.turn() as Side),
        lastTickAt: Date.now(),
        status: outcome ? "ended" : "playing",
        resultWinner: outcome?.winner ?? null,
        resultReason: outcome?.reason ?? "",
      };
    });

    return accepted;
  };

  useEffect(() => {
    if (state.status !== "playing") {
      return;
    }
    if (state.turn !== aiSide) {
      return;
    }
    if (isThinking) {
      return;
    }

    const cycleId = thinkCycleRef.current + 1;
    thinkCycleRef.current = cycleId;
    const depth = aiLevelToDepth(config.aiLevel);
    const wait = aiLevelToThinkDelayMs(config.aiLevel);
    const maxThinkMs = 1200 + config.aiLevel * 350;

    const think = async () => {
      setIsThinking(true);

      try {
        const bestMove = await Promise.race<string | null>([
          getBestMoveForPosition(state.fen, depth),
          new Promise<null>((resolve) => {
            window.setTimeout(() => resolve(null), maxThinkMs);
          }),
        ]);
        if (thinkCycleRef.current !== cycleId) {
          return;
        }

        let selectedMove = bestMove;
        if (!selectedMove) {
          const fallbackGame = new Chess(state.fen);
          const fallback = fallbackGame.moves({ verbose: true })[0];
          selectedMove = fallback ? `${fallback.from}${fallback.to}${fallback.promotion ?? ""}` : null;
        }

        if (selectedMove) {
          tryApplyMove(selectedMove, aiSide);
        }
      } catch {
        if (thinkCycleRef.current === cycleId) {
          appendChat({
            id: createId("system"),
            sender: "System",
            text: "AI request failed. Try again.",
            timestamp: Date.now(),
            system: true,
          });
        }
      } finally {
        if (thinkCycleRef.current === cycleId) {
          setIsThinking(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void think();
    }, wait);

    return () => {
      window.clearTimeout(timer);
    };
  }, [aiSide, config.aiLevel, isThinking, state.fen, state.status, state.turn]);

  useEffect(() => {
    if (state.status !== "ended") {
      return;
    }
    if (savedRef.current) {
      return;
    }

    const whiteName = config.playerSide === "w" ? config.playerName : aiName;
    const blackName = config.playerSide === "b" ? config.playerName : aiName;

    const record: SavedGame = {
      id: createId("game"),
      mode: "ai",
      createdAt: Date.now(),
      whiteName,
      blackName,
      resultWinner: state.resultWinner,
      resultReason: state.resultReason,
      timeControl: config.timeControl,
      startFen: START_FEN,
      finalFen: state.fen,
      pgn: buildPgn(state.moves),
      moves: state.moves,
      chats,
    };

    saveGame(record);
    setSavedGameId(record.id);
    savedRef.current = true;
  }, [aiName, chats, config.playerName, config.playerSide, config.timeControl, state.fen, state.moves, state.resultReason, state.resultWinner, state.status]);

  const onPlayerMove = (uci: string): boolean => {
    if (config.playerSide !== state.turn) {
      return false;
    }
    if (isThinking) {
      return false;
    }
    return tryApplyMove(uci, config.playerSide);
  };

  const onSendChat = (text: string) => {
    appendChat({
      id: createId("chat"),
      sender: config.playerName,
      text,
      timestamp: Date.now(),
      side: config.playerSide,
    });
  };

  const resign = () => {
    if (state.status !== "playing") {
      return;
    }
    finalize(sideToLabel(oppositeSide(config.playerSide)), "Resign");
  };

  const subtitle = state.status === "playing"
    ? state.turn === config.playerSide
      ? "Your turn"
      : `${aiName} to move`
    : state.resultReason;

  const resultText = state.status === "ended"
    ? state.resultWinner === "draw"
      ? `Draw - ${state.resultReason}`
      : `${state.resultWinner === "white" ? "White" : "Black"} won - ${state.resultReason}`
    : subtitle;

  return (
    <GameArena
      title="AI Match"
      subtitle={subtitle}
      fen={state.fen}
      orientation={config.playerSide === "w" ? "white" : "black"}
      whiteName={config.playerSide === "w" ? config.playerName : aiName}
      blackName={config.playerSide === "b" ? config.playerName : aiName}
      localSide={config.playerSide}
      turn={state.turn}
      status={state.status === "ended" ? "ended" : "playing"}
      resultText={resultText}
      moves={state.moves}
      chats={chats}
      canMove={state.status === "playing" && state.turn === config.playerSide && !isThinking}
      clocks={state.clocks}
      onMove={onPlayerMove}
      onSendChat={onSendChat}
      onResign={resign}
      onAnalyze={savedGameId ? () => onOpenAnalysis(savedGameId) : undefined}
      onBack={onBack}
      lastMoveUci={state.lastMoveUci}
    />
  );
};
