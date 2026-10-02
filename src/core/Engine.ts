import * as THREE from "three";
import { Environment } from "../entities/Environment";
import { Player } from "../entities/Player";
import { Debugger } from "../systems/Debugger";
import { HUD } from "../ui/HUD";
import { gameState } from "./GameState";
import { Physics } from "./Physics";
import type { Level1 } from "../levels/Level1";
import type { Level2 } from "../levels/Level2";

export class Engine {
  readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly orbitTarget = new THREE.Vector3(0, 1, 0);
  private level1: Level1 | null = null;
  private level2: Level2 | null = null;
  private lastLevel = gameState.currentLevel;
  private isCinematicMode = false;

  constructor(
    private readonly canvas: HTMLElement,
    scene: THREE.Scene,
    private readonly physics: Physics,
    private readonly player: Player,
    private readonly environment: Environment,
    private readonly debuggerSystem: Debugger,
    private readonly hud: HUD,
  ) {
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    this.camera.position.set(0, 4, 8);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;
    this.canvas.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x9dc5c2);
    this.addLighting();
    this.scene.add(this.player.mesh);
    window.addEventListener("resize", this.handleResize);
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getRenderElement(): HTMLElement {
    return this.renderer.domElement;
  }

  setLevel1(level1: Level1): void {
    this.level1 = level1;
  }

  setLevel2(level2: Level2): void {
    this.level2 = level2;
  }

  enterLevel1(): void {
    gameState.currentLevel = "LEVEL_1";
    if (this.lastLevel === "LEVEL_1" || !this.level1) {
      return;
    }

    this.level1.activate();
    this.lastLevel = "LEVEL_1";
  }

  enterLevel2(): void {
    if (!this.level2) {
      return;
    }

    if (this.lastLevel === "LEVEL_1" && this.level1) {
      this.level1.deactivate();
    }
    this.environment.group.visible = false;
    this.level2.activate();
    this.lastLevel = "LEVEL_2";
  }

  setCinematicMode(enabled: boolean): void {
    if (this.isCinematicMode && !enabled) {
      this.clock.getDelta();
    }
    this.isCinematicMode = enabled;
  }

  start(): void {
    this.clock.start();
    requestAnimationFrame(this.loop);
  }

  private readonly loop = (): void => {
    if (this.isCinematicMode) {
      requestAnimationFrame(this.loop);
      return;
    }

    const deltaTime = this.clock.getDelta();
    if (gameState.currentLevel === "START") {
      this.updateStartCamera();
      this.hud.setInteractionHint(false);
    } else if (gameState.currentLevel === "LEVEL_1" && this.level1) {
      if (this.lastLevel !== "LEVEL_1") {
        this.level1.activate();
      }
      this.level1.update(deltaTime);
      this.hud.setInteractionHint(false);
    } else if (gameState.currentLevel === "LEVEL_2" && this.level2) {
      if (this.lastLevel !== "LEVEL_2") {
        this.level2.activate();
      }
      this.level2.update(deltaTime);
      this.hud.setInteractionHint(false);
    } else {
      if (this.lastLevel === "LEVEL_1" && this.level1) {
        this.level1.deactivate();
      }
      if (this.lastLevel === "LEVEL_2" && this.level2) {
        this.level2.deactivate();
      }
      this.player.update();
      this.physics.update(deltaTime);
      this.player.syncMesh();
      this.environment.syncMeshes();
      this.player.updateProximity(this.environment.obstacles);
      this.hud.setInteractionHint(this.player.hasActivePatient);

      this.player.getCameraPosition(this.cameraTarget);
      const smoothing = 1 - Math.exp(-8 * deltaTime);
      this.camera.position.lerp(this.cameraTarget, smoothing);
      this.camera.lookAt(this.player.position);
    }
    this.lastLevel = gameState.currentLevel;
    this.debuggerSystem.update();
    if (gameState.currentLevel !== "LEVEL_2") {
      this.hud.update(this.player.position);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  private updateStartCamera(): void {
    const elapsed = this.clock.elapsedTime;
    const orbitRadius = 10;
    this.camera.position.set(
      Math.sin(elapsed * 0.16) * orbitRadius,
      5 + Math.sin(elapsed * 0.22) * 0.35,
      Math.cos(elapsed * 0.16) * orbitRadius,
    );
    this.camera.lookAt(this.orbitTarget);
  }

  private readonly handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private addLighting(): void {
    this.scene.add(new THREE.AmbientLight(0xfff4d6, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffe0a3, 1.0);
    directionalLight.position.set(8, 14, 6);
    directionalLight.castShadow = false;
    this.scene.add(directionalLight);
  }
}
