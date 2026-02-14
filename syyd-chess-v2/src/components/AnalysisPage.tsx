import { useEffect, useMemo, useState } from "react";
import type { EngineTopLine, FactorBreakdownItem, MoveInsight, SavedGame } from "../types";
import { AnalysisOverlayBoard } from "./AnalysisOverlayBoard";
import { evaluatePosition, formatScore } from "../utils/engine";
import { analyzeMoveInsights, calculateFactorBreakdown, calculateTopEngineLines, qualityLabel } from "../utils/chessInsight";

interface AnalysisPageProps {
  game: SavedGame;
  onBack: () => void;
}

const qualityClass = (quality: MoveInsight["quality"]): string => {
  const map: Record<MoveInsight["quality"], string> = {
    best: "quality-best",
    good: "quality-good",
    inaccuracy: "quality-inaccuracy",
    mistake: "quality-mistake",
    blunder: "quality-blunder",
  };
  return map[quality];
};

export const AnalysisPage = ({ game, onBack }: AnalysisPageProps) => {
  const [depth, setDepth] = useState(12);
  const [moveIndex, setMoveIndex] = useState(game.moves.length);
  const [currentEval, setCurrentEval] = useState<{ centipawns: number; mate: number | null } | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [insights, setInsights] = useState<MoveInsight[]>([]);
  const [insightLoading, setInsightLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [factors, setFactors] = useState<FactorBreakdownItem[]>([]);
  const [topLines, setTopLines] = useState<EngineTopLine[]>([]);
  const [topLineLoading, setTopLineLoading] = useState(false);

  const positions = useMemo(() => {
    return [game.startFen, ...game.moves.map((move) => move.fenAfter)];
  }, [game.moves, game.startFen]);

  const safeMoveIndex = Math.max(0, Math.min(moveIndex, positions.length - 1));
  const currentFen = positions[safeMoveIndex] ?? game.startFen;
  const currentMove = safeMoveIndex > 0 ? game.moves[safeMoveIndex - 1] : null;

  const insightByPly = useMemo(() => {
    const map = new Map<number, MoveInsight>();
    for (const insight of insights) {
      map.set(insight.ply, insight);
    }
    return map;
  }, [insights]);

  const selectedInsight = currentMove ? insightByPly.get(currentMove.ply) : undefined;

  useEffect(() => {
    let active = true;
    setEvalLoading(true);

    void evaluatePosition(currentFen, depth)
      .then((evaluation) => {
        if (!active) {
          return;
        }
        setCurrentEval({
          centipawns: evaluation.centipawns,
          mate: evaluation.mate,
        });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCurrentEval({ centipawns: 0, mate: null });
      })
      .finally(() => {
        if (active) {
          setEvalLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentFen, depth]);

  useEffect(() => {
    let active = true;
    setInsightLoading(true);
    setProgressText("");

    void analyzeMoveInsights(game.moves, depth, (completed, total) => {
      if (!active) {
        return;
      }
      setProgressText(`Analyzing move ${completed}/${total}`);
    })
      .then((result) => {
        if (!active) {
          return;
        }
        setInsights(result);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setInsights([]);
      })
      .finally(() => {
        if (!active) {
          return;
        }
        setInsightLoading(false);
        setProgressText("");
      });

    return () => {
      active = false;
    };
  }, [depth, game.moves]);

  useEffect(() => {
    const targetDiff = currentEval?.mate === null ? (currentEval?.centipawns ?? 0) / 100 : null;
    setFactors(calculateFactorBreakdown(currentFen, targetDiff));
  }, [currentEval?.centipawns, currentEval?.mate, currentFen]);

  useEffect(() => {
    let active = true;
    setTopLineLoading(true);

    void calculateTopEngineLines(currentFen, depth, 3, 4)
      .then((lines) => {
        if (!active) {
          return;
        }
        setTopLines(lines);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setTopLines([]);
      })
      .finally(() => {
        if (active) {
          setTopLineLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentFen, depth]);

  const evalScore = currentEval?.centipawns ?? 0;
  const bounded = Math.max(-900, Math.min(900, evalScore));
  const whiteRatio = Math.max(0, Math.min(100, 50 + bounded / 18));

  return (
    <div className="analysis-root">
      <header className="analysis-header">
        <div>
          <h2>Game Analysis</h2>
          <p>
            {game.whiteName} vs {game.blackName} - {new Date(game.createdAt).toLocaleString()}
          </p>
        </div>
        <button type="button" className="btn subtle" onClick={onBack}>
          Dashboard
        </button>
      </header>

      <div className="analysis-layout">
        <section className="analysis-board-column">
          <div className="analysis-board-frame">
            <div className="eval-side">
              <div className="eval-column">
                <div className="eval-white" style={{ height: `${whiteRatio}%` }} />
                <div className="eval-black" style={{ height: `${100 - whiteRatio}%` }} />
              </div>
              <div className="eval-readout">
                {evalLoading ? "..." : formatScore(currentEval?.centipawns ?? 0, currentEval?.mate ?? null)}
              </div>
            </div>

            <div className="analysis-board-surface">
              <AnalysisOverlayBoard
                fen={currentFen}
                orientation="white"
                lastMoveUci={currentMove?.uci}
                targetDiffPawns={currentEval?.mate === null ? (currentEval?.centipawns ?? 0) / 100 : null}
              />
            </div>
          </div>

          <div className="overlay-legend card">
            <p>Piece labels show piece + square score. Click a piece to reveal legal squares and top 3 move score shifts.</p>
          </div>

          <div className="analysis-controls">
            <button
              type="button"
              className="btn subtle"
              onClick={() => setMoveIndex((previous) => Math.max(0, previous - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="btn subtle"
              onClick={() => setMoveIndex((previous) => Math.min(positions.length - 1, previous + 1))}
            >
              Next
            </button>
            <label className="depth-control">
              Depth
              <select value={depth} onChange={(event) => setDepth(Number.parseInt(event.target.value, 10))}>
                <option value={8}>8</option>
                <option value={10}>10</option>
                <option value={12}>12</option>
                <option value={16}>16</option>
                <option value={20}>20</option>
              </select>
            </label>
          </div>

          {selectedInsight ? (
            <div className={`insight-card ${qualityClass(selectedInsight.quality)}`}>
              <h3>{qualityLabel(selectedInsight.quality)}</h3>
              <p>Played: {selectedInsight.playedUci}</p>
              <p>Best: {selectedInsight.bestUci}</p>
              <p>Loss: {selectedInsight.lossForMover} cp</p>
              <p>Score after move: {(selectedInsight.scoreAfterPlayed / 100).toFixed(2)}</p>
              <p>Score after best: {(selectedInsight.scoreAfterBest / 100).toFixed(2)}</p>
            </div>
          ) : (
            <div className="insight-card">
              <h3>Position Overview</h3>
              <p>Select a move to see best-move comparison.</p>
            </div>
          )}
        </section>

        <section className="analysis-side-column">
          <article className="card">
            <div className="card-header">
              <h3>Top Engine Lines</h3>
              <span>{topLineLoading ? "Loading..." : `${topLines.length} lines`}</span>
            </div>
            <div className="engine-lines">
              {topLines.length === 0 ? <p className="empty-line">No legal lines available.</p> : null}
              {topLines.map((line, index) => (
                <div key={`${line.moveUci}-${index}`} className="engine-line-row">
                  <div className="engine-line-head">
                    <strong>#{index + 1} {line.moveSan}</strong>
                    <span>{formatScore(line.evalCp, line.mate)}</span>
                  </div>
                  <p>{line.lineSan}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-header">
              <h3>Eval Factor Breakdown</h3>
              <span>{formatScore(currentEval?.centipawns ?? 0, currentEval?.mate ?? null)}</span>
            </div>
            <p className="factor-note">Engine score is exact. Factor rows are engine-aligned explanatory estimates.</p>
            <div className="factor-table">
              {factors.map((factor) => (
                <div key={factor.key} className="factor-row">
                  <div className="factor-head">
                    <strong>{factor.label}</strong>
                    <span>{factor.delta > 0 ? "+" : ""}{factor.delta.toFixed(2)}</span>
                  </div>
                  <div className="factor-values">
                    <span>W {factor.white.toFixed(2)}</span>
                    <span>B {factor.black.toFixed(2)}</span>
                  </div>
                  <p>{factor.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card">
            <div className="card-header">
              <h3>Move List</h3>
              <span>{insightLoading ? progressText || "Analyzing..." : `${game.moves.length} plies`}</span>
            </div>
            <div className="moves-table analysis-moves">
              {game.moves.map((move) => {
                const insight = insightByPly.get(move.ply);
                return (
                  <button
                    key={move.ply}
                    type="button"
                    className={safeMoveIndex === move.ply ? "analysis-move-row active" : "analysis-move-row"}
                    onClick={() => setMoveIndex(move.ply)}
                  >
                    <span>{Math.ceil(move.ply / 2)}.</span>
                    <span>{move.san}</span>
                    <span className={insight ? qualityClass(insight.quality) : ""}>
                      {insight ? qualityLabel(insight.quality) : "-"}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};
