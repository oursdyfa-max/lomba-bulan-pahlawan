import * as THREE from "three";
import { GameState } from "./GameState";

export class LevelManager {
  private cleanupLevel1: (() => void) | null = null;
  private playLevel2Portal: ((onComplete: () => void) => void) | null = null;
  private enterLevel2: (() => void) | null = null;
  private cleanupLevel2: (() => void) | null = null;
  private enterLevel3: (() => void) | null = null;

  constructor(
    private readonly gameState: GameState,
    private readonly levelRoot: THREE.Group,
  ) {}

  clearScene(scene: THREE.Object3D = this.levelRoot): void {
    while (scene.children.length > 0) {
      const object = scene.children[0];
      scene.remove(object);
      this.disposeObject(object);
    }
  }

  configureLevel2Transition(
    cleanupLevel1: () => void,
    playLevel2Portal: (onComplete: () => void) => void,
    enterLevel2: () => void,
  ): void {
    this.cleanupLevel1 = cleanupLevel1;
    this.playLevel2Portal = playLevel2Portal;
    this.enterLevel2 = enterLevel2;
  }

  configureLevel3Transition(cleanupLevel2: () => void, enterLevel3: () => void): void {
    this.cleanupLevel2 = cleanupLevel2;
    this.enterLevel3 = enterLevel3;
  }

  beginLevel2Transition(): void {
    this.cleanupLevel1?.();
    this.clearScene();
    this.playLevel2Portal?.(() => this.loadLevel2());
  }

  loadLevel2(): void {
    this.clearScene();
    this.gameState.currentLevel = "LEVEL_2";
    this.gameState.saveState();
    this.enterLevel2?.();
  }

  completeLevel2(): void {
    this.cleanupLevel2?.();
    this.clearScene();
    this.gameState.currentLevel = "LEVEL_3";
    this.gameState.saveState();
    this.enterLevel3?.();
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.dispose();
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) {
            value.dispose();
          }
        });
      });
    });
  }
}