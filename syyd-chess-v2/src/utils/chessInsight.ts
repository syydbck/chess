import { Chess } from "chess.js";
import type {
  EngineTopLine,
  FactorBreakdownItem,
  MoveRecord,
  MoveInsight,
  PieceContribution,
  PieceValuePhase,
  PositionBreakdown,
  Side,
} from "../types";
import { evaluatePosition, qualityFromLoss } from "./engine";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

type SquareTable = number[];

const PIECE_BASE_VALUE: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const pstPawn: SquareTable = [
  0, 0, 0, 0, 0, 0, 0, 0,
  5, 5, 5, -5, -5, 5, 5, 5,
  1, 1, 2, 3, 3, 2, 1, 1,
  0.5, 0.5, 1, 2.5, 2.5, 1, 0.5, 0.5,
  0, 0, 0, 2, 2, 0, 0, 0,
  0.5, -0.5, -1, 0, 0, -1, -0.5, 0.5,
  0.5, 1, 1, -2, -2, 1, 1, 0.5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const pstKnight: SquareTable = [
  -5, -4, -3, -3, -3, -3, -4, -5,
  -4, -2, 0, 0, 0, 0, -2, -4,
  -3, 0, 1, 1.5, 1.5, 1, 0, -3,
  -3, 0.5, 1.5, 2, 2, 1.5, 0.5, -3,
  -3, 0, 1.5, 2, 2, 1.5, 0, -3,
  -3, 0.5, 1, 1.5, 1.5, 1, 0.5, -3,
  -4, -2, 0, 0.5, 0.5, 0, -2, -4,
  -5, -4, -3, -3, -3, -3, -4, -5,
];

const pstBishop: SquareTable = [
  -2, -1, -1, -1, -1, -1, -1, -2,
  -1, 0, 0, 0, 0, 0, 0, -1,
  -1, 0, 0.5, 1, 1, 0.5, 0, -1,
  -1, 0.5, 0.5, 1, 1, 0.5, 0.5, -1,
  -1, 0, 1, 1, 1, 1, 0, -1,
  -1, 1, 1, 1, 1, 1, 1, -1,
  -1, 0.5, 0, 0, 0, 0, 0.5, -1,
  -2, -1, -1, -1, -1, -1, -1, -2,
];

const pstRook: SquareTable = [
  0, 0, 0, 0.5, 0.5, 0, 0, 0,
  -0.5, 0, 0, 0, 0, 0, 0, -0.5,
  -0.5, 0, 0, 0, 0, 0, 0, -0.5,
  -0.5, 0, 0, 0, 0, 0, 0, -0.5,
  -0.5, 0, 0, 0, 0, 0, 0, -0.5,
  -0.5, 0, 0, 0, 0, 0, 0, -0.5,
  0.5, 1, 1, 1, 1, 1, 1, 0.5,
  0, 0, 0, 0, 0, 0, 0, 0,
];

const pstQueen: SquareTable = [
  -2, -1, -1, -0.5, -0.5, -1, -1, -2,
  -1, 0, 0, 0, 0, 0, 0, -1,
  -1, 0, 0.5, 0.5, 0.5, 0.5, 0, -1,
  -0.5, 0, 0.5, 0.5, 0.5, 0.5, 0, -0.5,
  0, 0, 0.5, 0.5, 0.5, 0.5, 0, -0.5,
  -1, 0.5, 0.5, 0.5, 0.5, 0.5, 0, -1,
  -1, 0, 0.5, 0, 0, 0, 0, -1,
  -2, -1, -1, -0.5, -0.5, -1, -1, -2,
];

const pstKingMiddlegame: SquareTable = [
  -3, -4, -4, -5, -5, -4, -4, -3,
  -3, -4, -4, -5, -5, -4, -4, -3,
  -3, -4, -4, -5, -5, -4, -4, -3,
  -3, -4, -4, -5, -5, -4, -4, -3,
  -2, -3, -3, -4, -4, -3, -3, -2,
  -1, -2, -2, -2, -2, -2, -2, -1,
  2, 2, 0, 0, 0, 0, 2, 2,
  2, 3, 1, 0, 0, 1, 3, 2,
];

const pstKingEndgame: SquareTable = [
  -5, -4, -3, -2, -2, -3, -4, -5,
  -3, -2, -1, 0, 0, -1, -2, -3,
  -3, -1, 2, 3, 3, 2, -1, -3,
  -3, -1, 3, 4, 4, 3, -1, -3,
  -3, -1, 3, 4, 4, 3, -1, -3,
  -3, -1, 2, 3, 3, 2, -1, -3,
  -3, -3, 0, 0, 0, 0, -3, -3,
  -5, -3, -3, -3, -3, -3, -3, -5,
];

const tableByPiece = (piece: PieceType, phase: PieceValuePhase): SquareTable => {
  if (piece === "p") {
    return pstPawn;
  }
  if (piece === "n") {
    return pstKnight;
  }
  if (piece === "b") {
    return pstBishop;
  }
  if (piece === "r") {
    return pstRook;
  }
  if (piece === "q") {
    return pstQueen;
  }
  return phase === "endgame" ? pstKingEndgame : pstKingMiddlegame;
};

const countNonPawnMaterial = (fen: string): number => {
  let score = 0;
  const board = fen.split(" ")[0];
  for (const char of board) {
    const lower = char.toLowerCase();
    if (lower === "n" || lower === "b") {
      score += 3;
    } else if (lower === "r") {
      score += 5;
    } else if (lower === "q") {
      score += 9;
    }
  }
  return score;
};

export const detectPhase = (fen: string): PieceValuePhase => {
  const nonPawnMaterial = countNonPawnMaterial(fen);
  if (nonPawnMaterial <= 14) {
    return "endgame";
  }
  if (nonPawnMaterial <= 22) {
    return "middlegame";
  }
  return "opening";
};

const mirrorSquareIndex = (index: number): number => {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  return (7 - rank) * 8 + file;
};

const squareToIndex = (square: string): number => {
  const file = square.charCodeAt(0) - 97;
  const rank = Number.parseInt(square[1] ?? "1", 10) - 1;
  return rank * 8 + file;
};

const readablePiece = (piece: string): string => {
  const lower = piece.toLowerCase();
  const names: Record<string, string> = {
    p: "Pawn",
    n: "Knight",
    b: "Bishop",
    r: "Rook",
    q: "Queen",
    k: "King",
  };
  return names[lower] ?? "Piece";
};

const contributionForPiece = (
  piece: PieceType,
  color: Side,
  square: string,
  phase: PieceValuePhase
): PieceContribution => {
  const base = PIECE_BASE_VALUE[piece];
  const table = tableByPiece(piece, phase);
  const boardIndex = squareToIndex(square);
  const lookup = color === "w" ? mirrorSquareIndex(boardIndex) : boardIndex;
  const positional = table[lookup] ?? 0;

  return {
    square,
    piece: readablePiece(piece),
    base,
    positional,
    total: base + positional,
  };
};

export const calculatePositionBreakdown = (fen: string): PositionBreakdown => {
  const game = new Chess(fen);
  const board = game.board();
  const phase = detectPhase(fen);

  const whitePieces: PieceContribution[] = [];
  const blackPieces: PieceContribution[] = [];

  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const rank = board[rankIndex] ?? [];
    for (let fileIndex = 0; fileIndex < rank.length; fileIndex += 1) {
      const piece = rank[fileIndex];
      if (!piece) {
        continue;
      }

      const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
      const contribution = contributionForPiece(piece.type as PieceType, piece.color as Side, square, phase);
      if (piece.color === "w") {
        whitePieces.push(contribution);
      } else {
        blackPieces.push(contribution);
      }
    }
  }

  const whiteTotal = whitePieces.reduce((acc, item) => acc + item.total, 0);
  const blackTotal = blackPieces.reduce((acc, item) => acc + item.total, 0);

  return {
    whiteTotal,
    blackTotal,
    phase,
    whitePieces: whitePieces.sort((a, b) => b.total - a.total),
    blackPieces: blackPieces.sort((a, b) => b.total - a.total),
  };
};

