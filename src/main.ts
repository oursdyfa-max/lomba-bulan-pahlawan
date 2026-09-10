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

const canvas = document.querySelector<HTMLElement>("#canvas");
const uiLayer = document.querySelector<HTMLElement>("#ui-layer");

if (!canvas || !uiLayer) {
  throw new Error("Required game containers are missing from index.html");
}

gameState.resetState();

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
hud.setPlayerName(gameState.playerName || "Dokter Djawa");
hud.setScore(gameState.score);
hud.setEra("Hindia Belanda");
if (gameState.currentLevel === "START") {
  new StartScreen(uiLayer, gameState, () => {
    gameState.currentLevel = "LEVEL_1";
    gameState.saveState();
    hud.setPlayerName(gameState.playerName);
  });
}
engine.start();
