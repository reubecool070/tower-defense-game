import * as THREE from "three";
import { GROUND_HEIGHT, GROUND_Z_OFFSET, TOWER_RANGE } from "../../utils/constant";

export class TowerManager {
  private towers: THREE.Object3D[] = [];
  private temporaryTower: THREE.Object3D | null = null;
  private isValidPlacement: boolean = true;
  private scene: THREE.Scene;
  private previewMesh: THREE.Mesh | null = null;
  private previewRangeIndicator: THREE.Group | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public getTowers(): THREE.Object3D[] {
    return this.towers;
  }

  public setTowers(towers: THREE.Object3D[]): void {
    this.towers = towers;
  }

  public getTemporaryTower(): THREE.Object3D | null {
    return this.temporaryTower;
  }

  public setTemporaryTower(tower: THREE.Object3D | null): void {
    this.temporaryTower = tower;

    // Clean up previous preview if it exists
    this.clearPreview();

    // Create new preview for this tower if it exists
    if (tower) {
      this.createPreview(tower.position);
    }
  }

  public getIsValidPlacement(): boolean {
    return this.isValidPlacement;
  }

  public setIsValidPlacement(isValid: boolean): void {
    this.isValidPlacement = isValid;
    this.updatePreviewColor();
  }

  public addTower(tower: THREE.Object3D): void {
    this.towers = [...this.towers, tower];

    // Create permanent tower visuals
    const towerMesh = this.createTowerMesh(tower.position, false);
    this.scene.add(towerMesh);
    tower.userData.mesh = towerMesh;

    // Add range indicator
    const rangeIndicator = this.createRangeIndicator(TOWER_RANGE);
    rangeIndicator.position.set(tower.position.x, tower.position.y, GROUND_Z_OFFSET);
    this.scene.add(rangeIndicator);
    tower.userData.rangeIndicator = rangeIndicator;
  }

  private createPreview(position: THREE.Vector3): void {
    // Create preview mesh
    this.previewMesh = this.createTowerMesh(position, true);
    this.scene.add(this.previewMesh);

    // Create preview range indicator
    this.previewRangeIndicator = this.createRangeIndicator(TOWER_RANGE);
    this.previewRangeIndicator.position.set(position.x, position.y, GROUND_Z_OFFSET);
    this.scene.add(this.previewRangeIndicator);
  }

  private updatePreviewColor(): void {
    if (this.previewMesh) {
      const material = this.previewMesh.material as THREE.MeshBasicMaterial;
      material.color.set(this.isValidPlacement ? 0x00ff00 : 0xff0000);
    }
  }

  private clearPreview(): void {
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh);
      this.previewMesh = null;
    }

    if (this.previewRangeIndicator) {
      this.scene.remove(this.previewRangeIndicator);
      this.previewRangeIndicator = null;
    }
  }

  public createRangeIndicator(radius: number): THREE.Group {
    // Use RingGeometry instead of CircleGeometry for a more visible indicator
    const innerRadius = radius - 0.05;
    const outerRadius = radius;
    const segments = 32;

    // Create a flat ring on the XZ plane
    const geometry = new THREE.RingGeometry(innerRadius, outerRadius, segments);
    const material = new THREE.MeshBasicMaterial({
      color: 0x88ff88,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false, // Prevent depth writing to avoid z-fighting
    });

    const ring = new THREE.Mesh(geometry, material);

    // Rotate to lay flat on the XY plane
    ring.rotation.z = -Math.PI / 2;

    // Create a group to hold both the ring and a filled circle
    const group = new THREE.Group();

    // Add a filled circle with lower opacity
    const circleGeometry = new THREE.CircleGeometry(innerRadius, segments);
    const circleMaterial = new THREE.MeshBasicMaterial({
      color: 0x88ff88,
      transparent: true,
      opacity: 0.1,
      depthWrite: false, // Prevent depth writing to avoid z-fighting
    });

    const circle = new THREE.Mesh(circleGeometry, circleMaterial);
    circle.rotation.z = -Math.PI / 2;

    // Add both to the group with different z positions
    ring.position.z = 0.03; // Slightly higher
    circle.position.z = 0.02; // Slightly lower
    group.add(ring);
    group.add(circle);

    // Raise the entire group above ground
    group.position.z = 0.05;

    return group;
  }

  public createTowerMesh(position: THREE.Vector3, isTemporary: boolean = false): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const material = new THREE.MeshBasicMaterial({
      color: isTemporary ? (this.isValidPlacement ? 0x00ff00 : 0xff0000) : 0x00ff00,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, GROUND_HEIGHT);
    mesh.renderOrder = 2;
    return mesh;
  }

  // Update preview position when moving the mouse
  public updatePreviewPosition(position: THREE.Vector3): void {
    if (this.previewMesh) {
      this.previewMesh.position.set(position.x, position.y, GROUND_HEIGHT);
    }

    if (this.previewRangeIndicator) {
      this.previewRangeIndicator.position.set(position.x, position.y, GROUND_Z_OFFSET);
    }
  }

  public cleanupTemporaryTower(): void {
    this.clearPreview();
    this.temporaryTower = null;
  }

  public cleanupAllTowers(): void {
    // Clean up all tower meshes and range indicators
    this.towers.forEach((tower) => {
      if (tower.userData && tower.userData.rangeIndicator) {
        this.scene.remove(tower.userData.rangeIndicator);
      }
      if (tower.userData && tower.userData.mesh) {
        this.scene.remove(tower.userData.mesh);
      }
    });
    this.cleanupTemporaryTower();
    this.towers = [];
  }
}
