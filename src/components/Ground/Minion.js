// Minion.js
import * as THREE from "three";

export class Minion {
  constructor(mesh) {
    this.mesh = mesh;
    this.pathIndex = 0;
    this.speed = 2.0; // Adjust speed as needed
  }

  moveTo(targetPosition, deltaTime) {
    const direction = targetPosition.clone().sub(this.mesh.position).normalize();
    this.mesh.position.add(direction.multiplyScalar(deltaTime * this.speed));
  }
}

export class MinionManager {
  constructor(scene, path) {
    this.minions = [];
    this.scene = scene;
    this.path = path;
    this.group = new THREE.Group();
    this.textureLoader = new THREE.TextureLoader();
    this.minionSprite = undefined;

    this.scene.add(this.group);
  }

  createTexture() {
    this.textureLoader.load("textures/minion.png", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.SpriteMaterial({ map: texture });
      this.minionSprite = new THREE.Sprite(material);
    });
  }

  spawnMinion(position) {
    if (!this.minionSprite) return;
    const mesh = this.minionSprite.clone();
    mesh.name = `minion-${this.minions.length + 1}`;
    mesh.position.copy(position);
    const minion = new Minion(mesh);
    this.minions.push(minion);
    this.group.add(mesh);
  }

  updateMinions(deltaTime) {
    this.minions.forEach((minion) => {
      if (minion.pathIndex < this.path.length) {
        const targetPosition = new THREE.Vector3(
          this.path[minion.pathIndex].row,
          this.path[minion.pathIndex].col,
          0.25
        );
        minion.moveTo(targetPosition, deltaTime);
        if (minion.mesh.position.distanceToSquared(targetPosition) < 0.01) {
          minion.pathIndex++;
        }
      } else {
        this.group.remove(minion.mesh);
        this.minions.splice(this.minions.indexOf(minion), 1);
      }
    });
  }

  getClosestMinion(position, range) {
    let closestMinion = null;
    let closestDistance = range * range;
    this.minions.forEach((minion) => {
      const distance = position.distanceToSquared(minion.mesh.position);
      if (distance < closestDistance) {
        closestMinion = minion;
        closestDistance = distance;
      }
    });
    return closestMinion;
  }

  checkCollision(particle, onCollision) {
    this.minions.forEach((minion) => {
      if (particle.position.distanceToSquared(minion.mesh.position) < 0.5) {
        onCollision();
        this.group.remove(minion.mesh);
        this.minions.splice(this.minions.indexOf(minion), 1);
      }
    });
  }
}
