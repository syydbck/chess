import { useEffect, useMemo, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { Chess } from "chess.js";
import { GameArena } from "./GameArena";
import type {
  ChatMessage,
  HostRoomConfig,
  JoinRoomConfig,
  MoveRecord,
  SavedGame,
  Side,
  TimeControl,
  Winner,
} from "../types";
import { createId, oppositeSide, sideToLabel } from "../utils/clock";
import { saveGame } from "../utils/storage";

interface FriendRoomScreenProps {
  mode: "host" | "guest";
  hostConfig?: HostRoomConfig;
  joinConfig?: JoinRoomConfig;
  onBack: () => void;
  onOpenAnalysis: (gameId: string) => void;
}

type RoomSnapshot = {
  fen: string;
  turn: Side;
  status: "waiting" | "playing" | "ended";
  resultWinner: Winner;
  resultReason: string;
  moves: MoveRecord[];
  lastMoveUci?: string;
  whiteName: string;
  blackName: string;
  drawOfferBy: Side | null;
  clocks: {
    w: number;
    b: number;
  };
  initialMs: number;
  incrementMs: number;
  activeColor: Side | null;
  lastTickAt: number;
};

type NetworkMessage =
  | { type: "join"; name: string }
  | { type: "room-start"; snapshot: RoomSnapshot; guestSide: Side }
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "move"; uci: string }
  | { type: "chat"; message: ChatMessage }
  | { type: "draw-offer" }
  | { type: "draw-response"; accepted: boolean }
  | { type: "resign" }
  | { type: "error"; message: string };

const START_CHESS = new Chess();
const START_FEN = START_CHESS.fen();

const hostPeerId = (roomCode: string): string => {
  return `ch-${roomCode.toLowerCase()}`;
};

const applyUci = (game: Chess, uci: string) => {
  return game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: (uci[4] as "q" | "r" | "b" | "n") ?? "q",
  });
};

const determineHostSide = (preferredColor: HostRoomConfig["preferredColor"]): Side => {
  if (preferredColor === "white") {
    return "w";
  }
  if (preferredColor === "black") {
    return "b";
  }
  return Math.random() > 0.5 ? "w" : "b";
};

