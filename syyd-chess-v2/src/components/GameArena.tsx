import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { ChatMessage, MoveRecord, Side } from "../types";
import { formatClock } from "../utils/clock";
import { ChessBoardPanel } from "./ChessBoardPanel";

interface GameArenaProps {
  title: string;
  subtitle: string;
  fen: string;
  orientation: "white" | "black";
  whiteName: string;
  blackName: string;
  localSide: Side;
  turn: Side;
  status: "waiting" | "playing" | "ended";
  resultText: string;
  moves: MoveRecord[];
  chats: ChatMessage[];
  canMove: boolean;
  lastMoveUci?: string;
  clocks?: {
    w: number;
    b: number;
  };
  drawOfferBy?: Side | null;
  onMove: (uci: string) => boolean;
  onSendChat: (text: string) => void;
  onOfferDraw?: () => void;
  onAcceptDraw?: () => void;
  onDeclineDraw?: () => void;
  onResign: () => void;
  onAnalyze?: () => void;
  onBack: () => void;
}

const sideClass = (turn: Side, side: Side): string => {
  return turn === side ? "player-card active" : "player-card";
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const GameArena = ({
  title,
  subtitle,
  fen,
  orientation,
  whiteName,
  blackName,
  localSide,
  turn,
  status,
  resultText,
  moves,
  chats,
  canMove,
  lastMoveUci,
  clocks,
  drawOfferBy = null,
  onMove,
  onSendChat,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  onResign,
  onAnalyze,
  onBack,
}: GameArenaProps) => {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats.length]);

  const moveRows = useMemo(() => {
    const rows: Array<{ moveNumber: number; white?: MoveRecord; black?: MoveRecord }> = [];
    for (let index = 0; index < moves.length; index += 2) {
      rows.push({
        moveNumber: Math.floor(index / 2) + 1,
        white: moves[index],
        black: moves[index + 1],
      });
    }
    return rows;
  }, [moves]);

  const drawOfferFromOpponent = drawOfferBy !== null && drawOfferBy !== localSide;

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) {
      return;
    }
    onSendChat(trimmed);
    setChatInput("");
  };

  const statusLabel = status === "ended" ? resultText : subtitle;

  return (
    <div className="arena-root">
      <div className="arena-header">
        <div>
          <h2>{title}</h2>
          <p>{statusLabel}</p>
        </div>
        <button type="button" className="btn subtle" onClick={onBack}>
          Dashboard
        </button>
      </div>

      <div className="arena-grid">
        <section className="board-panel">
          <div className={sideClass(turn, "b")}>
            <div>
              <strong>{blackName}</strong>
              <span>Black</span>
            </div>
            {clocks ? <strong>{formatClock(clocks.b)}</strong> : null}
          </div>

          <ChessBoardPanel
            fen={fen}
            orientation={orientation}
            canMove={canMove}
            onMove={onMove}
            lastMoveUci={lastMoveUci}
          />

          <div className={sideClass(turn, "w")}>
            <div>
              <strong>{whiteName}</strong>
              <span>White</span>
            </div>
            {clocks ? <strong>{formatClock(clocks.w)}</strong> : null}
          </div>

          <div className="arena-controls">
            {onOfferDraw ? (
              <button
                type="button"
                className="btn subtle"
                onClick={onOfferDraw}
                disabled={status !== "playing" || drawOfferBy === localSide}
              >
                Offer Draw
              </button>
            ) : null}

            {drawOfferFromOpponent ? (
              <>
                <button type="button" className="btn primary" onClick={onAcceptDraw}>
                  Accept Draw
                </button>
                <button type="button" className="btn subtle" onClick={onDeclineDraw}>
                  Decline
                </button>
              </>
            ) : null}

            <button
              type="button"
              className="btn danger"
              onClick={onResign}
              disabled={status !== "playing"}
            >
              Resign
            </button>

            {status === "ended" && onAnalyze ? (
              <button type="button" className="btn primary" onClick={onAnalyze}>
                Analyze Game
              </button>
            ) : null}
          </div>
        </section>

        <section className="side-panel">
          <div className="card move-card">
            <div className="card-header">
              <h3>Moves</h3>
            </div>
            <div className="moves-table">
              {moveRows.length === 0 ? <p className="empty-line">No moves yet.</p> : null}
              {moveRows.map((row) => (
                <div className="move-row" key={row.moveNumber}>
                  <span className="move-index">{row.moveNumber}.</span>
                  <span>{row.white?.san ?? ""}</span>
                  <span>{row.black?.san ?? ""}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card chat-card">
            <div className="card-header">
              <h3>Room Chat</h3>
            </div>
            <div className="chat-list">
              {chats.length === 0 ? <p className="empty-line">No messages yet.</p> : null}
              {chats.map((message) => (
                <div key={message.id} className={message.system ? "chat-item system" : "chat-item"}>
                  <div className="chat-meta">
                    <strong>{message.sender}</strong>
                    <span>{formatTimestamp(message.timestamp)}</span>
                  </div>
                  <p>{message.text}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-form" onSubmit={handleChatSubmit}>
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Type a message"
                maxLength={220}
              />
              <button type="submit" className="btn primary">
                Send
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
};
