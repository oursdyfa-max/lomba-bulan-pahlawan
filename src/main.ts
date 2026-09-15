import "../style.css";
import * as THREE from "three";
import { Engine } from "./core/Engine";
import { Physics } from "./core/Physics";
import { Environment } from "./entities/Environment";
import { Player } from "./entities/Player";
import { Debugger } from "./systems/Debugger";
import { HUD } from "./ui/HUD";
import { StartScreen } from "./ui/StartScreen";
import { gameState } from "./core/GameState";
import { LevelManager } from "./core/LevelManager";
import { Level1 } from "./levels/Level1";
import { Level1UI } from "./ui/Level1UI";
import { VideoScreen } from "./ui/VideoScreen";

const canvas = document.querySelector<HTMLElement>("#canvas");
const uiLayer = document.querySelector<HTMLElement>("#ui-layer");

if (!canvas || !uiLayer) {
  throw new Error("Required game containers are missing from index.html");
}

const buttonClickSound = new Audio("/assets/Sound/klik.mp3");
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element) || !event.target.closest("button")) {
    return;
  }

  buttonClickSound.currentTime = 0;
  void buttonClickSound.play().catch(() => undefined);
});

const physics = new Physics();
const environment = new Environment(physics.world);
const scene = new THREE.Scene();
const debuggerSystem = new Debugger(scene, physics.world);
const hud = new HUD(uiLayer);
let levelCompleteShown = false;
const player = new Player(physics.world, () => {
  gameState.addScore(10);
  hud.setScore(gameState.score);
  hud.setInteractionHint(false);

  if (!levelCompleteShown && environment.obstacles.every((patient) => patient.isHealed)) {
    levelCompleteShown = true;
    hud.showLevelComplete();
  }
});
const engine = new Engine(canvas, scene, physics, player, environment, debuggerSystem, hud);
engine.add(environment.group);
environment.group.visible = gameState.currentLevel !== "LEVEL_1";
const levelManager = new LevelManager(gameState);
const level1UI = new Level1UI(uiLayer, gameState, levelManager);
const videoScreen = new VideoScreen(uiLayer);
const level1 = new Level1(scene, engine.getCamera(), engine.getRenderElement(), player, gameState, level1UI);
engine.setLevel1(level1);
hud.setPlayerName(gameState.playerName || "Dokter Djawa");
hud.setScore(gameState.score);
hud.setEra("Hindia Belanda");

let level1Started = false;
const startLevel1 = (): void => {
  if (level1Started) {
    return;
  }

  level1Started = true;
  gameState.currentLevel = "LEVEL_1";
  gameState.saveState();
  environment.group.visible = false;
  hud.setPlayerName(gameState.playerName);
  engine.enterLevel1();
  engine.setCinematicMode(false);
};

if (gameState.currentLevel === "START") {
  new StartScreen(uiLayer, gameState, () => {
    engine.setCinematicMode(true);
    gameState.currentLevel = "LEVEL_1";
    gameState.saveState();
    environment.group.visible = false;
    hud.setPlayerName(gameState.playerName);
    videoScreen.play(startLevel1);
  });
}
engine.start();
