const API_BASE = "https://stockfish.online/api/s/v2.php";

type EngineResponse = {
  evaluation?: string | number;
  mate?: number;
  bestmove?: string;
};

export interface EngineEvaluation {
  centipawns: number;
  mate: number | null;
  bestMove: string | null;
}

const evalCache = new Map<string, EngineEvaluation>();

const parseCentipawn = (value: string | number | undefined): number => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return 0;
  }
  return Math.round(numberValue * 100);
};

const parseBestMove = (raw: string | undefined): string | null => {
  if (!raw) {
    return null;
  }
  const segments = raw.split(" ");
  if (segments.length < 2) {
    return null;
  }
  return segments[1] ?? null;
};

export const evaluatePosition = async (fen: string, depth: number): Promise<EngineEvaluation> => {
  const cacheKey = `${fen}::${depth}`;
  const cached = evalCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    `${API_BASE}?fen=${encodeURIComponent(fen)}&depth=${depth}`,
    {
      method: "GET",
    }
  );

  if (!response.ok) {
    throw new Error(`Stockfish API error: ${response.status}`);
  }

  const payload = (await response.json()) as EngineResponse;
  const parsed: EngineEvaluation = {
    centipawns: parseCentipawn(payload.evaluation),
    mate: payload.mate ?? null,
    bestMove: parseBestMove(payload.bestmove),
  };

  evalCache.set(cacheKey, parsed);
  return parsed;
};

export const getBestMoveForPosition = async (fen: string, depth: number): Promise<string | null> => {
  const evaluation = await evaluatePosition(fen, depth);
  return evaluation.bestMove;
};

export const aiLevelToDepth = (level: number): number => {
  const clamped = Math.max(1, Math.min(4, level));
  const map: Record<number, number> = {
    1: 6,
    2: 9,
    3: 12,
    4: 15,
  };
  return map[clamped];
};

export const aiLevelToThinkDelayMs = (level: number): number => {
  const clamped = Math.max(1, Math.min(4, level));
  const map: Record<number, number> = {
    1: 180,
    2: 320,
    3: 520,
    4: 760,
  };
  return map[clamped];
};

export const formatScore = (centipawns: number, mate: number | null): string => {
  if (mate !== null) {
    const sign = mate > 0 ? "+" : "";
    return `M${sign}${mate}`;
  }

  const score = centipawns / 100;
  const sign = score > 0 ? "+" : "";
  return `${sign}${score.toFixed(1)}`;
};

export const qualityFromLoss = (lossForMover: number): "best" | "good" | "inaccuracy" | "mistake" | "blunder" => {
  if (lossForMover <= 20) {
    return "best";
  }
  if (lossForMover <= 50) {
    return "good";
  }
  if (lossForMover <= 99) {
    return "inaccuracy";
  }
  if (lossForMover <= 249) {
    return "mistake";
  }
  return "blunder";
};

export const clearEngineCache = () => {
  evalCache.clear();
};
