import { useState } from "react";
import type { AiConfig, Side } from "../types";

interface AiSetupProps {
  defaultName: string;
  onBack: () => void;
  onStart: (config: AiConfig) => void;
  onNameChange: (name: string) => void;
}

const normalizeName = (value: string): string => {
  const trimmed = value.trim();
  return trimmed || "Player";
};

export const AiSetup = ({ defaultName, onBack, onStart, onNameChange }: AiSetupProps) => {
  const [name, setName] = useState(defaultName);
  const [colorChoice, setColorChoice] = useState<"white" | "black" | "random">("white");
  const [aiLevel, setAiLevel] = useState(2);
  const [minutes, setMinutes] = useState(5);
  const [increment, setIncrement] = useState(3);

  const resolveSide = (): Side => {
    if (colorChoice === "random") {
      return Math.random() > 0.5 ? "w" : "b";
    }
    return colorChoice === "white" ? "w" : "b";
  };

  const submit = () => {
    const normalized = normalizeName(name);
    onNameChange(normalized);
    onStart({
      playerName: normalized,
      playerSide: resolveSide(),
      aiLevel,
      timeControl: {
        initialMinutes: Math.max(1, minutes),
        incrementSeconds: Math.max(0, increment),
      },
    });
  };

  return (
    <div className="setup-root card">
      <header className="card-header">
        <h2>AI Match Setup</h2>
        <button type="button" className="btn subtle" onClick={onBack}>
          Back
        </button>
      </header>

      <div className="setup-grid">
        <label>
          Your Name
          <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
        </label>

        <label>
          Color
          <select value={colorChoice} onChange={(event) => setColorChoice(event.target.value as "white" | "black" | "random")}>
            <option value="white">White</option>
            <option value="black">Black</option>
            <option value="random">Random</option>
          </select>
        </label>

        <label>
          Difficulty
          <select value={aiLevel} onChange={(event) => setAiLevel(Number.parseInt(event.target.value, 10))}>
            <option value={1}>Level 1 - Fast</option>
            <option value={2}>Level 2 - Balanced</option>
            <option value={3}>Level 3 - Strong</option>
            <option value={4}>Level 4 - Expert</option>
          </select>
        </label>

        <label>
          Time (minutes)
          <input
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(event) => setMinutes(Number.parseInt(event.target.value, 10) || 1)}
          />
        </label>

        <label>
          Increment (seconds)
          <input
            type="number"
            min={0}
            max={60}
            value={increment}
            onChange={(event) => setIncrement(Number.parseInt(event.target.value, 10) || 0)}
          />
        </label>

        <div className="preset-row">
          {[
            { label: "1 + 0", m: 1, i: 0 },
            { label: "3 + 2", m: 3, i: 2 },
            { label: "5 + 3", m: 5, i: 3 },
            { label: "10 + 0", m: 10, i: 0 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="chip"
              onClick={() => {
                setMinutes(preset.m);
                setIncrement(preset.i);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <button type="button" className="btn primary" onClick={submit}>
        Start AI Game
      </button>
    </div>
  );
};
