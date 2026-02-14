export type Side = "w" | "b";
export type Winner = "white" | "black" | "draw" | null;

export type PieceValuePhase = "opening" | "middlegame" | "endgame";

export interface TimeControl {
  initialMinutes: number;
  incrementSeconds: number;
}

export interface MoveRecord {
  ply: number;
  side: Side;
  san: string;
  uci: string;
  fenAfter: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
  system?: boolean;
  side?: Side;
}

export interface SavedGame {
  id: string;
  mode: "ai" | "friend";
  createdAt: number;
  whiteName: string;
  blackName: string;
  resultWinner: Winner;
  resultReason: string;
  timeControl?: TimeControl;
  startFen: string;
  finalFen: string;
  pgn: string;
  moves: MoveRecord[];
  chats: ChatMessage[];
}

export type MoveQuality = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

export interface MoveInsight {
  ply: number;
  playedUci: string;
  bestUci: string;
  scoreAfterPlayed: number;
  scoreAfterBest: number;
  lossForMover: number;
  quality: MoveQuality;
}

export interface PieceContribution {
  square: string;
  piece: string;
  base: number;
  positional: number;
  total: number;
}

export interface PositionBreakdown {
  whiteTotal: number;
  blackTotal: number;
  phase: PieceValuePhase;
  whitePieces: PieceContribution[];
  blackPieces: PieceContribution[];
}

export interface FactorBreakdownItem {
  key: string;
  label: string;
  white: number;
  black: number;
  delta: number;
  description: string;
}

export interface EngineTopLine {
  moveUci: string;
  moveSan: string;
  evalCp: number;
  mate: number | null;
  lineSan: string;
}

export interface AiConfig {
  playerName: string;
  playerSide: Side;
  aiLevel: number;
  timeControl: TimeControl;
}

export type ColorPreference = "white" | "black" | "random";

export interface HostRoomConfig {
  hostName: string;
  roomCode: string;
  preferredColor: ColorPreference;
  timeControl: TimeControl;
}

export interface JoinRoomConfig {
  guestName: string;
  roomCode: string;
}
