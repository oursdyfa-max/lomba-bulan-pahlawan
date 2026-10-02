import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { loadGLTF } from "../core/AssetLoader";
import { GameState } from "../core/GameState";
import { Level2UI } from "../ui/Level2UI";

const LEVEL2_ASSETS = {
  environment: new URL("../../assets/Level2/PosKesehatan.glb", import.meta.url).href,
  patient: new URL("../../assets/Level2/NpcPasien.fbx", import.meta.url).href,
  sitting: new URL("../../assets/Level2/anims/sitting-idle.fbx", import.meta.url).href,
  idle: new URL("../../assets/Level2/anims/idle.fbx", import.meta.url).href,
  walking: new URL("../../assets/Level2/anims/walking.fbx", import.meta.url).href,
};

const PLAYER_SPEED = 3.2;
const PLAYER_EYE_HEIGHT = 1.6;
const GRAVITY = 9.8 * 10.0;
const JUMP_FORCE = 350;
const NPC_SPEED = 1.2;
const INTERACTION_DISTANCE = 2.5;
const WAYPOINT_NAMES = ["POS_DUDUK_1", "POS_DUDUK_2", "POS_DUDUK_3", "POS_ARAH", "POS_INTERAKSI"] as const;

const NPC_CONFIGS = [
  { id: 1, position: new THREE.Vector3(0.5, 1.3, -0.5), scale: new THREE.Vector3(0.1, 0.1, 0.1), rotation: new THREE.Euler(0.07, 0.017, 0.068) },
  { id: 2, position: new THREE.Vector3(1.9, 1.3, -0.5), scale: new THREE.Vector3(0.1, 0.1, 0.1), rotation: new THREE.Euler(0.07, 0.017, 0.068) },
  { id: 3, position: new THREE.Vector3(3.5, 1.3, -0.5), scale: new THREE.Vector3(0.1, 0.1, 0.1), rotation: new THREE.Euler(0.07, 0.017, 0.068) },
] as const;

type WaypointName = (typeof WAYPOINT_NAMES)[number];
type NpcState = "SITTING" | "WALKING_TO_INTERACT" | "WAITING" | "WALKING_BACK";
type MoveKey = "forward" | "backward" | "left" | "right" | "up" | "down";

interface NpcAgent {
  id: number;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  state: NpcState;
  sitPosition: THREE.Vector3;
  sitRotation: THREE.Euler;
  turnPosition: THREE.Vector3;
  interactPosition: THREE.Vector3;
  route: THREE.Vector3[];
  routeIndex: number;
}