const withRounded = (value: number): number => Math.round(value * 1000) / 1000;

export const calculatePositionBreakdownAligned = (
  fen: string,
  targetDiffPawns: number | null | undefined
): PositionBreakdown => {
  const raw = calculatePositionBreakdown(fen);
  if (targetDiffPawns === null || targetDiffPawns === undefined || !Number.isFinite(targetDiffPawns)) {
    return raw;
  }

  const whiteBaseTotal = raw.whitePieces.reduce((acc, item) => acc + item.base, 0);
  const blackBaseTotal = raw.blackPieces.reduce((acc, item) => acc + item.base, 0);
  const whitePosTotal = raw.whitePieces.reduce((acc, item) => acc + item.positional, 0);
  const blackPosTotal = raw.blackPieces.reduce((acc, item) => acc + item.positional, 0);

  const baseDiff = whiteBaseTotal - blackBaseTotal;
  const positionalDiff = whitePosTotal - blackPosTotal;

  if (Math.abs(positionalDiff) > 1e-9) {
    const scale = (targetDiffPawns - baseDiff) / positionalDiff;

    const whitePieces = raw.whitePieces
      .map((item) => {
        const positional = withRounded(item.positional * scale);
        const total = withRounded(item.base + positional);
        return {
          ...item,
          positional,
          total,
        };
      })
      .sort((a, b) => b.total - a.total);

    const blackPieces = raw.blackPieces
      .map((item) => {
        const positional = withRounded(item.positional * scale);
        const total = withRounded(item.base + positional);
        return {
          ...item,
          positional,
          total,
        };
      })
      .sort((a, b) => b.total - a.total);

    const whiteTotal = withRounded(whitePieces.reduce((acc, item) => acc + item.total, 0));
    const blackTotal = withRounded(blackPieces.reduce((acc, item) => acc + item.total, 0));
    const drift = withRounded(targetDiffPawns - (whiteTotal - blackTotal));

    if (Math.abs(drift) > 1e-6 && whitePieces.length > 0) {
      whitePieces[0] = {
        ...whitePieces[0],
        total: withRounded(whitePieces[0].total + drift),
        positional: withRounded(whitePieces[0].positional + drift),
      };
    }

    return {
      phase: raw.phase,
      whitePieces,
      blackPieces,
      whiteTotal: withRounded(whitePieces.reduce((acc, item) => acc + item.total, 0)),
      blackTotal: withRounded(blackPieces.reduce((acc, item) => acc + item.total, 0)),
    };
  }

  const correction = targetDiffPawns - (raw.whiteTotal - raw.blackTotal);
  if (Math.abs(correction) <= 1e-9) {
    return raw;
  }

  const whiteN = Math.max(raw.whitePieces.length, 1);
  const blackN = Math.max(raw.blackPieces.length, 1);
  const whiteShift = correction / (2 * whiteN);
  const blackShift = correction / (2 * blackN);

  const whitePieces = raw.whitePieces
    .map((item) => {
      const positional = withRounded(item.positional + whiteShift);
      const total = withRounded(item.base + positional);
      return {
        ...item,
        positional,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);

  const blackPieces = raw.blackPieces
    .map((item) => {
      const positional = withRounded(item.positional - blackShift);
      const total = withRounded(item.base + positional);
      return {
        ...item,
        positional,
        total,
      };
    })
    .sort((a, b) => b.total - a.total);

  const whiteTotal = withRounded(whitePieces.reduce((acc, item) => acc + item.total, 0));
  const blackTotal = withRounded(blackPieces.reduce((acc, item) => acc + item.total, 0));

  return {
    phase: raw.phase,
    whitePieces,
    blackPieces,
    whiteTotal,
    blackTotal,
  };
};

const files = "abcdefgh";

const setFenTurn = (fen: string, side: Side): string => {
  const parts = fen.split(" ");
  if (parts.length < 2) {
    return fen;
  }
  parts[1] = side;
  return parts.join(" ");
};

const findKingSquare = (game: Chess, color: Side): string | null => {
  const board = game.board();
  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const rank = board[rankIndex] ?? [];
    for (let fileIndex = 0; fileIndex < rank.length; fileIndex += 1) {
      const piece = rank[fileIndex];
      if (!piece || piece.type !== "k" || piece.color !== color) {
        continue;
      }
      return `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
    }
  }
  return null;
};

const getPieceSquares = (game: Chess, color: Side, type?: PieceType): string[] => {
  const result: string[] = [];
  const board = game.board();
  for (let rankIndex = 0; rankIndex < board.length; rankIndex += 1) {
    const rank = board[rankIndex] ?? [];
    for (let fileIndex = 0; fileIndex < rank.length; fileIndex += 1) {
      const piece = rank[fileIndex];
      if (!piece || piece.color !== color) {
        continue;
      }
      if (type && piece.type !== type) {
        continue;
      }
      result.push(`${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`);
    }
  }
  return result;
};

const buildAttackInfo = (fen: string, side: Side) => {
  const game = new Chess(setFenTurn(fen, side));
  const moves = game.moves({ verbose: true });
  const attackMap = new Map<string, number>();
  let checkMoves = 0;

  for (const move of moves) {
    attackMap.set(move.to, (attackMap.get(move.to) ?? 0) + 1);
    if (move.san.includes("+") || move.san.includes("#")) {
      checkMoves += 1;
    }
  }

  return { moves, attackMap, checkMoves };
};

const fileIndexOf = (square: string): number => files.indexOf(square[0] ?? "");
const rankNumberOf = (square: string): number => Number.parseInt(square[1] ?? "1", 10);
const toRounded = (value: number): number => Math.round(value * 1000) / 1000;

const getPassedPawnCount = (ownPawns: string[], enemyPawns: string[], side: Side): number => {
  let count = 0;
  for (const pawn of ownPawns) {
    const pawnFile = fileIndexOf(pawn);
    const pawnRank = rankNumberOf(pawn);
    const blockedByEnemy = enemyPawns.some((enemy) => {
      const enemyFile = fileIndexOf(enemy);
      if (Math.abs(enemyFile - pawnFile) > 1) {
        return false;
      }
      const enemyRank = rankNumberOf(enemy);
      return side === "w" ? enemyRank > pawnRank : enemyRank < pawnRank;
    });
    if (!blockedByEnemy) {
      count += 1;
    }
  }
  return count;
};

const kingZoneSquares = (square: string): string[] => {
  const centerFile = fileIndexOf(square);
  const centerRank = rankNumberOf(square);
  const result: string[] = [];

  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      const file = centerFile + df;
      const rank = centerRank + dr;
      if (file < 0 || file > 7 || rank < 1 || rank > 8) {
        continue;
      }
      result.push(`${files[file]}${rank}`);
    }
  }

  return result;
};

export const calculateFactorBreakdown = (
  fen: string,
  targetDiffPawns: number | null | undefined
): FactorBreakdownItem[] => {
  const game = new Chess(fen);
  const phase = detectPhase(fen);
  const whiteAttack = buildAttackInfo(fen, "w");
  const blackAttack = buildAttackInfo(fen, "b");

  const whitePieces = getPieceSquares(game, "w");
  const blackPieces = getPieceSquares(game, "b");
  const whitePawns = getPieceSquares(game, "w", "p");
  const blackPawns = getPieceSquares(game, "b", "p");
  const whiteKing = findKingSquare(game, "w");
  const blackKing = findKingSquare(game, "b");

  const materialWhite = whitePieces.reduce((acc, square) => {
    const piece = game.get(square as Parameters<typeof game.get>[0]);
    if (!piece) {
      return acc;
    }
    return acc + PIECE_BASE_VALUE[piece.type as PieceType];
  }, 0);
  const materialBlack = blackPieces.reduce((acc, square) => {
    const piece = game.get(square as Parameters<typeof game.get>[0]);
    if (!piece) {
      return acc;
    }
    return acc + PIECE_BASE_VALUE[piece.type as PieceType];
  }, 0);

  const whiteBishopPair = getPieceSquares(game, "w", "b").length >= 2 ? 0.35 : 0;
  const blackBishopPair = getPieceSquares(game, "b", "b").length >= 2 ? 0.35 : 0;

  const centralSquares = ["d4", "e4", "d5", "e5"];
  const centerWhiteControl =
    centralSquares.reduce((acc, square) => acc + (whiteAttack.attackMap.get(square) ?? 0), 0) * 0.03 +
    centralSquares.reduce((acc, square) => {
      const piece = game.get(square as Parameters<typeof game.get>[0]);
      if (!piece || piece.color !== "w") {
        return acc;
      }
      return acc + (piece.type === "p" ? 0.16 : 0.12);
    }, 0);
  const centerBlackControl =
    centralSquares.reduce((acc, square) => acc + (blackAttack.attackMap.get(square) ?? 0), 0) * 0.03 +
    centralSquares.reduce((acc, square) => {
      const piece = game.get(square as Parameters<typeof game.get>[0]);
      if (!piece || piece.color !== "b") {
        return acc;
      }
      return acc + (piece.type === "p" ? 0.16 : 0.12);
    }, 0);

  const mobilityWhite = Math.min(2.3, whiteAttack.moves.length * 0.015);
  const mobilityBlack = Math.min(2.3, blackAttack.moves.length * 0.015);

  const pawnStructureScore = (side: Side) => {
    const ownPawns = side === "w" ? whitePawns : blackPawns;
    const enemyPawns = side === "w" ? blackPawns : whitePawns;
    const byFile = new Array<number>(8).fill(0);

    for (const pawn of ownPawns) {
      const file = fileIndexOf(pawn);
      if (file >= 0) {
        byFile[file] += 1;
      }
    }

    const doubled = byFile.reduce((acc, count) => acc + Math.max(0, count - 1), 0);
    const isolated = ownPawns.reduce((acc, pawn) => {
      const file = fileIndexOf(pawn);
      const hasLeft = file > 0 && byFile[file - 1] > 0;
      const hasRight = file < 7 && byFile[file + 1] > 0;
      return acc + (hasLeft || hasRight ? 0 : 1);
    }, 0);
    const passed = getPassedPawnCount(ownPawns, enemyPawns, side);

    return {
      score: passed * 0.13 - doubled * 0.18 - isolated * 0.12,
      doubled,
      isolated,
      passed,
    };
  };

  const pawnWhite = pawnStructureScore("w");
  const pawnBlack = pawnStructureScore("b");

  const kingSafetyScore = (side: Side) => {
    const kingSquare = side === "w" ? whiteKing : blackKing;
    if (!kingSquare) {
      return {
        score: -1.2,
        missingShield: 0,
        enemyPressure: 0,
      };
    }

    const kingFile = fileIndexOf(kingSquare);
    const castled = kingFile === 2 || kingFile === 6;
    let score = castled ? 0.15 : 0;
    if (!castled && phase !== "endgame") {
      score -= 0.24;
    }

    const shieldRank = side === "w" ? 2 : 7;
    let missingShield = 0;
    for (let file = kingFile - 1; file <= kingFile + 1; file += 1) {
      if (file < 0 || file > 7) {
        continue;
      }
      const shieldSquare = `${files[file]}${shieldRank}`;
      const piece = game.get(shieldSquare as Parameters<typeof game.get>[0]);
      if (!piece || piece.color !== side || piece.type !== "p") {
        missingShield += 1;
      }
    }
    score -= missingShield * 0.12;

    const enemyAttack = side === "w" ? blackAttack : whiteAttack;
    const zone = kingZoneSquares(kingSquare);
    const enemyPressure = zone.reduce((acc, square) => acc + (enemyAttack.attackMap.get(square) ?? 0), 0);
    score -= enemyPressure * 0.028;

    return {
      score,
      missingShield,
      enemyPressure,
    };
  };

  const kingWhite = kingSafetyScore("w");
  const kingBlack = kingSafetyScore("b");

  const tacticalScore = (side: Side) => {
    const ownAttack = side === "w" ? whiteAttack : blackAttack;
    const enemyAttack = side === "w" ? blackAttack : whiteAttack;
    const ownPieces = side === "w" ? whitePieces : blackPieces;
    const enemyPieces = side === "w" ? blackPieces : whitePieces;
    const enemyKing = side === "w" ? blackKing : whiteKing;
    const enemyKingZone = enemyKing ? kingZoneSquares(enemyKing) : [];

    let hangingOwnPenalty = 0;
    let hangingEnemyBonus = 0;
    let kingZonePressure = 0;

    for (const square of ownPieces) {
      const piece = game.get(square as Parameters<typeof game.get>[0]);
      if (!piece || piece.type === "k") {
        continue;
      }
      const attackedByEnemy = enemyAttack.attackMap.get(square) ?? 0;
      const defendedByOwn = ownAttack.attackMap.get(square) ?? 0;
      if (attackedByEnemy > 0 && defendedByOwn === 0) {
        hangingOwnPenalty += PIECE_BASE_VALUE[piece.type as PieceType] * 0.1;
      }
    }

    for (const square of enemyPieces) {
      const piece = game.get(square as Parameters<typeof game.get>[0]);
      if (!piece || piece.type === "k") {
        continue;
      }
      const attackedByOwn = ownAttack.attackMap.get(square) ?? 0;
      const defendedByEnemy = enemyAttack.attackMap.get(square) ?? 0;
      if (attackedByOwn > 0 && defendedByEnemy === 0) {
        hangingEnemyBonus += PIECE_BASE_VALUE[piece.type as PieceType] * 0.08;
      }
    }

    for (const zoneSquare of enemyKingZone) {
      kingZonePressure += ownAttack.attackMap.get(zoneSquare) ?? 0;
    }

    return {
      score: hangingEnemyBonus + ownAttack.checkMoves * 0.06 + kingZonePressure * 0.018 - hangingOwnPenalty,
      hangingOwnPenalty,
      hangingEnemyBonus,
    };
  };

  const tacticalWhite = tacticalScore("w");
  const tacticalBlack = tacticalScore("b");

  const rawFactors = [
    {
      key: "material",
      label: "Material",
      white: materialWhite,
      black: materialBlack,
      description: "Base piece values on board.",
    },
    {
      key: "bishop_pair",
      label: "Bishop Pair",
      white: whiteBishopPair,
      black: blackBishopPair,
      description: "Bonus for owning both bishops.",
    },
    {
      key: "center_control",
      label: "Center Control",
      white: centerWhiteControl,
      black: centerBlackControl,
      description: "Control and occupation of d4/e4/d5/e5.",
    },
    {
      key: "mobility",
      label: "Mobility",
      white: mobilityWhite,
      black: mobilityBlack,
      description: "Number of legal move options.",
    },
    {
      key: "pawn_structure",
      label: "Pawn Structure",
      white: pawnWhite.score,
      black: pawnBlack.score,
      description: `Passed pawns vs doubled/isolated pawns (W ${pawnWhite.passed}/${pawnWhite.doubled}/${pawnWhite.isolated}, B ${pawnBlack.passed}/${pawnBlack.doubled}/${pawnBlack.isolated}).`,
    },
    {
      key: "king_safety",
      label: "King Safety",
      white: kingWhite.score,
      black: kingBlack.score,
      description: `Castling, pawn shield, and king-zone pressure (W shield missing ${kingWhite.missingShield}, B ${kingBlack.missingShield}).`,
    },
    {
      key: "tactics_threats",
      label: "Tactics and Threats",
      white: tacticalWhite.score,
      black: tacticalBlack.score,
      description: "Checks, hanging pieces, and tactical pressure.",
    },
  ];

  const rawDeltaSum = rawFactors.reduce((acc, item) => acc + (item.white - item.black), 0);
  const target = targetDiffPawns ?? rawDeltaSum;

  let aligned = rawFactors.map((item) => ({
    ...item,
    delta: item.white - item.black,
  }));

  if (Number.isFinite(target)) {
    if (Math.abs(rawDeltaSum) > 1e-9) {
      const scale = target / rawDeltaSum;
      aligned = aligned.map((item) => {
        const midpoint = (item.white + item.black) / 2;
        const delta = item.delta * scale;
        return {
          ...item,
          white: midpoint + delta / 2,
          black: midpoint - delta / 2,
          delta,
        };
      });
    } else if (aligned.length > 0) {
      aligned = aligned.map((item, index) => {
        if (index > 0) {
          return {
            ...item,
            delta: 0,
          };
        }
        const midpoint = (item.white + item.black) / 2;
        return {
          ...item,
          white: midpoint + target / 2,
          black: midpoint - target / 2,
          delta: target,
        };
      });
    }
  }

  const rounded = aligned.map((item) => ({
    key: item.key,
    label: item.label,
    white: toRounded(item.white),
    black: toRounded(item.black),
    delta: toRounded(item.delta),
    description: item.description,
  }));

  const drift = toRounded((target ?? 0) - rounded.reduce((acc, item) => acc + item.delta, 0));
  if (Math.abs(drift) > 1e-6 && rounded.length > 0) {
    rounded[0] = {
      ...rounded[0],
      delta: toRounded(rounded[0].delta + drift),
      white: toRounded(rounded[0].white + drift / 2),
      black: toRounded(rounded[0].black - drift / 2),
    };
  }

  return rounded;
};

const toSortScore = (centipawns: number, mate: number | null): number => {
  if (mate === null) {
    return centipawns;
  }
  return mate > 0 ? 100_000 - mate * 100 : -100_000 - mate * 100;
};

export const calculateTopEngineLines = async (
  fen: string,
  depth: number,
  limit = 3,
  continuationPlies = 3
): Promise<EngineTopLine[]> => {
  const root = new Chess(fen);
  const sideToMove = root.turn() as Side;
  const legalMoves = root.moves({ verbose: true });

  if (legalMoves.length === 0) {
    return [];
  }

  const scoredMoves: Array<{
    move: (typeof legalMoves)[number];
    evalCp: number;
    mate: number | null;
    sortScore: number;
  }> = [];

  for (const move of legalMoves) {
    const next = new Chess(fen);
    next.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion ?? "q",
    });
    const evaluation = await evaluatePosition(next.fen(), depth);
    scoredMoves.push({
      move,
      evalCp: evaluation.centipawns,
      mate: evaluation.mate,
      sortScore: toSortScore(evaluation.centipawns, evaluation.mate),
    });
  }

  scoredMoves.sort((a, b) => {
    if (sideToMove === "w") {
      return b.sortScore - a.sortScore;
    }
    return a.sortScore - b.sortScore;
  });

  const best = scoredMoves.slice(0, Math.max(1, limit));
  const lines: EngineTopLine[] = [];

  for (const candidate of best) {
    const lineGame = new Chess(fen);
    const firstMove = lineGame.move({
      from: candidate.move.from,
      to: candidate.move.to,
      promotion: candidate.move.promotion ?? "q",
    });
    if (!firstMove) {
      continue;
    }

    const sanLine = [firstMove.san];
    for (let ply = 0; ply < continuationPlies; ply += 1) {
      if (lineGame.isGameOver()) {
        break;
      }
      const followEval = await evaluatePosition(lineGame.fen(), Math.max(8, depth - 2));
      if (!followEval.bestMove) {
        break;
      }
      const applied = applyUciMove(lineGame, followEval.bestMove);
      if (!applied) {
        break;
      }
      sanLine.push(applied.san);
    }

    lines.push({
      moveUci: `${candidate.move.from}${candidate.move.to}${candidate.move.promotion ?? ""}`,
      moveSan: firstMove.san,
      evalCp: candidate.evalCp,
      mate: candidate.mate,
      lineSan: sanLine.join(" "),
    });
  }

  return lines;
};

const applyUciMove = (game: Chess, uci: string) => {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : "q";
  return game.move({ from, to, promotion });
};

export const analyzeMoveInsights = async (
  moves: MoveRecord[],
  depth: number,
  onProgress?: (completed: number, total: number) => void
): Promise<MoveInsight[]> => {
  const game = new Chess();
  const insights: MoveInsight[] = [];

  for (const move of moves) {
    const fenBefore = game.fen();
    const mover = move.side;

    const beforeEval = await evaluatePosition(fenBefore, depth);

    const playedAfter = new Chess(fenBefore);
    applyUciMove(playedAfter, move.uci);
    const playedEval = await evaluatePosition(playedAfter.fen(), depth);

    let bestUci = beforeEval.bestMove ?? move.uci;
    let bestScoreAfter = playedEval.centipawns;

    if (beforeEval.bestMove) {
      const bestAfter = new Chess(fenBefore);
      const bestApplied = applyUciMove(bestAfter, beforeEval.bestMove);
      if (bestApplied) {
        bestUci = beforeEval.bestMove;
        const evalAfterBest = await evaluatePosition(bestAfter.fen(), depth);
        bestScoreAfter = evalAfterBest.centipawns;
      }
    }

    let lossForMover = 0;
    if (mover === "w") {
      lossForMover = Math.max(0, bestScoreAfter - playedEval.centipawns);
    } else {
      lossForMover = Math.max(0, playedEval.centipawns - bestScoreAfter);
    }

    insights.push({
      ply: move.ply,
      playedUci: move.uci,
      bestUci,
      scoreAfterPlayed: playedEval.centipawns,
      scoreAfterBest: bestScoreAfter,
      lossForMover,
      quality: qualityFromLoss(lossForMover),
    });

    applyUciMove(game, move.uci);
    onProgress?.(insights.length, moves.length);

    if (game.isGameOver()) {
      const remainingPly = moves.length - insights.length;
      if (remainingPly > 0) {
        for (let i = 0; i < remainingPly; i += 1) {
          const fallbackMove = moves[insights.length + i];
          if (!fallbackMove) {
            continue;
          }
          insights.push({
            ply: fallbackMove.ply,
            playedUci: fallbackMove.uci,
            bestUci: fallbackMove.uci,
            scoreAfterPlayed: 0,
            scoreAfterBest: 0,
            lossForMover: 0,
            quality: "good",
          });
        }
      }
      break;
    }
  }

  return insights;
};

export const qualityLabel = (quality: MoveInsight["quality"]): string => {
  const labels: Record<MoveInsight["quality"], string> = {
    best: "Best",
    good: "Good",
    inaccuracy: "Inaccuracy",
    mistake: "Mistake",
    blunder: "Blunder",
  };
  return labels[quality];
};
