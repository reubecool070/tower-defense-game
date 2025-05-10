import * as THREE from "three";
import {
  START_NODE_ROW,
  START_NODE_COLUMN,
  GROUND_HEIGHT,
  MINION_MAX_HEALTH,
  GROUND_Z_OFFSET,
  DEATH_FADE_DURATION,
} from "../../utils/constant";
import { Minion, TileNode } from "../../types";

export class MinionManager {
  private minions: Minion[] = [];
  private scene: THREE.Scene;
  private clock: THREE.Clock;
  private path: TileNode[] = [];
  private increaseScore: () => void;
  private decreaseLives: () => void;
  private increaseTotalMinions: () => void;

  constructor(
    scene: THREE.Scene,
    clock: THREE.Clock,
    increaseScore: () => void,
    decreaseLives: () => void,
    increaseTotalMinions: () => void
  ) {
    this.scene = scene;
    this.clock = clock;
    this.increaseScore = increaseScore;
    this.decreaseLives = decreaseLives;
    this.increaseTotalMinions = increaseTotalMinions;
  }

  public getMinions(): Minion[] {
    return this.minions;
  }

  public setMinions(minions: Minion[]): void {
    this.minions = minions;
  }

  public setPath(path: TileNode[]): void {
    this.path = path;
  }

  private createHealthBar(): { group: THREE.Group; valueBar: THREE.Mesh } {
    // Create container group
    const group = new THREE.Group();

    // Background bar (gray)
    const bgGeometry = new THREE.PlaneGeometry(0.6, 0.1);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const bgBar = new THREE.Mesh(bgGeometry, bgMaterial);

    // Health value bar (green)
    const valueGeometry = new THREE.PlaneGeometry(0.6, 0.1);
    const valueMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const valueBar = new THREE.Mesh(valueGeometry, valueMaterial);
    valueBar.position.z = 0.01; // Slightly in front of background

    // Set initial scale of health bar to 100%
    valueBar.scale.x = 1.0;

    // Position bar's origin on left side instead of center
    valueBar.position.x = 0;

    // Add to group
    group.add(bgBar);
    group.add(valueBar);

    // Position health bar above minion
    group.position.y = 0.4;

    return { group, valueBar };
  }

  public updateHealthBar(valueBar: THREE.Mesh, currentHealth: number): void {
    if (valueBar) {
      // Calculate health percentage
      const healthPercent = currentHealth / MINION_MAX_HEALTH;

      // Update scale and position of health bar
      valueBar.scale.x = healthPercent;
      valueBar.position.x = -0.3 * (1 - healthPercent);

      // Change color based on health level
      if (healthPercent > 0.6) {
        (valueBar.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00); // Green
      } else if (healthPercent > 0.3) {
        (valueBar.material as THREE.MeshBasicMaterial).color.setHex(0xffff00); // Yellow
      } else {
        (valueBar.material as THREE.MeshBasicMaterial).color.setHex(0xff0000); // Red
      }
    }
  }

  public spawnMinion(gameStats: any): Minion | null {
    if (this.path.length === 0) return null;

    // Create a new minion group
    const minionGroup = new THREE.Group();
    minionGroup.position.set(START_NODE_ROW, START_NODE_COLUMN, GROUND_HEIGHT);

    // Create minion mesh
    const minionMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshBasicMaterial({
        color: 0x3366ff, // Blue
        transparent: true,
        opacity: 1.0,
      })
    );

    // Add minion mesh to group
    minionGroup.add(minionMesh);

    // Create and add health bar to group
    const { group: healthBar, valueBar: healthBarValue } = this.createHealthBar();
    minionGroup.add(healthBar);

