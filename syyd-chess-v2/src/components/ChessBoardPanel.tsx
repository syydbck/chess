import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";

interface ChessBoardPanelProps {
  fen: string;
  orientation: "white" | "black";
  canMove: boolean;
  onMove: (uci: string) => boolean;
  lastMoveUci?: string;
}

const toUci = (move: { from: string; to: string; promotion?: string }): string => {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
};

const parseLastMoveSquares = (uci: string | undefined): { from: string; to: string } | null => {
  if (!uci || uci.length < 4) {
    return null;
  }
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
};

export const ChessBoardPanel = ({
  fen,
  orientation,
  canMove,
  onMove,
  lastMoveUci,
}: ChessBoardPanelProps) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);

  useEffect(() => {
    setSelectedSquare(null);
    setTargets([]);
  }, [fen]);

  const highlightStyles = useMemo(() => {
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

    for (const square of targets) {
      styles[square] = {
        backgroundImage: "radial-gradient(circle, rgba(119, 214, 141, 0.52) 0 18%, rgba(119, 214, 141, 0.08) 19%, transparent 46%)",
      };
    }

    return styles;
  }, [lastMoveUci, selectedSquare, targets]);

  const tryMove = (from: string, to: string): boolean => {
    const game = new Chess(fen);
    const move = game.move({
      from,
      to,
      promotion: "q",
    });

    if (!move) {
      return false;
    }

    const accepted = onMove(toUci(move));
    if (accepted) {
      setSelectedSquare(null);
      setTargets([]);
    }
    return accepted;
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!canMove || !targetSquare) {
      return false;
    }
    return tryMove(sourceSquare, targetSquare);
  };

  const onSquareClick = ({ square }: SquareHandlerArgs) => {
    if (!canMove) {
      return;
    }

    const game = new Chess(fen);

    if (selectedSquare) {
      if (square === selectedSquare) {
        setSelectedSquare(null);
        setTargets([]);
        return;
      }

      const moved = tryMove(selectedSquare, square);
      if (moved) {
        return;
      }
    }

    const piece = game.get(square as Square);
    if (!piece || piece.color !== game.turn()) {
      return;
    }

    const legalTargets = game
      .moves({ square: square as Square, verbose: true })
      .map((move) => move.to);

    setSelectedSquare(square);
    setTargets(legalTargets);
  };

  return (
    <div className="board-shell">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: canMove,
          allowDragOffBoard: false,
          dragActivationDistance: 0,
          animationDurationInMs: 120,
          onPieceDrop,
          onSquareClick,
          squareStyles: highlightStyles,
        }}
      />
    </div>
  );
};
