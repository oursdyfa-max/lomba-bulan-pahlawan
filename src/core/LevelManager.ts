import { GameState } from "./GameState";

export class LevelManager {
  constructor(private readonly gameState: GameState) {}

  loadLevel2(): void {
    this.gameState.currentLevel = "LEVEL_2";
    this.gameState.saveState();
  }
}