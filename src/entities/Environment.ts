import * as CANNON from "cannon-es";
import * as THREE from "three";

export interface PhysicsObject {
  mesh: THREE.Mesh;
  body: CANNON.Body;
}

export interface Patient extends PhysicsObject {
  isHealed: boolean;
}

export class Environment {
  readonly group = new THREE.Group();
  readonly obstacles: Patient[] = [];
  private readonly physicsObjects: PhysicsObject[] = [];

  constructor(private readonly world: CANNON.World) {
    this.group.name = "Environment";
    this.addGround();
    this.addObstacles();
  }

  private addGround(): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.2, 20),
      new THREE.MeshStandardMaterial({ color: 0x808080 }),
    );
    mesh.position.y = -0.1;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(10, 0.1, 10)) });
    body.position.set(0, -0.1, 0);
    this.world.addBody(body);
    this.physicsObjects.push({ mesh, body });
  }

  private addObstacles(): void {
    const obstacleSpecs = [
      { position: [-3, 0.75, -1] as const, size: [1.5, 1.5, 1.5] as const },
      { position: [2, 0.6, -3] as const, size: [1.2, 1.2, 1.2] as const },
      { position: [4, 1, 2] as const, size: [2, 2, 2] as const },
    ];

    for (const spec of obstacleSpecs) {
      const [width, height, depth] = spec.size;
      const [x, y, z] = spec.position;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, depth),
        new THREE.MeshStandardMaterial({ color: 0xd94b4b }),
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);

      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
      });
      body.position.set(x, y, z);
      this.world.addBody(body);
      const physicsObject: Patient = { mesh, body, isHealed: false };
      this.obstacles.push(physicsObject);
      this.physicsObjects.push(physicsObject);
    }
  }

  syncMeshes(): void {
    for (const physicsObject of this.physicsObjects) {
      physicsObject.mesh.position.set(
        physicsObject.body.position.x,
        physicsObject.body.position.y,
        physicsObject.body.position.z,
      );
      physicsObject.mesh.quaternion.set(
        physicsObject.body.quaternion.x,
        physicsObject.body.quaternion.y,
        physicsObject.body.quaternion.z,
        physicsObject.body.quaternion.w,
      );
    }
  }
}
