import * as CANNON from "cannon-es";
import * as THREE from "three";
import type { Patient } from "./Environment";

export class Player {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;
  private readonly keys = new Set<string>();
  private readonly moveSpeed = 20;
  private controlsEnabled = true;
  private activePatient: Patient | null = null;
  private readonly interactionDistance = 2.5;

  constructor(
    private readonly world: CANNON.World,
    private readonly onPatientHealed?: (patient: Patient) => void,
  ) {
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x4d9de0 }),
    );
    this.mesh.castShadow = true;
    this.mesh.position.set(0, 1.1, 5);

    this.body = new CANNON.Body({
      mass: 5,
      shape: new CANNON.Box(new CANNON.Vec3(0.5, 0.9, 0.5)),
      fixedRotation: true,
      linearDamping: 0.9,
    });
    this.body.position.set(0, 1.1, 5);
    this.body.allowSleep = false;
    world.addBody(this.body);

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  updateProximity(patients: Patient[]): void {
    let closestPatient: Patient | null = null;
    let closestDistance = this.interactionDistance;

    for (const patient of patients) {
      if (patient.isHealed) {
        continue;
      }

      const distance = this.position.distanceTo(patient.mesh.position);
      if (distance < closestDistance) {
        closestPatient = patient;
        closestDistance = distance;
      }
    }

    this.activePatient = closestPatient;
  }

  update(): void {
    if (!this.controlsEnabled) {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      return;
    }

    const direction = new CANNON.Vec3(
      Number(this.keys.has("d")) - Number(this.keys.has("a")),
      0,
      Number(this.keys.has("s")) - Number(this.keys.has("w")),
    );

    if (direction.length() > 0) {
      direction.normalize();
      this.body.velocity.x = direction.x * this.moveSpeed;
      this.body.velocity.z = direction.z * this.moveSpeed;
    } else {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    }
  }

  syncMesh(): void {
    this.mesh.position.set(this.body.position.x, this.body.position.y, this.body.position.z);
    this.mesh.quaternion.set(
      this.body.quaternion.x,
      this.body.quaternion.y,
      this.body.quaternion.z,
      this.body.quaternion.w,
    );
  }

  get position(): THREE.Vector3 {
    return this.mesh.position;
  }

  get hasActivePatient(): boolean {
    return this.activePatient !== null;
  }

  getCameraPosition(target: THREE.Vector3): THREE.Vector3 {
    return target.copy(this.position).add(new THREE.Vector3(0, 3, 5));
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.world.removeBody(this.body);
  }

  setControlsEnabled(enabled: boolean): void {
    this.controlsEnabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.controlsEnabled) {
      return;
    }

    if (this.isTypingTarget(event.target)) {
      return;
    }

    const key = event.key.toLowerCase();
    if (key === "e") {
      if (this.activePatient) {
        const patient = this.activePatient;
        patient.isHealed = true;
        patient.mesh.material = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
        this.activePatient = null;
        this.onPatientHealed?.(patient);
      }
      return;
    }

    if (["w", "a", "s", "d"].includes(key)) {
      event.preventDefault();
      this.keys.add(key);
    }
  };

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  }

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.key.toLowerCase());
  };
}
