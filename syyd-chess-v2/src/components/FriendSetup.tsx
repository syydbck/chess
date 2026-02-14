import { useEffect, useMemo, useState } from "react";
import type { HostRoomConfig, JoinRoomConfig, ColorPreference } from "../types";
import { makeRoomCode } from "../utils/clock";

interface FriendSetupProps {
  defaultName: string;
  initialJoinCode?: string;
  onBack: () => void;
  onHostStart: (config: HostRoomConfig) => void;
  onJoinStart: (config: JoinRoomConfig) => void;
  onNameChange: (name: string) => void;
}

const normalizeName = (value: string): string => {
  const trimmed = value.trim();
  return trimmed || "Player";
};

export const FriendSetup = ({
  defaultName,
  initialJoinCode,
  onBack,
  onHostStart,
  onJoinStart,
  onNameChange,
}: FriendSetupProps) => {
  const [tab, setTab] = useState<"create" | "join">(initialJoinCode ? "join" : "create");

  const [hostName, setHostName] = useState(defaultName);
  const [roomCode, setRoomCode] = useState(() => makeRoomCode());
  const [preferredColor, setPreferredColor] = useState<ColorPreference>("random");
  const [minutes, setMinutes] = useState(5);
  const [increment, setIncrement] = useState(3);

  const [guestName, setGuestName] = useState(defaultName);
  const [joinCode, setJoinCode] = useState(initialJoinCode ?? "");

  useEffect(() => {
    if (!initialJoinCode) {
      return;
    }
    setJoinCode(initialJoinCode);
    setTab("join");
  }, [initialJoinCode]);

  const presets = useMemo(
    () => [
      { label: "1 + 0", minutes: 1, increment: 0 },
      { label: "3 + 2", minutes: 3, increment: 2 },
      { label: "5 + 3", minutes: 5, increment: 3 },
      { label: "10 + 0", minutes: 10, increment: 0 },
    ],
    []
  );

  const createRoom = () => {
    const normalized = normalizeName(hostName);
    onNameChange(normalized);
    onHostStart({
      hostName: normalized,
      roomCode,
      preferredColor,
      timeControl: {
        initialMinutes: Math.max(1, minutes),
        incrementSeconds: Math.max(0, increment),
      },
    });
  };

  const joinRoom = () => {
    const normalized = normalizeName(guestName);
    const cleanCode = joinCode.trim().toUpperCase();
    if (!cleanCode) {
      return;
    }
    onNameChange(normalized);
    onJoinStart({
      guestName: normalized,
      roomCode: cleanCode,
    });
  };

  return (
    <div className="setup-root card">
      <header className="card-header">
        <h2>Friend Room</h2>
        <button type="button" className="btn subtle" onClick={onBack}>
          Back
        </button>
      </header>

      <div className="tab-row">
        <button
          type="button"
          className={tab === "create" ? "tab active" : "tab"}
          onClick={() => setTab("create")}
        >
          Create Room
        </button>
        <button
          type="button"
          className={tab === "join" ? "tab active" : "tab"}
          onClick={() => setTab("join")}
        >
          Join Room
        </button>
      </div>

      {tab === "create" ? (
        <div className="setup-grid">
          <label>
            Your Name
            <input value={hostName} maxLength={24} onChange={(event) => setHostName(event.target.value)} />
          </label>

          <label>
            Room Code
            <div className="inline-input">
              <input value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} maxLength={10} />
              <button type="button" className="btn subtle" onClick={() => setRoomCode(makeRoomCode())}>
                Regenerate
              </button>
            </div>
          </label>

          <label>
            Host Color
            <select value={preferredColor} onChange={(event) => setPreferredColor(event.target.value as ColorPreference)}>
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="random">Random</option>
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
            {presets.map((preset) => (
              <button
                type="button"
                key={preset.label}
                className="chip"
                onClick={() => {
                  setMinutes(preset.minutes);
                  setIncrement(preset.increment);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <button type="button" className="btn primary" onClick={createRoom}>
            Create Room
          </button>
        </div>
      ) : (
        <div className="setup-grid">
          <label>
            Your Name
            <input value={guestName} maxLength={24} onChange={(event) => setGuestName(event.target.value)} />
          </label>

          <label>
            Room Code
            <input
              value={joinCode}
              placeholder="Enter room code"
              maxLength={10}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            />
          </label>

          <button type="button" className="btn primary" onClick={joinRoom}>
            Join Room
          </button>
        </div>
      )}
    </div>
  );
};
