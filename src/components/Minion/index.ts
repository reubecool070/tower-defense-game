import * as THREE from "three";
import { MINION_MAX_HEALTH } from "../../utils/constant";
import { TileNode } from "../../types";

export default class Minion {
  id: number;
  group: THREE.Group;
  path: TileNode[];
  currentPathIndex: number;
  speed: number;
  health: number;
  maxHealth: number;
  healthBar: THREE.Mesh;
  healthBarBackground: THREE.Mesh;
  body: THREE.Mesh;
  isActive: boolean;
  isDying: boolean;
  deathStartTime: number;
  clock: THREE.Clock;
  deathAnimationDuration: number = 0.5;

  constructor(id: number, scene: THREE.Scene, clock: THREE.Clock, path: TileNode[]) {
    this.id = id;
    this.path = path;
    this.clock = clock;
    this.group = new THREE.Group();
    this.currentPathIndex = 0;
    this.speed = 1.0;
    this.health = MINION_MAX_HEALTH;
    this.maxHealth = MINION_MAX_HEALTH;
    this.isActive = true;
    this.isDying = false;
    this.deathStartTime = 0;

    // Create minion body (a simple colored cube)
    const geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const material = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    this.body = new THREE.Mesh(geometry, material);
    this.group.add(this.body);

    // Create health bar background (red)
    const healthBgGeometry = new THREE.PlaneGeometry(0.5, 0.08);
    const healthBgMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.healthBarBackground = new THREE.Mesh(healthBgGeometry, healthBgMaterial);
    this.healthBarBackground.position.z = 0.3;
    this.healthBarBackground.position.y = 0.3;
    this.group.add(this.healthBarBackground);

    // Create health bar (green)
    const healthGeometry = new THREE.PlaneGeometry(0.5, 0.08);
    const healthMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.healthBar = new THREE.Mesh(healthGeometry, healthMaterial);
    this.healthBar.position.z = 0.31; // Slightly in front of the background
    this.healthBar.position.y = 0.3;
    this.group.add(this.healthBar);

    // If path has elements, set initial position
    if (path.length > 0) {
      const startNode = path[0];
      this.group.position.set(startNode.row, startNode.col, 0.25);
    }

    scene.add(this.group);
  }

  update(delta: number, camera: THREE.Camera): void {
    if (!this.isActive) return;

    if (this.isDying) {
      this.updateDeathAnimation();
      return;
    }

    this.moveAlongPath(delta);
    this.updateHealthBar(camera);
  }

  moveAlongPath(delta: number): void {
    if (this.currentPathIndex >= this.path.length - 1) {
      // Reached the end of the path
      this.isActive = false;
      return;
    }

    const currentTarget = this.path[this.currentPathIndex + 1];
    const targetPos = new THREE.Vector3(currentTarget.row, currentTarget.col, 0.25);
    const currentPos = this.group.position.clone();

    // Calculate direction and distance to next node
    const direction = targetPos.clone().sub(currentPos).normalize();
    const distance = currentPos.distanceTo(targetPos);

    // Calculate movement for this frame
    const moveAmount = this.speed * delta;

    if (moveAmount >= distance) {
      // We've reached or overshot the target node
      this.group.position.copy(targetPos);
      this.currentPathIndex++;
    } else {
      // Move toward the target
      const movement = direction.multiplyScalar(moveAmount);
      this.group.position.add(movement);
    }
  }

  updateHealthBar(camera: THREE.Camera): void {
    // Calculate health percentage
    const healthPercent = this.health / this.maxHealth;

    // Update scale and position of health bar
    this.healthBar.scale.x = healthPercent;
    this.healthBar.position.x = -0.3 * (1 - healthPercent);

    // Change color based on health level
    const healthBarMaterial = this.healthBar.material as THREE.MeshBasicMaterial;
    if (healthPercent > 0.6) {
      healthBarMaterial.color.setHex(0x00ff00); // Green
    } else if (healthPercent > 0.3) {
      healthBarMaterial.color.setHex(0xffff00); // Yellow
    } else {
      healthBarMaterial.color.setHex(0xff0000); // Red
    }

    // Check if health is zero and not already dying
    if (this.health <= 0 && !this.isDying) {
      this.startDying();
    }
  }

  updateDeathAnimation(): void {
    const currentTime = this.clock.getElapsedTime();
    const elapsedDeathTime = currentTime - this.deathStartTime;
    const duration = this.deathAnimationDuration;

    if (elapsedDeathTime >= duration) {
      // Death animation complete, deactivate minion and remove from scene immediately
      this.isActive = false;
      if (this.group.parent) {
        this.group.parent.remove(this.group);
      }
      return;
    }

    // Fade out the minion (faster with custom duration)
    const opacity = 1 - elapsedDeathTime / duration;

    // Assuming body material is MeshBasicMaterial
    const bodyMaterial = this.body.material as THREE.MeshBasicMaterial;
    bodyMaterial.opacity = opacity;

    const healthBarMaterial = this.healthBar.material as THREE.MeshBasicMaterial;
    const healthBgMaterial = this.healthBarBackground.material as THREE.MeshBasicMaterial;

    healthBarMaterial.opacity = opacity;
    healthBgMaterial.opacity = opacity;

    // Sink into the ground faster
    this.group.position.z = 0.25 - (elapsedDeathTime / duration) * 0.25;
  }

  takeDamage(amount: number): void {
    if (!this.isActive || this.isDying) return;

    this.health -= amount;

    if (this.health <= 0) {
      this.health = 0;
      this.startDying();
    }
  }

  startDying(): void {
    this.isDying = true;
    this.deathStartTime = this.clock.getElapsedTime();

    // Make all materials transparent
    const bodyMaterial = this.body.material as THREE.MeshBasicMaterial;
    bodyMaterial.transparent = true;

    const healthBarMaterial = this.healthBar.material as THREE.MeshBasicMaterial;
    const healthBgMaterial = this.healthBarBackground.material as THREE.MeshBasicMaterial;

    healthBarMaterial.transparent = true;
    healthBgMaterial.transparent = true;
  }

  getPosition(): THREE.Vector3 {
    return this.group.position.clone();
  }

  isInRange(position: THREE.Vector3, range: number): boolean {
    return this.group.position.distanceTo(position) <= range;
  }
}
