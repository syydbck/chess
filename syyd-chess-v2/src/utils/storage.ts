import type { SavedGame } from "../types";

const GAMES_KEY = "syyd_chess_games_v1";
const PLAYER_NAME_KEY = "syyd_chess_player_name_v1";

export const loadPlayerName = (): string => {
  const value = localStorage.getItem(PLAYER_NAME_KEY);
  if (!value) {
    return "Player";
  }
  return value.trim() || "Player";
};

export const savePlayerName = (name: string) => {
  localStorage.setItem(PLAYER_NAME_KEY, name.trim() || "Player");
};

export const loadGames = (): SavedGame[] => {
  const raw = localStorage.getItem(GAMES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as SavedGame[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
};

export const saveGame = (game: SavedGame): SavedGame[] => {
  const games = loadGames();
  const next = [game, ...games].slice(0, 200);
  localStorage.setItem(GAMES_KEY, JSON.stringify(next));
  return next;
};

export const getGameById = (id: string): SavedGame | null => {
  const game = loadGames().find((item) => item.id === id);
  return game ?? null;
};

export const clearGames = () => {
  localStorage.removeItem(GAMES_KEY);
};
