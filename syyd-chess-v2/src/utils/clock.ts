export const START_FEN = "start";

export const formatClock = (milliseconds: number): string => {
  const clamped = Math.max(0, Math.floor(milliseconds));
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export const makeRoomCode = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let output = "";
  for (let index = 0; index < 6; index += 1) {
    const random = Math.floor(Math.random() * alphabet.length);
    output += alphabet[random] ?? "A";
  }
  return output;
};

export const createId = (prefix: string): string => {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
};

export const sideToLabel = (side: "w" | "b"): "white" | "black" => {
  return side === "w" ? "white" : "black";
};

export const oppositeSide = (side: "w" | "b"): "w" | "b" => {
  return side === "w" ? "b" : "w";
};
