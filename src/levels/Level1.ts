import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import GUI from "lil-gui";
import { GameState } from "../core/GameState";
import { loadGLTF } from "../core/AssetLoader";
import { Player } from "../entities/Player";
import { Level1UI } from "../ui/Level1UI";

interface RatData {
  isRat: true;
  isFound: boolean;
}

const RAT_HEIGHT = 0.28;
const LEVEL_SCALE = 2.2;
const RAT_POSITION_STORAGE_KEY = "dokter-djawa-level1-rat-positions";

type TransformMode = "translate" | "rotate" | "scale";

export class Level1 {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly controls: OrbitControls;
  private readonly transformControls: TransformControls;
  private readonly gui: GUI;
  private readonly editorSettings = {
    enabled: false,
    mode: "translate" as TransformMode,
    selected: "Belum memilih tikus",
    x: 0,
    y: 0,
    z: 0,
    resetSelected: () => this.resetSelectedRat(),
    resetAll: () => this.resetAllRats(),
    copyPosition: () => this.copySelectedPosition(),
  };
  private readonly rats: THREE.Object3D[] = [];
  private readonly initialRatPositions = new Map<THREE.Object3D, THREE.Vector3>();
  private readonly ratMixers = new Map<THREE.Object3D, THREE.AnimationMixer>();
  private readonly ratRoots = new Map<THREE.Object3D, THREE.Object3D>();
  private readonly environment = new THREE.Group();
  private readonly sfxRat = new Audio(
    new URL("../../assets/Sound/suara-tikus.mp3", import.meta.url).href,
  );
  private isActive = false;
  private selectedRat: THREE.Object3D | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly pointerTarget: HTMLElement,
    private readonly player: Player,
    private readonly gameState: GameState,
    private readonly ui: Level1UI,
  ) {
    this.environment.name = "Level1Environment";
    this.sfxRat.preload = "auto";
    this.scene.add(this.environment);
    void this.loadAssets();

    this.controls = new OrbitControls(this.camera, this.pointerTarget);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = Math.PI * 0.25;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.set(0, 1.5, 0);
    this.controls.enabled = false;

    this.transformControls = new TransformControls(this.camera, this.pointerTarget);
    this.transformControls.setMode(this.editorSettings.mode);
    this.transformControls.enabled = false;
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this.controls.enabled = this.isActive && !event.value;
    });
    this.transformControls.addEventListener("objectChange", () => {
      this.syncEditorPosition();
      this.saveRatPositions();
    });
    this.scene.add(this.transformControls.getHelper());

    this.gui = new GUI({ title: "Atur Posisi Tikus" });
    this.gui.domElement.style.top = "4.5rem";
    this.gui.domElement.style.zIndex = "20";
    this.gui.add(this.editorSettings, "enabled").name("Mode editor").onChange((enabled: boolean) => {
      this.setEditorMode(enabled);
    });
    this.gui
      .add(this.editorSettings, "mode", ["translate", "rotate", "scale"])
      .name("Transform")
      .onChange((mode: TransformMode) => {
        this.transformControls.setMode(mode);
      });
    this.gui.add(this.editorSettings, "selected").name("Tikus").disable();
    this.gui.add(this.editorSettings, "x", -10, 10, 0.01).name("Posisi X").onChange((value: number) => {
      this.updateSelectedPosition("x", value);
    });
    this.gui.add(this.editorSettings, "y", -10, 10, 0.01).name("Posisi Y").onChange((value: number) => {
      this.updateSelectedPosition("y", value);
    });
    this.gui.add(this.editorSettings, "z", -10, 10, 0.01).name("Posisi Z").onChange((value: number) => {
      this.updateSelectedPosition("z", value);
    });
    this.gui.add(this.editorSettings, "resetSelected").name("Reset tikus terpilih");
    this.gui.add(this.editorSettings, "resetAll").name("Reset semua tikus");
    this.gui.add(this.editorSettings, "copyPosition").name("Salin posisi");
    this.gui.domElement.style.display = "none";
    this.pointerTarget.addEventListener("pointerdown", this.handlePointerDown);
  }

  activate(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.player.setControlsEnabled(false);
    this.player.mesh.visible = false;
    this.controls.enabled = true;
    this.camera.position.set(8, 6, 10);
    this.controls.update();
    this.ui.showMission();
  }

  deactivate(): void {
    this.isActive = false;
    this.controls.enabled = false;
    this.setEditorMode(false);
    this.gui.domElement.style.display = "none";
    this.ui.hide();
  }

  update(deltaTime: number): void {
    if (this.isActive) {
      this.controls.update();
    }

    for (const mixer of this.ratMixers.values()) {
      mixer.update(deltaTime);
    }
  }

  dispose(): void {
    this.pointerTarget.removeEventListener("pointerdown", this.handlePointerDown);
    this.controls.dispose();
    this.transformControls.dispose();
    this.gui.destroy();
    for (const rat of this.rats) {
      this.ratMixers.get(rat)?.stopAllAction();
      this.ratMixers.get(rat)?.uncacheRoot(rat);
      this.scene.remove(rat);
      this.disposeObject(rat);
    }
    this.ratMixers.clear();
    this.ratRoots.clear();
    this.initialRatPositions.clear();
    this.rats.length = 0;
    this.disposeObject(this.environment);
  }

  private async loadAssets(): Promise<void> {
    try {
      const [environmentAsset, ratAsset] = await Promise.all([
        loadGLTF(new URL("../../assets/3d/Level1.glb", import.meta.url).href),
        loadGLTF(new URL("../../assets/3d/tikus.glb", import.meta.url).href),
      ]);

      this.addEnvironment(environmentAsset.scene);
      this.spawnRats(ratAsset.scene, ratAsset.animations);
    } catch (error) {
      console.error("Level 1 asset loading failed:", error);
    }
  }

  private addEnvironment(model: THREE.Object3D): void {
    model.name = "Level1GLBEnvironment";
    model.scale.setScalar(LEVEL_SCALE);
    model.position.set(0, 0, 0);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = true;
      }
    });
    this.environment.add(model);
  }

  private spawnRats(ratModel: THREE.Object3D, animations: THREE.AnimationClip[]): void {
    const ratSpawns: Array<[number, number, number]> = [
      [-1.1, 1.8, -1.2],
      [0.2, 0.08, -1.35],
      [1.15, 0.08, -1.5],
    ];

    for (const [x, y, z] of ratSpawns) {
      const rat = clone(ratModel);
      const sourceBounds = new THREE.Box3().setFromObject(rat);
      const sourceHeight = sourceBounds.max.y - sourceBounds.min.y;
      if (sourceHeight > 0) {
        rat.scale.setScalar(RAT_HEIGHT / sourceHeight);
      }
      rat.position.set(x * LEVEL_SCALE, y, z * LEVEL_SCALE);
      rat.name = "Level1Rat";
      rat.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData = { isRat: true, isFound: false } satisfies RatData;
          child.castShadow = false;
          child.receiveShadow = false;
          child.frustumCulled = true;
          child.material = Array.isArray(child.material)
            ? child.material.map((material) => material.clone())
            : child.material.clone();
          this.ratRoots.set(child, rat);
        }
      });
      const scaledBounds = new THREE.Box3().setFromObject(rat);
      rat.position.y += y - scaledBounds.min.y;
      this.initialRatPositions.set(rat, rat.position.clone());
      this.restoreRatPosition(rat, this.rats.length);
      this.scene.add(rat);
      this.rats.push(rat);

      if (animations.length > 0) {
        const mixer = new THREE.AnimationMixer(rat);
        mixer.clipAction(animations[0]).play();
        this.ratMixers.set(rat, mixer);
      }
    }
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.isActive) {
      return;
    }

    const bounds = this.pointerTarget.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObjects(this.rats, true)[0];
    const mesh = hit?.object;
    const data = mesh?.userData as Partial<RatData> | undefined;
    const rat = mesh ? this.ratRoots.get(mesh) : undefined;

    if (this.editorSettings.enabled) {
      this.selectRat(rat ?? null);
      return;
    }

    if (!rat || data?.isRat !== true || data.isFound) {
      return;
    }

    data.isFound = true;
    try {
      this.sfxRat.currentTime = 0;
      void this.sfxRat.play().catch((error: unknown) => {
        console.warn("Audio error:", error);
      });
    } catch (error) {
      console.warn("Audio error:", error);
    }
    const mixer = this.ratMixers.get(rat);
    mixer?.stopAllAction();
    mixer?.uncacheRoot(rat);
    this.ratMixers.delete(rat);
    this.scene.remove(rat);
    this.rats.splice(this.rats.indexOf(rat), 1);
    this.initialRatPositions.delete(rat);
    if (this.selectedRat === rat) {
      this.selectRat(null);
    }
    rat.traverse((child) => this.ratRoots.delete(child));
    this.disposeObject(rat);
    this.ui.ratFound();
  };

  private setEditorMode(enabled: boolean): void {
    const active = enabled && this.isActive;
    this.editorSettings.enabled = active;
    this.transformControls.enabled = active;
    this.controls.enabled = this.isActive && !active;
    if (!active) {
      this.selectRat(null);
    }
  }

  private selectRat(rat: THREE.Object3D | null): void {
    this.selectedRat = rat;
    if (rat) {
      this.transformControls.attach(rat);
      this.editorSettings.selected = rat.name;
      this.syncEditorPosition();
    } else {
      this.transformControls.detach();
      this.editorSettings.selected = "Belum memilih tikus";
    }
    this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  }

  private syncEditorPosition(): void {
    if (!this.selectedRat) {
      return;
    }

    this.editorSettings.x = this.selectedRat.position.x;
    this.editorSettings.y = this.selectedRat.position.y;
    this.editorSettings.z = this.selectedRat.position.z;
    this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  }

  private updateSelectedPosition(axis: "x" | "y" | "z", value: number): void {
    if (!this.selectedRat) {
      return;
    }

    this.selectedRat.position[axis] = value;
    this.saveRatPositions();
  }

  private resetSelectedRat(): void {
    if (!this.selectedRat) {
      return;
    }

    const initialPosition = this.initialRatPositions.get(this.selectedRat);
    if (initialPosition) {
      this.selectedRat.position.copy(initialPosition);
      this.syncEditorPosition();
      this.saveRatPositions();
    }
  }

  private resetAllRats(): void {
    for (const rat of this.rats) {
      const initialPosition = this.initialRatPositions.get(rat);
      if (initialPosition) {
        rat.position.copy(initialPosition);
      }
    }
    this.syncEditorPosition();
    this.saveRatPositions();
  }

  private restoreRatPosition(rat: THREE.Object3D, index: number): void {
    try {
      const savedPositions = JSON.parse(localStorage.getItem(RAT_POSITION_STORAGE_KEY) ?? "null") as
        | Array<[number, number, number]>
        | null;
      const savedPosition = savedPositions?.[index];
      if (savedPosition?.length === 3 && savedPosition.every(Number.isFinite)) {
        rat.position.set(...savedPosition);
      }
    } catch {
      localStorage.removeItem(RAT_POSITION_STORAGE_KEY);
    }
  }

  private saveRatPositions(): void {
    const positions = this.rats.map((rat) => [rat.position.x, rat.position.y, rat.position.z]);
    localStorage.setItem(RAT_POSITION_STORAGE_KEY, JSON.stringify(positions));
  }

  private copySelectedPosition(): void {
    if (!this.selectedRat) {
      return;
    }

    const position = this.selectedRat.position;
    const text = `[${position.x.toFixed(3)}, ${position.y.toFixed(3)}, ${position.z.toFixed(3)}]`;
    void navigator.clipboard?.writeText(text);
    console.info(`Posisi ${this.selectedRat.name}: ${text}`);
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }
}