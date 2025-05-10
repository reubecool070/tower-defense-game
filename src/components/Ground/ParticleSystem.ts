import * as THREE from "three";
import { ParticleData, Minion } from "../../types";
import { PARTICLE_DAMAGE, PARTICLE_SPEED } from "../../utils/constant";

export class ParticleSystem {
  private activeParticles: ParticleData[] = [];
  private scene: THREE.Scene;
  private clock: THREE.Clock;

  constructor(scene: THREE.Scene, clock: THREE.Clock) {
    this.scene = scene;
    this.clock = clock;
  }

  public getActiveParticles(): ParticleData[] {
    return this.activeParticles;
  }

  public setActiveParticles(particles: ParticleData[]): void {
    this.activeParticles = particles;
  }

  private createFireParticle(): THREE.Mesh {
    // Create a small, bright sphere for the particle
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4500,
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Add a point light to make it glow
    const light = new THREE.PointLight(0xff4500, 0.5, 1);
    light.position.set(0, 0, 0);
    mesh.add(light);

    return mesh;
  }

  public fireParticleFromTower(
    towerId: string,
    towerPosition: THREE.Vector3,
    targetMinion: THREE.Object3D,
    towerTimers: Record<string, number>
  ): ParticleData | null {
    // Check cooldown for this tower
    const currentTime = this.clock.getElapsedTime();
    const TOWER_FIRE_RATE = 0.3; // Should be imported from constants

    if (towerTimers[towerId] && currentTime - towerTimers[towerId] < TOWER_FIRE_RATE) {
      return null; // Still on cooldown
    }

    // Update tower's last fire time
    towerTimers[towerId] = currentTime;

    // Create particle
    const particle = this.createFireParticle();
    particle.position.copy(towerPosition);
    particle.position.z += 0.25; // Adjust to fire from tower center

    // Calculate direction toward minion
    const direction = new THREE.Vector3()
      .subVectors(targetMinion.position, towerPosition)
      .normalize();

    // Create particle data structure with target as Object3D instead of MinionType
    const particleData: ParticleData = {
      id: `particle_${Date.now()}_${Math.random()}`,
      mesh: particle,
      direction,
      target: targetMinion,
      speed: PARTICLE_SPEED,
      createdAt: currentTime,
    };

    // Add to scene and tracking array
    this.scene.add(particle);
    this.activeParticles = [...this.activeParticles, particleData];

    return particleData;
  }

  public updateParticles(
    delta: number,
    minions: Minion[],
    handleMinionDeath: (minionId: string) => void,
    updateHealthBar: (healthBarValue: THREE.Mesh, health: number) => void
  ): void {
    if (this.activeParticles.length === 0) return;

    const particlesToRemove: string[] = [];
    const minionsHit: { id: string; damage: number }[] = [];

    this.activeParticles.forEach((particle) => {
      // Move particle
      const movement = particle.direction.clone().multiplyScalar(particle.speed * delta);
      particle.mesh.position.add(movement);

      // Check for collision with target
      if (particle.target && particle.target.position) {
        const distanceToTarget = particle.mesh.position.distanceTo(particle.target.position);

        if (distanceToTarget < 0.5) {
          // Collision detected - mark for removal
          particlesToRemove.push(particle.id);
          this.scene.remove(particle.mesh);

          // Find which minion was hit
          const hitMinionId = minions.find((m) => m.group === particle.target)?.id;

          if (hitMinionId) {
            minionsHit.push({ id: hitMinionId, damage: PARTICLE_DAMAGE });
          }
        }
      }

      // Remove particles that have been alive too long (5 seconds max)
      const currentTime = this.clock.getElapsedTime();
      if (currentTime - particle.createdAt > 5) {
        particlesToRemove.push(particle.id);
        this.scene.remove(particle.mesh);
      }
    });

    // Apply damage to hit minions
    minions.forEach((minion) => {
      const hitInfo = minionsHit.find((hit) => hit.id === minion.id);
      if (hitInfo && !minion.isDying) {
        const newHealth = Math.max(0, minion.health - hitInfo.damage);
        updateHealthBar(minion.healthBarValue, newHealth);

        // Update minion health
        minion.health = newHealth;

        // Check for death
        if (newHealth <= 0 && !minion.isDying) {
          handleMinionDeath(minion.id);
        }
      }
    });

    // Remove processed particles from active list
    if (particlesToRemove.length > 0) {
      this.activeParticles = this.activeParticles.filter((p) => !particlesToRemove.includes(p.id));
    }
  }

  public detectMinionsInRange(
    towerPosition: THREE.Vector3,
    minions: Minion[],
    range: number
  ): THREE.Object3D[] {
    // Get all non-dying minions with health > 0
    const validMinions = minions.filter((m) => !m.isDying && m.health > 0).map((m) => m.group);

    return validMinions.filter((minionGroup) => {
      const distance = new THREE.Vector3(
        towerPosition.x,
        towerPosition.y,
        towerPosition.z
      ).distanceTo(minionGroup.position);
      return distance <= range;
    });
  }

  public cleanupParticles(): void {
    this.activeParticles.forEach((particle) => {
      if (particle.mesh && this.scene) {
        this.scene.remove(particle.mesh);
      }
    });
    this.activeParticles = [];
  }
}
