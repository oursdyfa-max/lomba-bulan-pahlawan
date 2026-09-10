export type GameLevel = "START" | "LEVEL_1" | "LEVEL_2" | "LEVEL_3" | "END";
export type Badge = "Gold" | "Silver" | "Bronze";

interface PersistedGameState {
  playerName: string;
  score: number;
  currentLevel: GameLevel;
}

const STORAGE_KEY = "dokter_djawa_state";

export class GameState {
  playerName = "";
  score = 0;
  currentLevel: GameLevel = "START";

  constructor() {
    this.loadState();
  }

  saveState(): void {
    const state: PersistedGameState = {
      playerName: this.playerName,
      score: this.score,
      currentLevel: this.currentLevel,
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private browsing or restricted contexts.
    }
  }

  loadState(): void {
    try {
      const rawState = window.localStorage.getItem(STORAGE_KEY);
      if (!rawState) {
        return;
      }

      const state = JSON.parse(rawState) as Partial<PersistedGameState>;
      if (typeof state.playerName === "string") {
        this.playerName = state.playerName.slice(0, 20);
      }
      if (typeof state.score === "number" && Number.isFinite(state.score)) {
        this.score = Math.max(0, state.score);
      }
      if (state.currentLevel && this.isValidLevel(state.currentLevel)) {
        this.currentLevel = state.currentLevel;
      }
    } catch {
      this.resetInMemory();
    }
  }

  resetState(): void {
    this.resetInMemory();

    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Keep the in-memory reset effective when storage is unavailable.
    }
  }

  addScore(points: number): void {
    if (!Number.isFinite(points)) {
      return;
    }

    this.score = Math.max(0, this.score + points);
    this.saveState();
  }

  getBadge(): Badge {
    if (this.score >= 100) {
      return "Gold";
    }
    if (this.score >= 50) {
      return "Silver";
    }
    return "Bronze";
  }

  private resetInMemory(): void {
    this.playerName = "";
    this.score = 0;
    this.currentLevel = "START";
  }

  private isValidLevel(level: string): level is GameLevel {
    return ["START", "LEVEL_1", "LEVEL_2", "LEVEL_3", "END"].includes(level);
  }
}

export const gameState = new GameState();