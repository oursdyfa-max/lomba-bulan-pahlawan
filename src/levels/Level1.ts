import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { GameState } from "../core/GameState";
import { loadGLTF } from "../core/AssetLoader";
import { Player } from "../entities/Player";
import { Level1UI } from "../ui/Level1UI";
import { missionBanner } from "../ui/MissionBanner";

interface RatData {
  isRat: true;
  isFound: boolean;
}

const RAT_HEIGHT = 0.28;
const LEVEL_SCALE = 2.2;


export class Level1 {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly rats: THREE.Object3D[] = [];
  private readonly initialRatPositions = new Map<THREE.Object3D, THREE.Vector3>();
  private readonly ratMixers = new Map<THREE.Object3D, THREE.AnimationMixer>();
  private readonly ratRoots = new Map<THREE.Object3D, THREE.Object3D>();
  private readonly environment = new THREE.Group();
  private readonly sfxRat = new Audio(
    new URL("../../assets/Sound/suara-tikus.mp3", import.meta.url).href,
  );
  private isActive = false;
  private isDisposed = false;
  private assetsRequested = false;

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly pointerTarget: HTMLElement,
    private readonly player: Player,
    private readonly gameState: GameState,
    private readonly ui: Level1UI,
  ) {
    this.environment.name = "Level1Environment";
    this.sfxRat.preload = "auto";
    this.pointerTarget.addEventListener("pointerdown", this.handlePointerDown);
  }

  activate(): void {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.player.setControlsEnabled(false);
    this.player.mesh.visible = false;
    if (this.environment.parent !== this.scene) {
      this.scene.add(this.environment);
    }
    if (!this.assetsRequested) {
      this.assetsRequested = true;
      void this.loadAssets();
    }
    this.camera.position.set(-7.8, -1.6, 7);
    this.camera.lookAt(-6.5, 0.8, -1.6);
    this.ui.showMission();
    missionBanner.show("🔍 MISI: Cari dan klik tikus-tikus pembawa wabah pes!");
  }

  deactivate(): void {
    this.isActive = false;
    this.ui.hide();
    missionBanner.hide();
  }

  update(deltaTime: number): void {
    // Kamera fixed POV: jangan override lookAt tiap frame.

    for (const mixer of this.ratMixers.values()) {
      mixer.update(deltaTime);
    }

    // Efek pulse pada tikus agar terlihat interaktif
    const time = performance.now() * 0.004;
    for (let i = 0; i < this.rats.length; i += 1) {
      const rat = this.rats[i];
      if (!rat) continue;
      const base = (rat.userData.baseScale as number | undefined) ?? rat.scale.x;
      rat.userData.baseScale = base;
      const pulse = 1 + Math.sin(time + i * 2) * 0.08;
      rat.scale.setScalar(base * pulse);
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.isActive = false;
    this.pointerTarget.removeEventListener("pointerdown", this.handlePointerDown);
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
    this.scene.remove(this.environment);
    this.disposeObject(this.environment);
    this.sfxRat.pause();
    this.sfxRat.removeAttribute("src");
    this.sfxRat.load();
  }

  private async loadAssets(): Promise<void> {
    try {
      const [environmentAsset, ratAsset] = await Promise.all([
        loadGLTF(new URL("../../assets/3d/Level1.glb", import.meta.url).href),
        loadGLTF(new URL("../../assets/3d/tikus.glb", import.meta.url).href),
      ]);

      if (this.isDisposed) {
        return;
      }

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
    const ratTransforms: Array<{ position: [number, number, number]; rotation: [number, number, number] }> = [
      { position: [-8.59, 1.57, -6.13], rotation: [0, 1.55, 0] },
      { position: [-2, 4.8, -6.13], rotation: [0, 1.4, 0] },
      { position: [2.53, -2.5, -7.36], rotation: [0, -1.85, 0] },
    ];

    for (const t of ratTransforms) {
      const rat = clone(ratModel);
      const sourceBounds = new THREE.Box3().setFromObject(rat);
      const sourceHeight = sourceBounds.max.y - sourceBounds.min.y;
      if (sourceHeight > 0) {
        rat.scale.setScalar(RAT_HEIGHT / sourceHeight);
      }
      rat.position.set(...t.position);
      rat.rotation.set(...t.rotation);
      rat.name = `Tikus ${this.rats.length + 1}`;
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
      this.initialRatPositions.set(rat, rat.position.clone());
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
    rat.traverse((child) => this.ratRoots.delete(child));
    this.disposeObject(rat);
    this.ui.ratFound();
  };

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
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
      }
    });
  }
}