export class Level2 {
  private readonly environment = new THREE.Group();
  private readonly waypointPositions = new Map<WaypointName, THREE.Vector3>();
  private readonly fbxLoader = new FBXLoader();
  private readonly npcAgents: NpcAgent[] = [];
  private readonly mixers = new Map<THREE.Object3D, THREE.AnimationMixer>();
  private readonly moveState = { forward: false, backward: false, left: false, right: false, up: false, down: false };
  private readonly raycaster = new THREE.Raycaster();
  private readonly collisionRaycaster = new THREE.Raycaster();
  private readonly floorRaycaster = new THREE.Raycaster();
  private readonly colliderObjects: THREE.Object3D[] = [];
  private readonly center = new THREE.Vector2(0, 0);
  private readonly pointerLock: PointerLockControls;
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  private readonly directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  private readonly crosshair: HTMLDivElement;
  private readonly lockPrompt: HTMLDivElement;
  private readonly lookTarget = new THREE.Vector3();
  private readonly playerPosition = new THREE.Vector3();
  private readonly walkingDirection = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly floorDirection = new THREE.Vector3(0, -1, 0);
  private readonly collisionDirection = new THREE.Vector3();
  private readonly collisionOrigin = new THREE.Vector3();
  private readonly playerRadius = 0.5;
  private canJump = false;
  private environmentModel: THREE.Object3D | null = null;
  private patientModel: THREE.Object3D | null = null;
  private sittingClip: THREE.AnimationClip | null = null;
  private idleClip: THREE.AnimationClip | null = null;
  private walkingClip: THREE.AnimationClip | null = null;
  private activeNpc: NpcAgent | null = null;
  private nextNpcIndex = 0;
  private isActive = false;
  private isDisposed = false;
  private assetsRequested = false;

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly pointerTarget: HTMLElement,
    private readonly gameState: GameState,
    private readonly ui: Level2UI,
  ) {
    this.environment.name = "Level2HealthPostEnvironment";
    this.directionalLight.position.set(6, 12, 8);
    this.directionalLight.castShadow = true;

    this.pointerLock = new PointerLockControls(this.camera, this.pointerTarget);
    this.pointerLock.enabled = false;
    this.pointerLock.addEventListener("lock", this.handleLock);
    this.pointerLock.addEventListener("unlock", this.handleUnlock);

    this.crosshair = document.createElement("div");
    this.crosshair.className = "level2-crosshair";
    this.crosshair.hidden = true;
    document.body.appendChild(this.crosshair);

    this.lockPrompt = document.createElement("div");
    this.lockPrompt.id = "pointer-lock-ui";
    this.lockPrompt.textContent = "Klik layar untuk mulai bermain";
    this.lockPrompt.hidden = true;
    Object.assign(this.lockPrompt.style, {
      position: "fixed", inset: "0", zIndex: "14", display: "none", placeItems: "center",
      color: "#f4f1de", font: "700 1rem monospace", pointerEvents: "none", textShadow: "0 2px 4px rgb(0 0 0 / 80%)",
    });
    document.body.appendChild(this.lockPrompt);

    this.scene.add(this.environment, this.ambientLight, this.directionalLight);
    this.pointerTarget.addEventListener("click", this.handleCanvasClick);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    if (this.environment.parent !== this.scene) this.scene.add(this.environment);
    if (this.ambientLight.parent !== this.scene) this.scene.add(this.ambientLight);
    if (this.directionalLight.parent !== this.scene) this.scene.add(this.directionalLight);
    this.environment.visible = true;
    if (this.environmentModel) this.environmentModel.visible = true;
    this.npcAgents.forEach((agent) => { agent.root.visible = true; });
    this.pointerLock.enabled = true;
    this.crosshair.hidden = false;
    this.showLockPrompt(false);
    this.ui.showMission();
    this.resetGameplayState();
    if (!this.assetsRequested) {
      this.assetsRequested = true;
      void this.loadAssets();
    }
  }

  deactivate(): void {
    this.isActive = false;
    this.pointerLock.enabled = false;
    if (this.pointerLock.isLocked) this.pointerLock.unlock();
    this.resetMoveState();
    this.velocity.set(0, 0, 0);
    this.canJump = false;
    this.environment.visible = false;
    if (this.environmentModel) this.environmentModel.visible = false;
    this.npcAgents.forEach((agent) => { agent.root.visible = false; });
    this.crosshair.hidden = true;
    this.showLockPrompt(false);
    this.ui.hide();
  }

  update(deltaTime: number): void {
    if (!this.isActive) return;
    for (const mixer of this.mixers.values()) mixer.update(deltaTime);
    this.updateCamera(deltaTime);
    this.updateNpcStateMachines(deltaTime);
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.pointerTarget.removeEventListener("click", this.handleCanvasClick);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.pointerLock.removeEventListener("lock", this.handleLock);
    this.pointerLock.removeEventListener("unlock", this.handleUnlock);
    if (this.pointerLock.isLocked) this.pointerLock.unlock();
    this.pointerLock.dispose();
    this.scene.remove(this.environment, this.ambientLight, this.directionalLight);
    if (this.environmentModel) this.scene.remove(this.environmentModel);
    for (const agent of this.npcAgents) this.scene.remove(agent.root);
    for (const [root, mixer] of this.mixers) {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    }
    this.mixers.clear();
    this.disposeObject(this.environment);
    if (this.environmentModel) this.disposeObject(this.environmentModel);
    this.ui.dispose();
    this.crosshair.remove();
    this.showLockPrompt(false);
    this.lockPrompt.remove();
    this.npcAgents.length = 0;
    this.environmentModel = null;
    this.colliderObjects.length = 0;
  }

  private async loadAssets(): Promise<void> {
    let environmentAsset: { scene: THREE.Object3D };
    try {
      environmentAsset = await loadGLTF(LEVEL2_ASSETS.environment);
      if (this.isDisposed) return;
      this.prepareEnvironment(environmentAsset.scene);
      this.extractWaypoints(environmentAsset.scene);
      this.hideWaypointNodes(environmentAsset.scene);
      this.spawnPlayerAtInteractionPoint();
      this.showLockPrompt(true);
    } catch (error) {
      console.error("Gagal memuat PosKesehatan.glb:", error);
      return;
    }

    try {
      const [patient, sitting, idle, walking] = await Promise.all([
        this.loadNpcModel(),
        this.fbxLoader.loadAsync(LEVEL2_ASSETS.sitting),
        this.fbxLoader.loadAsync(LEVEL2_ASSETS.idle),
        this.fbxLoader.loadAsync(LEVEL2_ASSETS.walking),
      ]);
      if (this.isDisposed) return;
      this.patientModel = patient;
      this.sittingClip = sitting.animations[0] ?? null;
      this.idleClip = idle.animations[0] ?? null;
      this.walkingClip = walking.animations[0] ?? null;
      this.createNpcAgents();
      this.resetGameplayState();
    } catch (error) {
      console.error("Gagal memuat aset NPC Level 2; room tetap dirender:", error);
    }
  }

  private loadNpcModel(): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      new FBXLoader().load(LEVEL2_ASSETS.patient, resolve, undefined, (error) => {
        console.error("Gagal load NPC:", error);
        reject(error);
      });
    });
  }

  private prepareEnvironment(model: THREE.Object3D): void {
    model.name = "PosKesehatan";
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.environmentModel = model;
    this.scene.add(model);
    const spawnPoint = model.getObjectByName("Cube.004");
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (spawnPoint && spawnPoint.getObjectById(child.id)) return;
      this.colliderObjects.push(child);
    });
  }

  private extractWaypoints(model: THREE.Object3D): void {
    model.updateMatrixWorld(true);
    for (const name of WAYPOINT_NAMES) {
      const node = model.getObjectByName(name);
      const fallback = this.getWaypointFallback(name);
      const position = new THREE.Vector3();
      if (node) node.getWorldPosition(position);
      else {
        position.copy(fallback);
        console.warn(`Waypoint ${name} tidak ditemukan; memakai fallback`, fallback.toArray());
      }
      this.waypointPositions.set(name, position);
    }
  }

  private hideWaypointNodes(model: THREE.Object3D): void {
    for (const name of WAYPOINT_NAMES) {
      const node = model.getObjectByName(name);
      if (node) node.visible = false;
    }
  }

  private createNpcAgents(): void {
    if (!this.patientModel || this.npcAgents.length > 0) return;
    for (const config of NPC_CONFIGS) {
      try {
        const npc = SkeletonUtils.clone(this.patientModel);
        npc.name = `NpcPasien_${config.id}`;
        npc.position.copy(config.position);
        npc.scale.copy(config.scale);
        npc.rotation.copy(config.rotation);
        npc.visible = true;
        npc.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.userData = { isPatient: true, npcId: config.id };
            child.castShadow = true;
          }
        });
        this.scene.add(npc);
        const mixer = new THREE.AnimationMixer(npc);
        this.mixers.set(npc, mixer);
        this.npcAgents.push({
          id: config.id,
          root: npc,
          mixer,
          state: "SITTING",
          sitPosition: config.position.clone(),
          sitRotation: config.rotation.clone(),
          turnPosition: this.getWaypoint("POS_ARAH"),
          interactPosition: this.getWaypoint("POS_INTERAKSI"),
          route: [],
          routeIndex: 0,
        });
      } catch (error) {
        console.error(`Gagal melakukan clone NPC ${config.id}:`, error);
      }
    }
    console.log(`NPC Berhasil dimuat dan di-add ke scene: ${this.npcAgents.length}/3`);
  }

  private resetGameplayState(): void {
    this.nextNpcIndex = 0;
    this.activeNpc = null;
    for (const agent of this.npcAgents) {
      agent.root.position.copy(agent.sitPosition);
      agent.root.rotation.copy(agent.sitRotation);
      agent.root.visible = true;
      agent.state = "SITTING";
      agent.route = [];
      agent.routeIndex = 0;
      this.playNpcAnimation(agent, this.sittingClip);
    }
    if (this.waypointPositions.has("POS_INTERAKSI")) this.spawnPlayerAtInteractionPoint();
    else {
      this.camera.position.set(0, 1.6, 4.0);
      this.camera.lookAt(0, 1.0, 0);
    }
    this.startNextNpc();
  }

  private spawnPlayerAtInteractionPoint(): void {
    const interactionPoint = this.waypointPositions.get("POS_INTERAKSI");
    if (!interactionPoint) {
      console.warn("POS_INTERAKSI tidak ditemukan; memakai spawn kamera default.");
      this.camera.position.set(0, 1.6, 4.0);
      this.camera.lookAt(0, 1.0, 0);
      return;
    }
    this.pointerLock.object.position.set(interactionPoint.x, interactionPoint.y + PLAYER_EYE_HEIGHT, interactionPoint.z);
    this.camera.lookAt(interactionPoint.x, interactionPoint.y + 1.0, interactionPoint.z - 1);
    console.log("Spawn player di POS_INTERAKSI:", interactionPoint);
  }

  private startNextNpc(): void {
    const agent = this.npcAgents[this.nextNpcIndex];
    if (!agent) return;
    agent.route = [agent.turnPosition, agent.interactPosition];
    agent.routeIndex = 0;
    this.setNpcState(agent, "WALKING_TO_INTERACT");
  }

  private updateCamera(deltaTime: number): void {
    if (!this.pointerLock.isLocked) return;
    const speed = PLAYER_SPEED * deltaTime;
    this.velocity.x *= Math.max(0, 1 - 10 * deltaTime);
    this.velocity.z *= Math.max(0, 1 - 10 * deltaTime);
    this.velocity.y -= GRAVITY * deltaTime;

    this.direction.set(0, 0, 0);
    if (this.moveState.forward) this.direction.z -= 1;
    if (this.moveState.backward) this.direction.z += 1;
    if (this.moveState.left) this.direction.x -= 1;
    if (this.moveState.right) this.direction.x += 1;
    if (this.direction.lengthSq() > 0) this.direction.normalize();
    this.velocity.x = this.direction.x * PLAYER_SPEED;
    this.velocity.z = this.direction.z * PLAYER_SPEED;

    this.updateFloorState();
    if (this.moveState.up && this.canJump) {
      this.velocity.y += JUMP_FORCE * deltaTime;
      this.canJump = false;
    }

    if (this.velocity.x !== 0) this.tryHorizontalMove("right", this.velocity.x * deltaTime);
    if (this.velocity.z !== 0) this.tryHorizontalMove("forward", -this.velocity.z * deltaTime);
    this.camera.position.y += this.velocity.y * deltaTime;
    this.updateFloorState();
    this.updateHUDPosition(this.camera.position);
  }

  private updateFloorState(): void {
    if (this.colliderObjects.length === 0) return;
    this.floorRaycaster.set(this.camera.position, this.floorDirection);
    this.floorRaycaster.near = 0;
    this.floorRaycaster.far = PLAYER_EYE_HEIGHT + 0.05;
    const hit = this.floorRaycaster.intersectObjects(this.colliderObjects, true)[0];
    if (!hit || hit.distance > PLAYER_EYE_HEIGHT) return;
    this.camera.position.y = hit.point.y + PLAYER_EYE_HEIGHT;
    this.velocity.y = Math.max(0, this.velocity.y);
    this.canJump = true;
  }

  private tryHorizontalMove(axis: "right" | "forward", distance: number): void {
    this.camera.getWorldDirection(this.walkingDirection);
    this.walkingDirection.y = 0;
    this.walkingDirection.normalize();
    if (axis === "right") {
      this.collisionDirection.crossVectors(this.walkingDirection, this.camera.up).normalize();
      if (!this.canMove(this.collisionDirection, distance)) return;
      this.pointerLock.moveRight(distance);
      return;
    }
    if (!this.canMove(this.walkingDirection, distance)) return;
    this.pointerLock.moveForward(distance);
  }

  private canMove(direction: THREE.Vector3, distance: number): boolean {
    if (distance === 0 || this.colliderObjects.length === 0) {
      return true;
    }
    this.collisionOrigin.copy(this.camera.position);
    this.collisionDirection.copy(direction).normalize().multiplyScalar(Math.sign(distance));
    this.collisionRaycaster.set(this.collisionOrigin, this.collisionDirection);
    this.collisionRaycaster.near = 0;
    this.collisionRaycaster.far = Math.abs(distance) + this.playerRadius;
    const hit = this.collisionRaycaster.intersectObjects(this.colliderObjects, true)[0];
    return !hit || hit.distance > Math.abs(distance) + this.playerRadius;
  }

  private updateNpcStateMachines(deltaTime: number): void {
    for (const agent of this.npcAgents) {
      if (agent.state !== "WALKING_TO_INTERACT" && agent.state !== "WALKING_BACK") continue;
      const target = agent.route[agent.routeIndex];
      if (!target) {
        if (agent.state === "WALKING_TO_INTERACT") this.setNpcState(agent, "WAITING");
        else this.finishNpcReturn(agent);
        continue;
      }
      if (this.moveNpcTowards(agent, target, deltaTime)) {
        agent.routeIndex += 1;
        if (agent.routeIndex >= agent.route.length) {
          if (agent.state === "WALKING_TO_INTERACT") this.setNpcState(agent, "WAITING");
          else this.finishNpcReturn(agent);
        }
      }
    }
  }

  private moveNpcTowards(agent: NpcAgent, target: THREE.Vector3, deltaTime: number): boolean {
    const distance = agent.root.position.distanceTo(target);
    const step = NPC_SPEED * deltaTime;
    if (distance <= step) {
      agent.root.position.copy(target);
      return true;
    }
    this.lookTarget.copy(target);
    this.lookTarget.y = agent.root.position.y;
    agent.root.lookAt(this.lookTarget);
    agent.root.position.lerp(target, Math.min(1, step / distance));
    return false;
  }

  private finishNpcReturn(agent: NpcAgent): void {
    agent.root.position.copy(agent.sitPosition);
    agent.root.rotation.copy(agent.sitRotation);
    this.setNpcState(agent, "SITTING");
    if (agent.id === 3) this.ui.showCompletion();
    else {
      this.nextNpcIndex += 1;
      this.activeNpc = null;
      this.startNextNpc();
    }
  }

  private setNpcState(agent: NpcAgent, state: NpcState): void {
    agent.state = state;
    if (state === "SITTING") this.playNpcAnimation(agent, this.sittingClip);
    if (state === "WAITING") this.playNpcAnimation(agent, this.idleClip);
    if (state === "WALKING_TO_INTERACT" || state === "WALKING_BACK") this.playNpcAnimation(agent, this.walkingClip);
  }

  private playNpcAnimation(agent: NpcAgent, clip: THREE.AnimationClip | null): void {
    if (!clip) return;
    agent.mixer.stopAllAction();
    agent.mixer.clipAction(clip).reset().play();
  }

  private tryInteract(): void {
    this.raycaster.setFromCamera(this.center, this.camera);
    const hit = this.raycaster.intersectObjects(this.npcAgents.map((agent) => agent.root), true)[0];
    const agent = hit ? this.npcAgents.find((candidate) => candidate.root.getObjectById(hit.object.id)) : null;
    if (!agent || agent.state !== "WAITING") return;
    this.playerPosition.copy(this.camera.position);
    if (this.playerPosition.distanceTo(agent.root.position) >= INTERACTION_DISTANCE) return;
    this.activeNpc = agent;
    this.ui.showDiagnosis(() => this.completeDiagnosis(), () => this.retryDiagnosis());
  }

  private completeDiagnosis(): void {
    if (!this.activeNpc) return;
    this.gameState.addScore(100);
    const agent = this.activeNpc;
    agent.route = [agent.turnPosition, agent.sitPosition];
    agent.routeIndex = 0;
    this.setNpcState(agent, "WALKING_BACK");
    this.ui.showCorrect(() => this.ui.hide());
  }

  private retryDiagnosis(): void {
    this.ui.showIncorrect(() => this.ui.showDiagnosis(() => this.completeDiagnosis(), () => this.retryDiagnosis()));
  }

  private readonly handleCanvasClick = (): void => {
    if (this.isActive && !this.pointerLock.isLocked) this.pointerLock.lock();
  };

  private readonly handleLock = (): void => this.showLockPrompt(false);

  private readonly handleUnlock = (): void => {
    this.resetMoveState();
    this.showLockPrompt(true);
  };

  private readonly handleKeyDown = (event?: KeyboardEvent): void => {
    if (!event || !event.key || typeof event.key !== "string") return;
    const key = event.key.toLowerCase();
    if (!this.isActive || !this.pointerLock.isLocked) return;
    if (key === "e") {
      event.preventDefault();
      this.tryInteract();
      return;
    }
    const movementKey = this.getMoveKey(event.code);
    if (movementKey) {
      event.preventDefault();
      this.moveState[movementKey] = true;
    }
  };

  private readonly handleKeyUp = (event?: KeyboardEvent): void => {
    if (!event || !event.key || typeof event.key !== "string") return;
    const key = event.key.toLowerCase();
    const movementKey = this.getMoveKey(event.code);
    if (movementKey) this.moveState[movementKey] = false;
    if (key === " ") this.moveState.up = false;
  };

  private getMoveKey(code: string): MoveKey | null {
    if (code === "KeyW" || code === "ArrowUp") return "forward";
    if (code === "KeyS" || code === "ArrowDown") return "backward";
    if (code === "KeyA" || code === "ArrowLeft") return "left";
    if (code === "KeyD" || code === "ArrowRight") return "right";
    if (code === "Space") return "up";
    if (code === "ShiftLeft" || code === "ShiftRight") return "down";
    return null;
  }

  private resetMoveState(): void {
    this.moveState.forward = false;
    this.moveState.backward = false;
    this.moveState.left = false;
    this.moveState.right = false;
    this.moveState.up = false;
    this.moveState.down = false;
  }

  private showLockPrompt(visible: boolean): void {
    const shouldShow = visible && this.isActive && this.gameState.currentLevel === "LEVEL_2" && !this.pointerLock.isLocked;
    this.lockPrompt.style.display = shouldShow ? "flex" : "none";
  }

  private updateHUDPosition(position: THREE.Vector3): void {
    const element = document.querySelector<HTMLElement>("#position");
    if (element) element.textContent = `Posisi: X ${position.x.toFixed(1)} | Y ${position.y.toFixed(1)} | Z ${position.z.toFixed(1)}`;
  }

  private getWaypoint(name: WaypointName): THREE.Vector3 {
    return this.waypointPositions.get(name)?.clone() ?? this.getWaypointFallback(name);
  }

  private getWaypointFallback(name: WaypointName): THREE.Vector3 {
    if (name === "POS_DUDUK_1") return new THREE.Vector3(-1, 0, 0);
    if (name === "POS_DUDUK_2") return new THREE.Vector3(-2, 0, 0);
    if (name === "POS_DUDUK_3") return new THREE.Vector3(-3, 0, 0);
    if (name === "POS_ARAH") return new THREE.Vector3(0, 0, -1);
    return new THREE.Vector3(1, 0, 0);
  }

  private disposeObject(object: THREE.Object3D): void {
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.dispose();
        Object.values(material).forEach((value) => {
          if (value instanceof THREE.Texture) value.dispose();
        });
      });
    });
  }
}
