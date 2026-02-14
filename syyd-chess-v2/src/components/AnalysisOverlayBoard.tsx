import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { SquareHandlerArgs } from "react-chessboard";
import { calculatePositionBreakdown, calculatePositionBreakdownAligned } from "../utils/chessInsight";

interface AnalysisOverlayBoardProps {
  fen: string;
  orientation: "white" | "black";
  lastMoveUci?: string;
  targetDiffPawns?: number | null;
}

const parseLastMoveSquares = (uci: string | undefined): { from: string; to: string } | null => {
  if (!uci || uci.length < 4) {
    return null;
  }
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
};

const formatDelta = (value: number): string => {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
};

export const AnalysisOverlayBoard = ({ fen, orientation, lastMoveUci, targetDiffPawns }: AnalysisOverlayBoardProps) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
  }, [fen]);

  const breakdown = useMemo(
    () => calculatePositionBreakdownAligned(fen, targetDiffPawns),
    [fen, targetDiffPawns]
  );
  const rawBreakdown = useMemo(() => calculatePositionBreakdown(fen), [fen]);

  const pieceScoresBySquare = useMemo(() => {
    const entries: Record<string, number> = {};
    for (const piece of breakdown.whitePieces) {
      entries[piece.square] = piece.total;
    }
    for (const piece of breakdown.blackPieces) {
      entries[piece.square] = piece.total;
    }
    return entries;
  }, [breakdown.blackPieces, breakdown.whitePieces]);

  const candidateScores = useMemo(() => {
    if (!selectedSquare) {
      return {} as Record<string, string>;
    }

    const baseDiff = rawBreakdown.whiteTotal - rawBreakdown.blackTotal;
    const game = new Chess(fen);
    const selectedPiece = game.get(selectedSquare as Square);

    if (!selectedPiece) {
      return {} as Record<string, string>;
    }

    const legalMoves = game.moves({ square: selectedSquare as Square, verbose: true });
    const ranked: Array<{ to: string; delta: number }> = [];

    for (const move of legalMoves) {
      const next = new Chess(fen);
      next.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? "q",
      });

      const nextBreakdown = calculatePositionBreakdown(next.fen());
      const nextDiff = nextBreakdown.whiteTotal - nextBreakdown.blackTotal;
      ranked.push({ to: move.to, delta: nextDiff - baseDiff });
    }

    ranked.sort((a, b) => {
      if (selectedPiece.color === "w") {
        return b.delta - a.delta;
      }
      return a.delta - b.delta;
    });

    const top = ranked.slice(0, 3);
    const nextScores: Record<string, string> = {};
    for (const entry of top) {
      nextScores[entry.to] = formatDelta(entry.delta);
    }

    return nextScores;
  }, [fen, rawBreakdown.blackTotal, rawBreakdown.whiteTotal, selectedSquare]);

  const targetSquares = useMemo(() => {
    if (!selectedSquare) {
      return [];
    }
    const game = new Chess(fen);
    return game.moves({ square: selectedSquare as Square, verbose: true }).map((move) => move.to);
  }, [fen, selectedSquare]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};

    const lastMove = parseLastMoveSquares(lastMoveUci);
    if (lastMove) {
      styles[lastMove.from] = {
        backgroundColor: "rgba(166, 226, 146, 0.42)",
        animation: "lastMoveFromFade 900ms ease-out",
      };
      styles[lastMove.to] = {
        backgroundColor: "rgba(82, 168, 89, 0.58)",
        boxShadow: "inset 0 0 0 9999px rgba(82, 168, 89, 0.18)",
        animation: "lastMoveToPulse 980ms ease-out",
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = { backgroundColor: "rgba(84, 126, 196, 0.45)" };
    }

    for (const square of targetSquares) {
      styles[square] = {
        backgroundImage: "radial-gradient(circle, rgba(119, 214, 141, 0.5) 0 18%, rgba(119, 214, 141, 0.08) 19%, transparent 46%)",
      };
    }

    return styles;
  }, [lastMoveUci, selectedSquare, targetSquares]);

  const handleSquareClick = ({ square }: SquareHandlerArgs) => {
    const game = new Chess(fen);
    const piece = game.get(square as Square);

    if (!piece) {
      setSelectedSquare(null);
      return;
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    setSelectedSquare(square);
  };

  return (
    <div className="board-shell analysis-board-shell">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: false,
          onSquareClick: handleSquareClick,
          squareStyles,
          squareRenderer: ({ piece, square, children }) => {
            const pieceValue = piece ? pieceScoresBySquare[square] : undefined;
            const candidate = candidateScores[square];

            return (
              <div className="analysis-square-overlay">
                {children}
                {pieceValue !== undefined ? (
                  <span className="piece-value-badge">{pieceValue.toFixed(1)}</span>
                ) : null}
                {candidate ? <span className="candidate-badge">{candidate}</span> : null}
              </div>
            );
          },
        }}
      />
    </div>
  );
};

