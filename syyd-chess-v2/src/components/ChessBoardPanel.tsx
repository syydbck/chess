import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from "react-chessboard";

interface ChessBoardPanelProps {
  fen: string;
  orientation: "white" | "black";
  canMove: boolean;
  onMove: (uci: string) => boolean;
  lastMoveUci?: string;
}

type PromotionRequest = {
  from: string;
  to: string;
  color: "w" | "b";
};

const promotionChoices = ["q", "r", "b", "n"] as const;

const promotionIcons: Record<PromotionRequest["color"], Record<(typeof promotionChoices)[number], string>> = {
  w: { q: "♕", r: "♖", b: "♗", n: "♘" },
  b: { q: "♛", r: "♜", b: "♝", n: "♞" },
};

const toUci = (move: { from: string; to: string; promotion?: string }): string => {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
};

const parseLastMoveSquares = (uci: string | undefined): { from: string; to: string } | null => {
  if (!uci || uci.length < 4) {
    return null;
  }
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
};

const isCaptureMove = (move: { flags: string }): boolean => move.flags.includes("c") || move.flags.includes("e");

export const ChessBoardPanel = ({
  fen,
  orientation,
  canMove,
  onMove,
  lastMoveUci,
}: ChessBoardPanelProps) => {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [captureTargets, setCaptureTargets] = useState<string[]>([]);
  const [promotionRequest, setPromotionRequest] = useState<PromotionRequest | null>(null);
  const promotionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedSquare(null);
    setTargets([]);
    setCaptureTargets([]);
    setPromotionRequest(null);
  }, [fen]);

  useEffect(() => {
    if (!promotionRequest) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPromotionRequest(null);
        setSelectedSquare(null);
        setTargets([]);
        setCaptureTargets([]);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (!promotionRef.current) {
        return;
      }
      if (!promotionRef.current.contains(event.target as Node)) {
        setPromotionRequest(null);
        setSelectedSquare(null);
        setTargets([]);
        setCaptureTargets([]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [promotionRequest]);

  const clearSelection = () => {
    setSelectedSquare(null);
    setTargets([]);
    setCaptureTargets([]);
  };

  const setSelectionFromSquare = (square: string, game: Chess) => {
    const legalMoves = game.moves({ square: square as Square, verbose: true });
    const captureSquares = legalMoves.filter(isCaptureMove).map((move) => move.to);
    const emptySquares = legalMoves.filter((move) => !isCaptureMove(move)).map((move) => move.to);

    setSelectedSquare(square);
    setTargets(emptySquares);
    setCaptureTargets(captureSquares);
  };

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
        backgroundImage: "radial-gradient(circle, rgba(0, 0, 0, 0.25) 0 28%, transparent 29%)",
      };
    }

    for (const square of captureTargets) {
      styles[square] = {
        backgroundImage: "radial-gradient(circle, transparent 0 62%, rgba(0, 0, 0, 0.25) 62% 82%, transparent 83%)",
      };
    }

    return styles;
  }, [lastMoveUci, selectedSquare, targets, captureTargets]);

  const tryMove = (from: string, to: string, promotion?: "q" | "r" | "b" | "n"): boolean => {
    const game = new Chess(fen);
    const move = game.move({
      from,
      to,
      promotion,
    });

    if (!move) {
      return false;
    }

    const accepted = onMove(toUci(move));
    if (accepted) {
      clearSelection();
      setPromotionRequest(null);
    }
    return accepted;
  };

  const onPieceDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (!canMove || !targetSquare || promotionRequest) {
      return false;
    }

    const game = new Chess(fen);
    const legalMoves = game.moves({ square: sourceSquare as Square, verbose: true });
    const matchingMoves = legalMoves.filter((move) => move.to === targetSquare);

    if (matchingMoves.length === 0) {
      return false;
    }

    const requiresPromotion = matchingMoves.some((move) => Boolean(move.promotion));
    if (requiresPromotion) {
      setSelectionFromSquare(sourceSquare, game);
      const piece = game.get(sourceSquare as Square);
      const color = piece?.color ?? game.turn();
      setPromotionRequest({ from: sourceSquare, to: targetSquare, color });
      return false;
    }

    return tryMove(sourceSquare, targetSquare);
  };

  const onPieceDrag = ({ square }: PieceHandlerArgs) => {
    if (!canMove || promotionRequest || !square) {
      return;
    }

    const game = new Chess(fen);
    const piece = game.get(square as Square);
    if (!piece || piece.color !== game.turn()) {
      return;
    }

    if (selectedSquare === square) {
      return;
    }

    setSelectionFromSquare(square, game);
  };

  const handlePromotionChoice = (promotion: (typeof promotionChoices)[number]) => {
    if (!promotionRequest) {
      return;
    }

    const { from, to } = promotionRequest;
    const accepted = tryMove(from, to, promotion);
    if (!accepted) {
      setPromotionRequest(null);
    }
  };

  const onSquareClick = ({ square }: SquareHandlerArgs) => {
    if (!canMove || promotionRequest) {
      return;
    }

    const game = new Chess(fen);
    const piece = game.get(square as Square);

    if (selectedSquare) {
      if (square === selectedSquare) {
        clearSelection();
        return;
      }

      const legalMoves = game.moves({ square: selectedSquare as Square, verbose: true });
      const matchingMoves = legalMoves.filter((move) => move.to === square);
      if (matchingMoves.length > 0) {
        const requiresPromotion = matchingMoves.some((move) => Boolean(move.promotion));
        if (requiresPromotion) {
          const selectedPiece = game.get(selectedSquare as Square);
          const color = selectedPiece?.color ?? game.turn();
          setPromotionRequest({ from: selectedSquare, to: square, color });
          return;
        }

        const moved = tryMove(selectedSquare, square);
        if (moved) {
          return;
        }
      }

      if (piece && piece.color === game.turn()) {
        setSelectionFromSquare(square, game);
        return;
      }

      clearSelection();
      return;
    }

    if (!piece || piece.color !== game.turn()) {
      return;
    }

    setSelectionFromSquare(square, game);
  };

  return (
    <div className="board-shell">
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          allowDragging: canMove && !promotionRequest,
          allowDragOffBoard: false,
          dragActivationDistance: 0,
          animationDurationInMs: 120,
          onPieceDrop,
          onPieceDrag,
          onSquareClick,
          squareStyles: highlightStyles,
          squareRenderer: ({ square, children }) => {
            const isPromotionTarget = promotionRequest?.to === square;
            const pickerColor = promotionRequest?.color ?? "w";

            return (
              <div className="board-square-overlay">
                {children}
                {isPromotionTarget ? (
                  <div
                    ref={promotionRef}
                    className={`promotion-picker ${pickerColor === "w" ? "promotion-picker--white" : "promotion-picker--black"}`}
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    {promotionChoices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        className="promotion-choice"
                        onClick={(event) => {
                          event.stopPropagation();
                          handlePromotionChoice(choice);
                        }}
                      >
                        {promotionIcons[pickerColor][choice]}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          },
        }}
      />
    </div>
  );
};
