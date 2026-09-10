import * as CANNON from "cannon-es";

export const FIXED_TIME_STEP = 1 / 60;

export class Physics {
  readonly world: CANNON.World;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    const defaultMaterial = new CANNON.Material("default");
    const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
      friction: 0.4,
      restitution: 0.05,
    });
    this.world.defaultContactMaterial = contactMaterial;
    this.world.addContactMaterial(contactMaterial);
  }

  update(deltaTime: number): void {
    this.world.step(FIXED_TIME_STEP, Math.min(deltaTime, 0.1), 3);
  }
}
