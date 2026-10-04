import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { loadGLTF } from "../core/AssetLoader";
import { GameState } from "../core/GameState";
import { Level2UI } from "../ui/Level2UI";
import { playBenar, playSalah } from "../core/Sfx";
import { missionBanner } from "../ui/MissionBanner";

const LEVEL2_ASSETS = {
  environment: new URL("../../assets/Level2/PosKesehatan.glb", import.meta.url).href,
  bathroom: new URL("../../assets/Level2/KAMARMANDI.glb", import.meta.url).href,
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

const QUIZ_DATA = [
  { question: "Malaria terutama ditularkan melalui...", options: ["A. Gigitan nyamuk Aedes", "B. Gigitan nyamuk Anopheles", "C. Gigitan lalat", "D. Air minum"], answerIndex: 1 },
  { question: "Manakah yang merupakan gejala yang dapat ditemukan pada malaria?", options: ["A. Gangguan penglihatan saja", "B. Patah tulang", "C. Sakit gigi saja", "D. Demam dan menggigil"], answerIndex: 3 },
  { question: "Salah satu cara membantu mengendalikan malaria adalah...", options: ["A. Membiarkan genangan air", "B. Mengurangi tempat perkembangbiakan nyamuk", "C. Membuka semua tempat penampungan air", "D. Membiarkan pasien tanpa pemeriksaan"], answerIndex: 1 },
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
  private readonly mouse = new THREE.Vector2();
  private readonly pointerLock: PointerLockControls;
  private readonly ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  private readonly directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  private readonly crosshair: HTMLDivElement;
  private readonly lockPrompt: HTMLDivElement;
  private readonly notificationUI: HTMLDivElement;
  private readonly endOverlay: HTMLDivElement;
  private readonly targetNames = ["DRUM1", "DRUM2", "EMBER"] as const;
  private readonly uiHintElement: HTMLDivElement;
  private readonly quizModal: HTMLDivElement;
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
  private bathroomModel: THREE.Object3D | null = null;
  private bathroomMode = false;
  private bathroomFoundCount = 0;
  private currentQuizIndex = 0;
  private correctAnswers = 0;
  private readonly spawnPosition = new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 4);
  private patientModel: THREE.Object3D | null = null;
  private sittingClip: THREE.AnimationClip | null = null;
  private idleClip: THREE.AnimationClip | null = null;
  private walkingClip: THREE.AnimationClip | null = null;
  private activeNpc: NpcAgent | null = null;
  private nextNpcIndex = 0;
  private isActive = false;
  private reachedInteractPoint = false;
  private interactBeacon: THREE.Mesh | null = null;
  private interactBeaconBaseY = 0;
  private guideText: HTMLDivElement | null = null;
  private pulseTargets: THREE.Object3D[] = [];
  private isDisposed = false;
  private assetsRequested = false;
  private isModalOpen = false;
  onLevel3Requested: (() => void) | null = null;

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
    this.uiHintElement = document.createElement("div");
    this.uiHintElement.textContent = "Tekan [E] untuk Memeriksa Pasien";
    Object.assign(this.uiHintElement.style, {
      position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
      zIndex: "20", display: "none", padding: "12px 18px", background: "rgba(0,0,0,0.8)",
      color: "white", font: "700 14px monospace", borderRadius: "6px", pointerEvents: "none",
    });
    document.body.appendChild(this.uiHintElement);

    this.quizModal = document.createElement("div");
    this.quizModal.id = "quiz-overlay";
    this.quizModal.innerHTML = `
      <div id="quiz-modal">
        <div id="quiz-state-question">
          <h2>Informasi Pasien</h2>
          <div class="quiz-patient-info">
            <p><strong>Suhu:</strong> 39°C</p>
            <p><strong>Keluhan:</strong> Demam</p>
            <p><strong>Kondisi:</strong> Menggigil</p>
            <p><strong>Kondisi tubuh:</strong> Lemas</p>
          </div>
          <div class="quiz-actions">
            <button id="btn-choice-a" type="button">A. Periksa lebih lanjut untuk malaria</button>
            <button id="btn-choice-b" type="button">B. Biarkan pasien melanjutkan aktivitas</button>
          </div>
        </div>
        <div id="quiz-state-success" style="display:none">
          <h2 class="quiz-success">✅ Jawaban Tepat!</h2>
          <p>Gejala tersebut mengarah pada malaria. Pasien perlu diperiksa lebih lanjut oleh tenaga kesehatan.</p>
          <button id="btn-lanjut-periksa" type="button" class="quiz-success-button">LANJUT PERIKSA</button>
        </div>
        <div id="quiz-state-fail" style="display:none">
          <h2 class="quiz-fail">❌ Kurang Tepat.</h2>
          <p>Demam dan menggigil pada daerah dengan risiko malaria perlu mendapat perhatian dan pemeriksaan medis segera.</p>
          <button id="btn-ulang-kuis" type="button" class="quiz-fail-button">KERJAKAN ULANG KUIS</button>
        </div>
      </div>
    `;
    Object.assign(this.quizModal.style, { display: "none" });
    this.quizModal.className = "game-popup-overlay";
    const quizCard = this.quizModal.querySelector<HTMLElement>("#quiz-modal");
    if (quizCard) quizCard.className = "game-popup-box";
    this.quizModal.querySelectorAll<HTMLElement>("#quiz-state-question h2, #quiz-state-success h2, #quiz-state-fail h2").forEach((heading) => {
      heading.classList.add("game-popup-title");
      heading.style.marginTop = "0";
    });
    const info = this.quizModal.querySelector<HTMLElement>(".quiz-patient-info");
    if (info) Object.assign(info.style, { background: "rgb(12 35 37)", padding: "15px", textAlign: "left", marginBottom: "20px", border: "1px solid #e8b44f", color: "#d8e2d8" });
    const actions = this.quizModal.querySelector<HTMLElement>(".quiz-actions");
    if (actions) Object.assign(actions.style, { display: "flex", flexDirection: "column", gap: "12px" });
    this.quizModal.querySelectorAll<HTMLButtonElement>("button").forEach((button) => button.classList.add("game-popup-btn"));
    const choiceA = this.quizModal.querySelector<HTMLButtonElement>("#btn-choice-a");
    const choiceB = this.quizModal.querySelector<HTMLButtonElement>("#btn-choice-b");
    document.body.appendChild(this.quizModal);
    this.quizModal.querySelector<HTMLButtonElement>("#btn-choice-a")?.addEventListener("click", this.handleCorrectQuiz);
    this.quizModal.querySelector<HTMLButtonElement>("#btn-choice-b")?.addEventListener("click", this.handleWrongQuiz);
    this.quizModal.querySelector<HTMLButtonElement>("#btn-lanjut-periksa")?.addEventListener("click", this.handleContinueAfterQuiz);
    this.quizModal.querySelector<HTMLButtonElement>("#btn-ulang-kuis")?.addEventListener("click", this.handleRetryQuiz);

    this.notificationUI = document.createElement("div");
    Object.assign(this.notificationUI.style, {
      position: "fixed", top: "70px", left: "50%", transform: "translateX(-50%)", zIndex: "1001",
      display: "none", color: "#fff", font: "700 24px sans-serif", textAlign: "center",
      textShadow: "3px 3px 0 #000, -1px -1px 0 #000", pointerEvents: "none", maxWidth: "90vw",
    });
    document.body.appendChild(this.notificationUI);
    this.endOverlay = this.createEndOverlay();
    document.body.appendChild(this.endOverlay);

    this.guideText = document.createElement("div");
    this.guideText.id = "level2-guide-text";
    this.guideText.textContent = "🩸 Menuju Pos Interaksi...";
    Object.assign(this.guideText.style, {
      position: "fixed", top: "70px", left: "50%", transform: "translateX(-50%)",
      zIndex: "1000", color: "#f4d27c", font: "700 18px monospace",
      textShadow: "0 2px 4px rgba(0,0,0,0.8)", pointerEvents: "none", display: "none",
      animation: "guideBlink 1s steps(2, start) infinite",
    });
    const guideStyle = document.createElement("style");
    guideStyle.textContent = "@keyframes guideBlink { to { visibility: hidden; } }";
    document.head.appendChild(guideStyle);
    document.body.appendChild(this.guideText);

    this.scene.add(this.environment, this.ambientLight, this.directionalLight);
    this.pointerTarget.addEventListener("click", this.handleCanvasClick);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private createEndOverlay(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = "level2-end-overlay";
    overlay.innerHTML = `
      <div class="level2-end-card">
        <div id="panel-obj-found">
          <h2 class="end-success">Kerja Bagus!</h2>
          <p>Bagus! Kamu menemukan semua lokasi yang berpotensi menjadi tempat berkembang biaknya nyamuk.</p>
          <button id="btn-to-quiz" type="button">LANJUT KE KUIS</button>
        </div>
        <div id="panel-quiz" style="display:none" class="quiz-container">
          <h3 id="quiz-title" class="quiz-title">Pertanyaan 1</h3>
          <p id="quiz-question" class="quiz-question"></p>
          <div id="quiz-options" class="quiz-options"></div>
          <div id="quiz-feedback" class="quiz-feedback" style="display:none"></div>
          <button id="btn-next-question" type="button" class="quiz-next-btn" style="display:none">LANJUT</button>
        </div>
        <div id="panel-history" style="display:none">
          <span class="history-label">KAPSUL SEJARAH — INDONESIA, 1950-an</span>
          <h2>Fakta Sejarah</h2>
          <p class="history-text">Pada masa awal kemerdekaan, malaria menjadi wabah mematikan di Indonesia yang bahkan sempat menjangkiti Bung Karno beberapa jam sebelum Proklamasi 17 Agustus 1945. Untuk mengatasinya, pemerintah dan rakyat bersatu melakukan pengendalian terpadu mulai dari penyemprotan massal, penggunaan kelambu, pengobatan kina, hingga pelibatan aktif kader kesehatan. Perjuangan ini memuncak pada 12 November 1959 lewat Gerakan Nasional Pemberantasan Malaria pimpinan Presiden Soekarno, peristiwa bersejarah yang kini diperingati sebagai Hari Kesehatan Nasional.</p>
          <button id="btn-to-summary" type="button">LANJUT</button>
        </div>
        <div id="panel-summary" style="display:none">
          <h1 class="summary-title">🏆 LEVEL 2 SELESAI!</h1>
          <div class="summary-box">
            <p><strong>Pemeriksaan pasien:</strong> <span class="end-success">BERHASIL</span></p>
            <p><strong>Lokasi perkembangbiakan ditemukan:</strong> 3/3</p>
            <p><strong>Kuis:</strong> <span id="summary-quiz">0/3</span></p>
            <p><strong>Skor:</strong> <span id="summary-score">0/60</span></p>
          </div>
          <div class="badge">🏅 BADGE DIBUKA: PEMBASMI MALARIA</div>
          <button id="btn-finish-level" type="button">KEMBALI KE MENU / LANJUT LEVEL 3</button>
        </div>
      </div>
    `;
    Object.assign(overlay.style, { display: "none" });
    overlay.className = "game-popup-overlay";
    const card = overlay.querySelector<HTMLElement>(".level2-end-card");
    if (card) card.className = "game-popup-box level2-end-card";
    overlay.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (!button.classList.contains("quiz-next-btn")) button.classList.add("game-popup-btn");
    });
    const options = overlay.querySelector<HTMLElement>("#quiz-options");
    if (options) Object.assign(options.style, { display: "flex", flexDirection: "column", gap: "10px" });
    const history = overlay.querySelector<HTMLElement>(".history-text");
    if (history) Object.assign(history.style, { fontSize: "14px", lineHeight: "1.6", color: "#d8e2d8", textAlign: "justify" });
    const summary = overlay.querySelector<HTMLElement>(".summary-box");
    if (summary) Object.assign(summary.style, { background: "rgb(12 35 37)", padding: "20px", borderRadius: "8px", textAlign: "left", margin: "20px 0", border: "1px solid #e8b44f", color: "#f4f1de" });
    overlay.querySelector<HTMLButtonElement>("#btn-to-quiz")?.addEventListener("click", this.handleStartQuiz);
    overlay.querySelector<HTMLButtonElement>("#btn-next-question")?.addEventListener("click", this.handleNextQuizQuestion);
    overlay.querySelector<HTMLButtonElement>("#btn-to-summary")?.addEventListener("click", this.handleShowSummary);
    overlay.querySelector<HTMLButtonElement>("#btn-finish-level")?.addEventListener("click", this.handleFinishEndOverlay);
    return overlay;
  }

  activate(): void {
    if (this.isActive) return;
    this.isActive = true;
    if (this.environment.parent !== this.scene) this.scene.add(this.environment);
    if (this.ambientLight.parent !== this.scene) this.scene.add(this.ambientLight);
    if (this.directionalLight.parent !== this.scene) this.scene.add(this.directionalLight);
    this.environment.visible = true;
    this.bathroomMode = false;
    this.notificationUI.style.display = "none";
    if (this.environmentModel) this.environmentModel.visible = true;
    this.npcAgents.forEach((agent) => { agent.root.visible = true; });
    this.pointerLock.enabled = true;
    this.crosshair.hidden = false;
    this.showLockPrompt(false);
    this.uiHintElement.style.display = "none";
    this.ui.showMission();
    this.resetGameplayState();
    missionBanner.show("Dekati pasien yang ke arah meja");
    this.reachedInteractPoint = false;
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
    this.bathroomMode = false;
    this.notificationUI.style.display = "none";
    if (this.environmentModel) this.environmentModel.visible = false;
    this.npcAgents.forEach((agent) => { agent.root.visible = false; });
    this.crosshair.hidden = true;
    this.showLockPrompt(false);
    this.uiHintElement.style.display = "none";
    this.quizModal.style.display = "none";
    this.endOverlay.style.display = "none";
    this.isModalOpen = false;
    this.ui.hide();
    missionBanner.hide();
    if (this.interactBeacon) this.interactBeacon.visible = false;
    if (this.guideText) this.guideText.style.display = "none";
  }

  update(deltaTime: number): void {
    if (!this.isActive) return;
    if (this.bathroomMode) {
      // Pulse efek pada objek sarang nyamuk (DRUM/EMBER)
      const time = performance.now() * 0.004;
      for (let i = 0; i < this.pulseTargets.length; i += 1) {
        const target = this.pulseTargets[i];
        if (!target.visible) continue;
        const base = (target.userData.baseScale as number | undefined) ?? target.scale.x;
        target.userData.baseScale = base;
        target.scale.setScalar(base * (1 + Math.sin(time + i * 2) * 0.06));
      }
      return;
    }
    for (const mixer of this.mixers.values()) mixer.update(deltaTime);
    this.updateCamera(deltaTime);
    this.updateNpcStateMachines(deltaTime);
    this.updateProximityHint();

    // Waypoint ke POS_INTERAKSI
    if (this.interactBeacon && this.interactBeacon.visible) {
      this.interactBeacon.position.y = this.interactBeaconBaseY + Math.sin(performance.now() * 0.004) * 0.25;
      this.interactBeacon.rotation.y += deltaTime * 1.5;
      const interactionPoint = this.waypointPositions.get("POS_INTERAKSI");
      if (interactionPoint) {
        const dist = Math.hypot(
          this.camera.position.x - interactionPoint.x,
          this.camera.position.z - interactionPoint.z,
        );
        if (dist < 2.0) {
          this.reachedInteractPoint = true;
          this.interactBeacon.visible = false;
          if (this.guideText) this.guideText.style.display = "none";
        }
      }
    }
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
    this.uiHintElement.remove();
    this.quizModal.remove();
    this.endOverlay.remove();
    this.notificationUI.remove();
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
      this.createInteractBeacon();
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

  private createInteractBeacon(): void {
    const point = this.waypointPositions.get("POS_INTERAKSI");
    if (!point) return;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 0.9, 4),
      new THREE.MeshBasicMaterial({ color: 0xf4d27c }),
    );
    cone.rotation.x = Math.PI;
    cone.position.set(point.x, point.y + 3.0, point.z);
    cone.name = "InteractBeacon";
    this.interactBeaconBaseY = cone.position.y;
    this.scene.add(cone);
    this.interactBeacon = cone;
    if (this.guideText) this.guideText.style.display = "block";
  }

  private spawnPlayerAtInteractionPoint(): void {
    const interactionPoint = this.waypointPositions.get("POS_INTERAKSI");
    if (!interactionPoint) {
      console.warn("POS_INTERAKSI tidak ditemukan; memakai spawn kamera default.");
      this.camera.position.set(0, 1.6, 4.0);
      this.camera.lookAt(0, 1.0, 0);
      this.spawnPosition.copy(this.pointerLock.object.position);
      return;
    }
    this.pointerLock.object.position.set(interactionPoint.x, interactionPoint.y + PLAYER_EYE_HEIGHT, interactionPoint.z);
    this.spawnPosition.copy(this.pointerLock.object.position);
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
    const agent = this.npcAgents[0];
    if (!agent || agent.state !== "WAITING") return;
    this.playerPosition.copy(this.camera.position);
    if (this.playerPosition.distanceTo(agent.root.position) > 3.0) return;
    this.activeNpc = agent;
    this.openQuizModal();
  }

  private updateProximityHint(): void {
    const npc = this.npcAgents[0];
    if (!npc || this.isModalOpen || !this.pointerLock.isLocked) {
      this.uiHintElement.style.display = "none";
      return;
    }
    this.playerPosition.copy(this.pointerLock.object.position);
    this.uiHintElement.style.display = this.playerPosition.distanceTo(npc.root.position) <= 3.0 ? "block" : "none";
  }

  private openQuizModal(): void {
    if (!this.activeNpc) return;
    if (this.pointerLock.isLocked) this.pointerLock.unlock();
    this.moveState.forward = false;
    this.moveState.backward = false;
    this.moveState.left = false;
    this.moveState.right = false;
    this.uiHintElement.style.display = "none";
    this.isModalOpen = true;
    this.showQuizState("question");
  }

  private readonly handleCorrectQuiz = (): void => {
    if (!this.activeNpc) return;
    this.gameState.addScore(100);
    playBenar();
    this.showQuizState("success");
  };

  private readonly handleWrongQuiz = (): void => {
    playSalah();
    this.showQuizState("fail");
  };

  private readonly handleRetryQuiz = (): void => {
    this.isModalOpen = true;
    this.showQuizState("question");
  };

  private showQuizState(state: "question" | "success" | "fail"): void {
    this.quizModal.style.display = "flex";
    const states = {
      question: this.quizModal.querySelector<HTMLElement>("#quiz-state-question"),
      success: this.quizModal.querySelector<HTMLElement>("#quiz-state-success"),
      fail: this.quizModal.querySelector<HTMLElement>("#quiz-state-fail"),
    };
    Object.entries(states).forEach(([name, element]) => {
      if (element) element.style.display = name === state ? "block" : "none";
    });
  }

  private readonly handleContinueAfterQuiz = (): void => {
    this.quizModal.style.display = "none";
    this.isModalOpen = false;
    this.cleanupHealthPost();
    void this.loadBathroomScene();
    this.activeNpc = null;
  };

  private cleanupHealthPost(): void {
    if (this.environmentModel) {
      this.scene.remove(this.environmentModel);
      this.disposeObject(this.environmentModel);
      this.environmentModel = null;
    }
    for (const agent of this.npcAgents) {
      this.scene.remove(agent.root);
      agent.mixer.stopAllAction();
      agent.mixer.uncacheRoot(agent.root);
    }
    this.npcAgents.length = 0;
    this.mixers.clear();
    this.colliderObjects.length = 0;
  }

  private async loadBathroomScene(): Promise<void> {
    try {
      const bathroom = await loadGLTF(LEVEL2_ASSETS.bathroom);
      if (this.isDisposed) return;
      bathroom.scene.name = "KamarMandiLevel2";
      bathroom.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.bathroomModel = bathroom.scene;
      this.scene.add(bathroom.scene);
      this.bathroomMode = true;
      this.bathroomFoundCount = 0;
      this.notificationUI.style.display = "block";
      this.notificationUI.textContent = "Cari DRUM1, DRUM2, dan EMBER";
      missionBanner.show("🦟 MISI: Cari dan klik tempat-tempat yang berpotensi menjadi sarang nyamuk!");
      if (this.interactBeacon) this.interactBeacon.visible = false;
      if (this.guideText) this.guideText.style.display = "none";
      this.pulseTargets = [];
      bathroom.scene.traverse((child) => {
        const name = child.name.toUpperCase();
        if (this.targetNames.some((t) => name.includes(t))) this.pulseTargets.push(child);
      });
      this.pointerLock.enabled = false;
      if (this.pointerLock.isLocked) this.pointerLock.unlock();
      this.camera.position.set(-45.3, 38.3, 2.1);
      this.camera.rotation.set(1.56, -2.03, 1.54);
      console.log("KAMARMANDI.glb berhasil dimuat ke scene.");
    } catch (error) {
      console.error("Gagal memuat KAMARMANDI.glb:", error);
    }
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

  private readonly handleBathroomClick = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    const hit = intersects[0]?.object;
    if (!hit) return;
    let target: THREE.Object3D | null = hit;
    while (target && target !== this.scene) {
      const name = target.name.toUpperCase();
      if (this.targetNames.some((targetName) => name === targetName || name.includes(targetName))) break;
      target = target.parent;
    }
    if (!target || target === this.scene) return;
    if (!target.visible) return;
    target.visible = false;
    this.bathroomFoundCount += 1;
    if (this.bathroomFoundCount < 3) {
      this.notificationUI.textContent = `Lokasi berisiko ditemukan! ${this.bathroomFoundCount}/3`;
    } else {
      this.notificationUI.style.display = "none";
      this.showEndOverlay();
    }
  };

  private showEndOverlay(): void {
    this.currentQuizIndex = 0;
    this.correctAnswers = 0;
    this.showEndPanel("panel-obj-found");
    this.endOverlay.style.display = "flex";
    missionBanner.hide();
  }

  private readonly handleStartQuiz = (): void => {
    this.currentQuizIndex = 0;
    this.correctAnswers = 0;
    this.loadQuiz(0);
    this.showEndPanel("panel-quiz");
  };

  private loadQuiz(index: number): void {
    const quiz = QUIZ_DATA[index];
    if (!quiz) return;
    const title = this.endOverlay.querySelector<HTMLElement>("#quiz-title");
    const question = this.endOverlay.querySelector<HTMLElement>("#quiz-question");
    const options = this.endOverlay.querySelector<HTMLElement>("#quiz-options");
    const feedback = this.endOverlay.querySelector<HTMLElement>("#quiz-feedback");
    const next = this.endOverlay.querySelector<HTMLButtonElement>("#btn-next-question");
    if (!title || !question || !options || !feedback || !next) return;
    title.textContent = `Pertanyaan ${index + 1}`;
    question.textContent = quiz.question;
    feedback.style.display = "none";
    feedback.className = "quiz-feedback";
    next.style.display = "none";
    options.replaceChildren();
    quiz.options.forEach((label, optionIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option-btn";
      button.textContent = label;
      button.addEventListener("click", () => this.handleQuizAnswer(optionIndex));
      options.appendChild(button);
    });
  }

  private handleQuizAnswer(optionIndex: number): void {
    const quiz = QUIZ_DATA[this.currentQuizIndex];
    if (!quiz) return;
    const feedback = this.endOverlay.querySelector<HTMLElement>("#quiz-feedback");
    const next = this.endOverlay.querySelector<HTMLButtonElement>("#btn-next-question");
    const options = this.endOverlay.querySelector<HTMLElement>("#quiz-options");
    if (!feedback || !next || !options) return;
    const correct = optionIndex === quiz.answerIndex;
    if (correct) {
      this.correctAnswers += 1;
      playBenar();
      feedback.textContent = "✅ Tepat sekali!";
      feedback.className = "quiz-feedback quiz-feedback--correct";
    } else {
      playSalah();
      feedback.textContent = "❌ Jawaban anda salah, silahkan dipelajari lagi";
      feedback.className = "quiz-feedback quiz-feedback--wrong";
    }
    feedback.style.display = "block";
    options.querySelectorAll<HTMLButtonElement>("button").forEach((button, index) => {
      button.disabled = true;
      button.style.opacity = "0.65";
      if (index === quiz.answerIndex) button.classList.add("quiz-btn-correct");
      else if (index === optionIndex) button.classList.add("quiz-btn-wrong");
    });
    next.style.display = "block";
  }

  private readonly handleNextQuizQuestion = (): void => {
    this.currentQuizIndex += 1;
    if (this.currentQuizIndex < QUIZ_DATA.length) this.loadQuiz(this.currentQuizIndex);
    else this.showEndPanel("panel-history");
  };

  private readonly handleShowSummary = (): void => {
    const quizScore = this.endOverlay.querySelector<HTMLElement>("#summary-quiz");
    const score = this.endOverlay.querySelector<HTMLElement>("#summary-score");
    if (quizScore) quizScore.textContent = `${this.correctAnswers}/3`;
    if (score) score.textContent = `${this.correctAnswers * 20}/60`;
    try { localStorage.setItem("quiz_correct_level2", String(this.correctAnswers)); } catch { /* ignore */ }
    this.showEndPanel("panel-summary");
  };

  private readonly handleFinishEndOverlay = (): void => {
    this.endOverlay.style.display = "none";
    this.onLevel3Requested?.();
  };

  private showEndPanel(panelId: string): void {
    ["panel-obj-found", "panel-quiz", "panel-history", "panel-summary"].forEach((id) => {
      const panel = this.endOverlay.querySelector<HTMLElement>(`#${id}`);
      if (panel) panel.style.display = id === panelId ? "block" : "none";
    });
  }

  private readonly handleCanvasClick = (event: MouseEvent): void => {
    if (!this.isActive) return;
    if (this.bathroomMode) {
      this.handleBathroomClick(event);
      return;
    }
    if (!this.pointerLock.isLocked) this.pointerLock.lock();
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
