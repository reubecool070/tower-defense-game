import * as THREE from "three";

export interface TileNode {
  startNode: boolean;
  finishNode: boolean;
  row: number;
  col: number;
  distance: number;
  totalDistance: number;
  isVisited: boolean;
  isTower: boolean;
  previousNode: TileNode | null;
  name: string;
}

export interface TileProps {
  position: [number, number, number];
  startNode: boolean;
  finishNode: boolean;
  rest: TileNode;
}

export interface MinionOptions {
  id: number;
  scene: THREE.Scene;
  clock: THREE.Clock;
  path: TileNode[];
}

export interface MinionType {
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
  update: (delta: number, camera: THREE.Camera) => void;
  getPosition: () => THREE.Vector3;
  isInRange: (position: THREE.Vector3, range: number) => boolean;
  takeDamage: (amount: number) => void;
}

export interface ParticleData {
  id: string;
  mesh: THREE.Mesh;
  direction: THREE.Vector3;
  target: THREE.Object3D;
  speed: number;
  createdAt: number;
}

export interface GameStore {
  clickableObjs: Set<THREE.Object3D>;
  addClickableObjs: (obj: THREE.Object3D) => void;
  removeAllObjects: () => void;
  removeClickableObj: (obj: THREE.Object3D) => void;
}
