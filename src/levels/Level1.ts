import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GameState } from "../core/GameState";
import { Player } from "../entities/Player";
import { Level1UI } from "../ui/Level1UI";

interface RatData {
  isRat: true;
  isFound: boolean;
}

export class Level1 {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly controls: OrbitControls;
  private readonly rats: THREE.Mesh[] = [];
  private readonly environment = new THREE.Group();
  private isActive = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly pointerTarget: HTMLElement,
    private readonly player: Player,
    private readonly gameState: GameState,
    private readonly ui: Level1UI,
  ) {
    this.environment.name = "Level1Environment";
    this.scene.add(this.environment);
    this.buildEnvironment();
    this.spawnRats();

    this.controls = new OrbitControls(this.camera, this.pointerTarget);
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    this.controls.minPolarAngle = Math.PI * 0.25;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.target.set(0, 1.5, 0);
    this.controls.enabled = false;
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
    this.ui.hide();
  }

  update(): void {
    if (this.isActive) {
      this.controls.update();
    }
  }

  dispose(): void {
    this.pointerTarget.removeEventListener("pointerdown", this.handlePointerDown);
    this.controls.dispose();
    this.disposeObject(this.environment);
  }

  private buildEnvironment(): void {
    const brownMaterial = new THREE.MeshStandardMaterial({ color: 0x6e4328 });
    const addBox = (size: [number, number, number], position: [number, number, number]): void => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), brownMaterial.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.environment.add(mesh);
    };

    addBox([14, 0.2, 12], [0, -0.1, 0]);
    addBox([0.3, 5, 12], [-7, 2.5, 0]);
    addBox([14, 5, 0.3], [0, 2.5, -6]);
    addBox([5, 1.1, 2.4], [-1.5, 0.8, 0.5]);
    addBox([2.8, 4, 1.4], [4.8, 2, -2.5]);
    addBox([2.8, 4, 1.4], [-4.8, 2, -3.6]);
  }

  private spawnRats(): void {
    const ratMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const ratSpawns: Array<[number, number, number]> = [
      [-1.5, 1.45, 0.5],
      [4.8, 0.6, -1.65],
      [-4.8, 0.6, -2.75],
    ];

    for (const position of ratSpawns) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.7), ratMaterial.clone());
      mesh.position.set(...position);
      mesh.castShadow = true;
      mesh.userData = { isRat: true, isFound: false } satisfies RatData;
      this.scene.add(mesh);
      this.rats.push(mesh);
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

    const hit = this.raycaster.intersectObjects(this.rats, false)[0];
    const rat = hit?.object as THREE.Mesh | undefined;
    const data = rat?.userData as Partial<RatData> | undefined;
    if (!rat || data?.isRat !== true || data.isFound) {
      return;
    }

    data.isFound = true;
    this.scene.remove(rat);
    this.rats.splice(this.rats.indexOf(rat), 1);
    this.disposeObject(rat);
    this.ui.ratFound();
  };

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