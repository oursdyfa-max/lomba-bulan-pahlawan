import CannonDebugger from "cannon-es-debugger";
import * as CANNON from "cannon-es";
import * as THREE from "three";

export class Debugger {
  private readonly cannonDebugger: ReturnType<typeof CannonDebugger>;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    scene.add(new THREE.AxesHelper(3));
    scene.add(new THREE.GridHelper(30, 30, 0x355052, 0x668080));
    this.cannonDebugger = CannonDebugger(scene, world, { color: 0xff3333 });
  }

  update(): void {
    this.cannonDebugger.update();
  }
}