    // Generate unique ID for this minion
    const minionId = `minion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create minion data structure
    const newMinion: Minion = {
      id: minionId,
      group: minionGroup,
      mesh: minionMesh,
      healthBar,
      healthBarValue,
      pathIndex: 0,
      health: MINION_MAX_HEALTH,
      isDying: false,
      deathStartTime: null,
    };

    // Track total minions in game store
    this.increaseTotalMinions();

    // Add to state
    this.minions = [...this.minions, newMinion];

    // Add to scene
    this.scene.add(minionGroup);

    console.log(
      `Spawned minion ${minionId} (${gameStats.minionsSpawned + 1}/${gameStats.totalMinions})`
    );

    return newMinion;
  }

  public handleMinionDeath(minionId: string): void {
    this.minions = this.minions.map((minion) =>
      minion.id === minionId && !minion.isDying
        ? {
            ...minion,
            isDying: true,
            deathStartTime: this.clock.getElapsedTime(),
          }
        : minion
    );

    // Increase score using the game store
    this.increaseScore();

    console.log(`Minion ${minionId} defeated! +1 Score`);
  }

  public updateMinionDeathAnimations(delta: number): void {
    let minionRemovalIds: string[] = [];

    this.minions = this.minions.map((minion) => {
      if (minion.isDying && minion.deathStartTime) {
        const currentTime = this.clock.getElapsedTime();
        const elapsedDeathTime = currentTime - minion.deathStartTime;

        if (elapsedDeathTime < DEATH_FADE_DURATION) {
          // Update death animation
          const fadeRatio = 1 - elapsedDeathTime / DEATH_FADE_DURATION;

          // Update minion mesh opacity
          if (minion.mesh.material) {
            (minion.mesh.material as THREE.MeshBasicMaterial).opacity = fadeRatio;
          }

          // Update health bar opacity
          minion.healthBar.children.forEach((child) => {
            if ((child as THREE.Mesh).material) {
              ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = fadeRatio * 0.7;
            }
          });

          // Add wobble or sink effect
          minion.group.position.y += Math.sin(elapsedDeathTime * 10) * 0.01;
          minion.group.position.z -= 0.2 * delta;
          minion.group.rotation.z = Math.sin(elapsedDeathTime * 3) * 0.2;

          return minion;
        } else {
          // Death animation complete, mark for removal
          minionRemovalIds.push(minion.id);
          this.scene.remove(minion.group);
          return minion;
        }
      }
      return minion;
    });

    // Remove dead minions
    if (minionRemovalIds.length > 0) {
      this.minions = this.minions.filter((minion) => !minionRemovalIds.includes(minion.id));
    }
  }

  public updateMinionsMovement(delta: number, camera: THREE.Camera): void {
    if (this.path.length === 0) return;

    this.minions.forEach((minion) => {
      if (!minion.isDying && this.path.length > 0 && minion.pathIndex < this.path.length) {
        const minionGroup = minion.group;
        const speed = 2.0;
        const target = this.path[minion.pathIndex];
        const targetPosition = new THREE.Vector3(target.row, target.col, GROUND_HEIGHT);

        // Calculate distance to target
        const distanceToTarget = minionGroup.position.distanceTo(targetPosition);

        // Only move if we're not already very close to the target
        if (distanceToTarget > GROUND_Z_OFFSET) {
          // Only move in cardinal directions (no diagonals)
          // First determine if we should move along x or y axis
          const dx = Math.abs(targetPosition.x - minionGroup.position.x);
          const dy = Math.abs(targetPosition.y - minionGroup.position.y);

          // Move along the axis with larger distance first
          const direction = new THREE.Vector3(0, 0, 0);

          if (dx > dy) {
            // Move horizontally first
            if (targetPosition.x > minionGroup.position.x) {
              direction.x = 1;
            } else if (targetPosition.x < minionGroup.position.x) {
              direction.x = -1;
            }
          } else {
            // Move vertically first
            if (targetPosition.y > minionGroup.position.y) {
              direction.y = 1;
            } else if (targetPosition.y < minionGroup.position.y) {
              direction.y = -1;
            }
          }

          // Apply movement
          minionGroup.position.add(direction.normalize().multiplyScalar(delta * speed));

          // Ensure we don't overshoot the target
          if (
            (direction.x > 0 && minionGroup.position.x > targetPosition.x) ||
            (direction.x < 0 && minionGroup.position.x < targetPosition.x)
          ) {
            minionGroup.position.x = targetPosition.x;
          }

          if (
            (direction.y > 0 && minionGroup.position.y > targetPosition.y) ||
            (direction.y < 0 && minionGroup.position.y < targetPosition.y)
          ) {
            minionGroup.position.y = targetPosition.y;
          }
        }

        // Update health bar to face the camera
        minion.healthBar.quaternion.copy(camera.quaternion);

        // Check if we've reached the current target node
        if (minionGroup.position.distanceTo(targetPosition) < GROUND_Z_OFFSET) {
          // Find minion by ID and update its path index
          const minionIndex = this.minions.findIndex((m) => m.id === minion.id);

          if (minionIndex !== -1) {
            const newPathIndex = this.minions[minionIndex].pathIndex + 1;

            // If reached end of path
            if (newPathIndex >= this.path.length) {
              console.log(`Minion ${minion.id} reached the destination! -1 Life`);

              // Reduce player lives
              this.decreaseLives();

              // Remove from scene
              this.scene.remove(this.minions[minionIndex].group);

              // Update pathIndex (will be filtered out later)
              this.minions[minionIndex] = {
                ...this.minions[minionIndex],
                pathIndex: newPathIndex,
              };
            } else {
              // Just update the path index
              this.minions[minionIndex] = {
                ...this.minions[minionIndex],
                pathIndex: newPathIndex,
              };
            }
          }
        }
      }
    });

    // Clean up minions that have reached the destination
    this.minions = this.minions.filter((minion) => minion.pathIndex < this.path.length);
  }

  public redirectMinionsToNewPath(newPath: TileNode[]): void {
    this.path = newPath;

    this.minions = this.minions.map((minion) => {
      if (minion.isDying) return minion;

      // Find the closest point on the new path for this minion
      const currentPosition = minion.group.position;
      let closestPathIndex = 0;
      let minDistance = Infinity;

      newPath.forEach((node, index) => {
        const distance = Math.sqrt(
          Math.pow(node.row - currentPosition.x, 2) + Math.pow(node.col - currentPosition.y, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          closestPathIndex = index;
        }
      });

      return {
        ...minion,
        // Set to the closest path point or keep current index if it's valid
        pathIndex: Math.min(closestPathIndex, newPath.length - 1),
      };
    });
  }

  public isMinionOnTile(tileX: number, tileY: number): boolean {
    return this.minions.some((minion) => {
      const minionPos = minion.group.position;
      return Math.abs(minionPos.x - tileX) < 0.5 && Math.abs(minionPos.y - tileY) < 0.5;
    });
  }

  public cleanupMinions(): void {
    this.minions.forEach((minion) => {
      if (minion.group && this.scene) {
        this.scene.remove(minion.group);
      }
    });
    this.minions = [];
  }
}