const getOutcomeFromChess = (game: Chess): { winner: Winner; reason: string } | null => {
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

const advanceClock = (snapshot: RoomSnapshot, now: number): RoomSnapshot => {
  if (snapshot.status !== "playing" || !snapshot.activeColor) {
    return snapshot;
  }

  const elapsed = now - snapshot.lastTickAt;
  if (elapsed <= 0) {
    return snapshot;
  }

  const color = snapshot.activeColor;
  const remaining = snapshot.clocks[color] - elapsed;
  const nextSnapshot: RoomSnapshot = {
    ...snapshot,
    clocks: {
      ...snapshot.clocks,
      [color]: Math.max(0, remaining),
    },
    lastTickAt: now,
  };

  if (remaining <= 0) {
    return {
      ...nextSnapshot,
      status: "ended",
      activeColor: null,
      resultWinner: sideToLabel(oppositeSide(color)),
      resultReason: "Flag",
    };
  }

  return nextSnapshot;
};

const appendUniqueMessage = (messages: ChatMessage[], message: ChatMessage): ChatMessage[] => {
  if (messages.some((entry) => entry.id === message.id)) {
    return messages;
  }
  return [...messages, message];
};

export const FriendRoomScreen = ({
  mode,
  hostConfig,
  joinConfig,
  onBack,
  onOpenAnalysis,
}: FriendRoomScreenProps) => {
  const isHost = mode === "host";
  const hostSideRef = useRef<Side>(hostConfig ? determineHostSide(hostConfig.preferredColor) : "w");

  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const snapshotRef = useRef<RoomSnapshot | null>(null);
  const localSideRef = useRef<Side>(isHost ? hostSideRef.current : "w");
  const savedRef = useRef(false);

  const [statusText, setStatusText] = useState("Initializing room...");
  const [error, setError] = useState<string | null>(null);
  const [localSide, setLocalSide] = useState<Side>(isHost ? hostSideRef.current : "w");
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const shareLink = useMemo(() => {
    if (!isHost || !hostConfig) {
      return "";
    }

    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("join", hostConfig.roomCode);
    return url.toString();
  }, [hostConfig, isHost]);

  const [snapshot, setSnapshot] = useState<RoomSnapshot>(() => {
    const initialMs = (hostConfig?.timeControl.initialMinutes ?? 5) * 60 * 1000;
    return {
      fen: START_FEN,
      turn: "w",
      status: "waiting",
      resultWinner: null,
      resultReason: "",
      moves: [],
      whiteName: isHost && hostSideRef.current === "w" ? hostConfig?.hostName ?? "Host" : "Waiting...",
      blackName: isHost && hostSideRef.current === "b" ? hostConfig?.hostName ?? "Host" : "Waiting...",
      drawOfferBy: null,
      clocks: { w: initialMs, b: initialMs },
      initialMs,
      incrementMs: (hostConfig?.timeControl.incrementSeconds ?? 3) * 1000,
      activeColor: null,
      lastTickAt: Date.now(),
    };
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const initialMessage: ChatMessage = {
      id: createId("system"),
      sender: "System",
      text: isHost
        ? `Room ${hostConfig?.roomCode ?? ""} created. Waiting for friend...`
        : `Connecting to room ${joinConfig?.roomCode ?? ""}...`,
      timestamp: Date.now(),
      system: true,
    };
    return [initialMessage];
  });

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    localSideRef.current = localSide;
  }, [localSide]);

  const sendMessage = (message: NetworkMessage) => {
    const connection = connectionRef.current;
    if (!connection || !connection.open) {
      return;
    }
    connection.send(message);
  };

  const addSystemMessage = (text: string) => {
    const message: ChatMessage = {
      id: createId("system"),
      sender: "System",
      text,
      timestamp: Date.now(),
      system: true,
    };
    setMessages((previous) => [...previous, message]);
    if (isHost) {
      sendMessage({ type: "chat", message });
    }
  };

  const createSavedRecord = (finalSnapshot: RoomSnapshot, chats: ChatMessage[]): SavedGame => {
    const timeControl: TimeControl = {
      initialMinutes: Math.max(1, Math.round(finalSnapshot.initialMs / 60000)),
      incrementSeconds: Math.round(finalSnapshot.incrementMs / 1000),
    };

    return {
      id: createId("game"),
      mode: "friend",
      createdAt: Date.now(),
      whiteName: finalSnapshot.whiteName,
      blackName: finalSnapshot.blackName,
      resultWinner: finalSnapshot.resultWinner,
      resultReason: finalSnapshot.resultReason,
      startFen: START_FEN,
      finalFen: finalSnapshot.fen,
      pgn: buildPgn(finalSnapshot.moves),
      moves: finalSnapshot.moves,
      chats,
      timeControl,
    };
  };

  const updateSnapshotAndBroadcast = (updater: (previous: RoomSnapshot) => RoomSnapshot) => {
    setSnapshot((previous) => {
      return updater(previous);
    });
  };

  const finalizeGame = (winner: Winner, reason: string) => {
    updateSnapshotAndBroadcast((previous) => ({
      ...previous,
      status: "ended",
      activeColor: null,
      resultWinner: winner,
      resultReason: reason,
      drawOfferBy: null,
    }));
  };

  const hostApplyMove = (uci: string, moverSide: Side): boolean => {
    let accepted = false;

    updateSnapshotAndBroadcast((previous) => {
      const current = advanceClock(previous, Date.now());

      if (current.status !== "playing") {
        return current;
      }
      if (current.turn !== moverSide) {
        return current;
      }

      const chess = new Chess(current.fen);
      const move = applyUci(chess, uci);
      if (!move) {
        return current;
      }

      accepted = true;

      const nextMove: MoveRecord = {
        ply: current.moves.length + 1,
        side: moverSide,
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion ?? ""}`,
        fenAfter: chess.fen(),
      };

      const outcome = getOutcomeFromChess(chess);
      return {
        ...current,
        fen: chess.fen(),
        turn: chess.turn(),
        moves: [...current.moves, nextMove],
        lastMoveUci: nextMove.uci,
        drawOfferBy: null,
        clocks: {
          ...current.clocks,
          [moverSide]: current.clocks[moverSide] + current.incrementMs,
        },
        activeColor: outcome ? null : (chess.turn() as Side),
        lastTickAt: Date.now(),
        status: outcome ? "ended" : "playing",
        resultWinner: outcome?.winner ?? null,
        resultReason: outcome?.reason ?? "",
      };
    });

    return accepted;
  };

  useEffect(() => {
    if (!isHost) {
      return;
    }

    if (!hostConfig) {
      setError("Host config missing.");
      return;
    }

    const peer = new Peer(hostPeerId(hostConfig.roomCode));
    peerRef.current = peer;

    peer.on("open", () => {
      setStatusText(`Room code: ${hostConfig.roomCode}`);
    });

    peer.on("connection", (connection) => {
      if (connectionRef.current && connectionRef.current.open) {
        connection.close();
        return;
      }

      connectionRef.current = connection;

      connection.on("open", () => {
        setStatusText("Friend connected");
      });

      connection.on("data", (raw) => {
        const message = raw as NetworkMessage;

        if (message.type === "join") {
          const hostSide = hostSideRef.current;
          const guestSide = oppositeSide(hostSide);
          const baseSnapshot = snapshotRef.current;
          if (!baseSnapshot) {
            return;
          }

          const startedSnapshot: RoomSnapshot = {
            ...baseSnapshot,
            status: "playing",
            turn: "w",
            activeColor: "w",
            lastTickAt: Date.now(),
            whiteName: hostSide === "w" ? hostConfig.hostName : message.name,
            blackName: hostSide === "b" ? hostConfig.hostName : message.name,
          };

          setLocalSide(hostSide);
          setSnapshot(startedSnapshot);
          connection.send({ type: "room-start", snapshot: startedSnapshot, guestSide });
          addSystemMessage(`${message.name} joined the room.`);
          return;
        }

        if (message.type === "move") {
          const guestSide = oppositeSide(hostSideRef.current);
          hostApplyMove(message.uci, guestSide);
          return;
        }

        if (message.type === "chat") {
          setMessages((previous) => appendUniqueMessage(previous, message.message));
          return;
        }

        if (message.type === "draw-offer") {
          updateSnapshotAndBroadcast((previous) => ({
            ...previous,
            drawOfferBy: oppositeSide(hostSideRef.current),
          }));
          return;
        }

        if (message.type === "draw-response") {
          if (message.accepted) {
            finalizeGame("draw", "Agreement");
          } else {
            updateSnapshotAndBroadcast((previous) => ({
              ...previous,
              drawOfferBy: null,
            }));
          }
          return;
        }

        if (message.type === "resign") {
          finalizeGame(sideToLabel(hostSideRef.current), "Resign");
        }
      });

      connection.on("close", () => {
        setStatusText("Connection closed");
        if (snapshotRef.current?.status === "playing") {
          finalizeGame(sideToLabel(hostSideRef.current), "Opponent disconnected");
        }
      });

      connection.on("error", () => {
        setError("Connection error.");
      });
    });

    peer.on("error", () => {
      setError("Room could not be created. Code may already be in use.");
    });

    return () => {
      connectionRef.current?.close();
      peer.destroy();
      peerRef.current = null;
      connectionRef.current = null;
    };
  }, [hostConfig, isHost]);

  useEffect(() => {
    if (isHost) {
      return;
    }
    if (!joinConfig) {
      setError("Join config missing.");
      return;
    }

    const peer = new Peer();
    peerRef.current = peer;

    peer.on("open", () => {
      const connection = peer.connect(hostPeerId(joinConfig.roomCode), { reliable: true });
      connectionRef.current = connection;

      connection.on("open", () => {
        setStatusText("Connected. Waiting for host start...");
        connection.send({ type: "join", name: joinConfig.guestName } as NetworkMessage);
      });

      connection.on("data", (raw) => {
        const message = raw as NetworkMessage;

        if (message.type === "room-start") {
          setLocalSide(message.guestSide);
          setSnapshot(message.snapshot);
          setStatusText("Game started");
          return;
        }

        if (message.type === "snapshot") {
          setSnapshot(message.snapshot);
          return;
        }

        if (message.type === "chat") {
          setMessages((previous) => appendUniqueMessage(previous, message.message));
          return;
        }

        if (message.type === "error") {
          setError(message.message);
        }
      });

      connection.on("close", () => {
        setStatusText("Disconnected from host");
        setSnapshot((previous) => {
          if (previous.status === "playing") {
            return {
              ...previous,
              status: "ended",
              activeColor: null,
              resultWinner: sideToLabel(localSideRef.current),
              resultReason: "Opponent disconnected",
            };
          }
          return previous;
        });
      });

      connection.on("error", () => {
        setError("Connection error.");
      });
    });

    peer.on("error", () => {
      setError("Failed to connect room.");
    });

    return () => {
      connectionRef.current?.close();
      peer.destroy();
      peerRef.current = null;
      connectionRef.current = null;
    };
  }, [isHost, joinConfig]);

  useEffect(() => {
    if (!isHost) {
      return;
    }

    const interval = window.setInterval(() => {
      setSnapshot((previous) => {
        return advanceClock(previous, Date.now());
      });
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [isHost]);

  useEffect(() => {
    if (!isHost) {
      return;
    }
    if (!connectionRef.current?.open) {
      return;
    }

    sendMessage({ type: "snapshot", snapshot });
  }, [isHost, snapshot]);

  useEffect(() => {
    if (snapshot.status !== "ended") {
      return;
    }
    if (savedRef.current) {
      return;
    }

    const game = createSavedRecord(snapshot, messages);
    saveGame(game);
    setSavedGameId(game.id);
    savedRef.current = true;
  }, [messages, snapshot]);

  const onMove = (uci: string): boolean => {
    if (snapshot.status !== "playing") {
      return false;
    }
    if (snapshot.turn !== localSide) {
      return false;
    }

    if (isHost) {
      return hostApplyMove(uci, localSide);
    }

    sendMessage({ type: "move", uci });
    return true;
  };

  const onSendChat = (text: string) => {
    const sender = isHost ? hostConfig?.hostName ?? "Host" : joinConfig?.guestName ?? "Guest";
    const message: ChatMessage = {
      id: createId("chat"),
      sender,
      text,
      timestamp: Date.now(),
      side: localSide,
    };

    setMessages((previous) => [...previous, message]);
    sendMessage({ type: "chat", message });
  };

  const onOfferDraw = () => {
    if (snapshot.status !== "playing") {
      return;
    }

    if (isHost) {
      setSnapshot((previous) => ({
        ...previous,
        drawOfferBy: localSide,
      }));
      return;
    }

    sendMessage({ type: "draw-offer" });
  };

  const onAcceptDraw = () => {
    if (isHost) {
      finalizeGame("draw", "Agreement");
      return;
    }
    sendMessage({ type: "draw-response", accepted: true });
  };

  const onDeclineDraw = () => {
    if (isHost) {
      setSnapshot((previous) => ({
        ...previous,
        drawOfferBy: null,
      }));
      return;
    }
    sendMessage({ type: "draw-response", accepted: false });
  };

  const onResign = () => {
    if (snapshot.status !== "playing") {
      return;
    }

    if (isHost) {
      finalizeGame(sideToLabel(oppositeSide(localSide)), "Resign");
      return;
    }

    sendMessage({ type: "resign" });
    setSnapshot((previous) => ({
      ...previous,
      status: "ended",
      activeColor: null,
      resultWinner: sideToLabel(oppositeSide(localSide)),
      resultReason: "Resign",
    }));
  };

  const copyRoomLink = async () => {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1400);
    }
  };

  const subtitle = snapshot.status === "waiting"
    ? statusText
    : snapshot.status === "playing"
      ? `${snapshot.turn === "w" ? snapshot.whiteName : snapshot.blackName} to move`
      : snapshot.resultReason;

  const resultText = snapshot.status === "ended"
    ? snapshot.resultWinner === "draw"
      ? `Draw - ${snapshot.resultReason}`
      : `${snapshot.resultWinner === "white" ? "White" : "Black"} won - ${snapshot.resultReason}`
    : subtitle;

  return (
    <div className="friend-room-wrap">
      {error ? <p className="error-banner">{error}</p> : null}

      {isHost && shareLink ? (
        <div className="card room-link-card">
          <p>Share this link with your friend:</p>
          <div className="share-link-row">
            <input readOnly value={shareLink} />
            <button type="button" className="btn subtle" onClick={copyRoomLink}>
              {copyState === "copied" ? "Copied" : copyState === "failed" ? "Failed" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}

      <GameArena
        title={isHost ? `Room ${hostConfig?.roomCode ?? ""}` : `Room ${joinConfig?.roomCode ?? ""}`}
        subtitle={subtitle}
        fen={snapshot.fen}
        orientation={localSide === "w" ? "white" : "black"}
        whiteName={snapshot.whiteName}
        blackName={snapshot.blackName}
        localSide={localSide}
        turn={snapshot.turn}
        status={snapshot.status}
        resultText={resultText}
        moves={snapshot.moves}
        chats={messages}
        canMove={snapshot.status === "playing" && snapshot.turn === localSide}
        clocks={snapshot.clocks}
        drawOfferBy={snapshot.drawOfferBy}
        onMove={onMove}
        onSendChat={onSendChat}
        onOfferDraw={onOfferDraw}
        onAcceptDraw={onAcceptDraw}
        onDeclineDraw={onDeclineDraw}
        onResign={onResign}
        onAnalyze={savedGameId ? () => onOpenAnalysis(savedGameId) : undefined}
        onBack={onBack}
        lastMoveUci={snapshot.lastMoveUci}
      />
    </div>
  );
};
