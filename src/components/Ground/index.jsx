import { useEffect, useRef, useState } from "react";
import Tile from "../Tile";
import { astar, getShortestPathInOrder } from "../../algorithms/astar";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../store";

const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;
const START_NODE_ROW = 0;
const START_NODE_COLUMN = 5;
const FINISH_NODE_ROW = 9;
const FINISH_NODE_COLUMN = 0;
const GROUND_Z_OFFSET = 0.01;
const GROUND_HEIGHT = 0.25 + GROUND_Z_OFFSET;

// Tower and particle constants
const TOWER_FIRE_RATE = 0.3; // 2 times per second
const PARTICLE_SPEED = 15.0; // Base speed multiplier
const TOWER_RANGE = 3.0; // How far towers can detect minions

// Minion constants
const MINION_MAX_HEALTH = 100;
const PARTICLE_DAMAGE = 10;
const DEATH_FADE_DURATION = 1.5; // seconds for death animation
const MINION_COUNT = 5; // Number of minions to create
const MINION_SPAWN_DELAY = 2; // Seconds between minion spawns

// Minion class to manage individual minion state
class Minion {
  constructor(id, scene, clock, path) {
    this.id = id;
    this.health = MINION_MAX_HEALTH;
    this.isDying = false;
    this.isActive = true;
    this.deathTime = null;
    this.pathIndex = 0;
    this.scene = scene;
    this.clock = clock;
    this.path = path;

    // Create group for minion and its components
    this.group = new THREE.Group();

    // Create minion mesh
    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshBasicMaterial({
        color: this.getRandomColor(),
        transparent: true,
        opacity: 1.0,
      })
    );

    // Create health bar
    this.healthBar = this.createHealthBar();

    // Add components to group
    this.group.add(this.mesh);
    this.group.add(this.healthBar);

    // Set initial position
    this.reset();

    // Add to scene
    scene.add(this.group);
  }

  getRandomColor() {
    const colors = [0x3498db, 0x9b59b6, 0x2ecc71, 0xe74c3c, 0xf1c40f];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  createHealthBar() {
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

    // Add to group
    group.add(bgBar);
    group.add(valueBar);

    // Position health bar above minion
    group.position.y = 0.4;

    // Store references
    this.healthBarBg = bgBar;
    this.healthBarValue = valueBar;

    return group;
  }

  reset() {
    // Reset position to start
    this.group.position.set(START_NODE_ROW, START_NODE_COLUMN, GROUND_HEIGHT);
    this.pathIndex = 0;
    this.health = MINION_MAX_HEALTH;
    this.isDying = false;
    this.isActive = true;
    this.deathTime = null;

    // Reset appearance
    this.mesh.material.opacity = 1.0;
    this.updateHealthBar();
  }

  takeDamage(amount) {
    if (this.isDying || !this.isActive) return;

    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();

    if (this.health <= 0) {
      this.startDeath();
    }
  }

  startDeath() {
    this.isDying = true;
    this.deathTime = this.clock.getElapsedTime();
  }

  updateHealthBar() {
    const healthPercent = this.health / MINION_MAX_HEALTH;

    // Update health bar scale
    this.healthBarValue.scale.x = healthPercent;

    // Change color based on health level
    if (healthPercent > 0.6) {
      this.healthBarValue.material.color.setHex(0x00ff00); // Green
    } else if (healthPercent > 0.3) {
      this.healthBarValue.material.color.setHex(0xffff00); // Yellow
    } else {
      this.healthBarValue.material.color.setHex(0xff0000); // Red
    }
  }

  update(delta, camera) {
    if (!this.isActive) return;

    // Handle death animation if dying
    if (this.isDying) {
      this.updateDeathAnimation(delta);
      return;
    }

    // Update movement along path
    if (this.path.length > 0 && this.pathIndex < this.path.length) {
      const target = this.path[this.pathIndex];
      const targetPosition = new THREE.Vector3(target.row, target.col, GROUND_HEIGHT);
      const direction = targetPosition.clone().sub(this.group.position).normalize();
      this.group.position.add(direction.multiplyScalar(delta * 2.0));

      // Make health bar face camera
      this.healthBar.quaternion.copy(camera.quaternion);

      // Check if reached waypoint
      if (this.group.position.distanceToSquared(targetPosition) < GROUND_Z_OFFSET) {
        this.pathIndex++;

        // Check if reached end of path
        if (this.pathIndex >= this.path.length) {
          // Minion reached the end - handle end of path logic
          console.log(`Minion ${this.id} reached the end!`);
          this.isActive = false;
          this.scene.remove(this.group);
        }
      }
    }
  }

  updateDeathAnimation(delta) {
    const currentTime = this.clock.getElapsedTime();
    const elapsedDeathTime = currentTime - this.deathTime;

    // Calculate fade based on elapsed time
    if (elapsedDeathTime < DEATH_FADE_DURATION) {
      const fadeRatio = 1 - elapsedDeathTime / DEATH_FADE_DURATION;

      // Update minion mesh opacity
      this.mesh.material.opacity = fadeRatio;

      // Update health bar opacity
      this.healthBarBg.material.opacity = fadeRatio * 0.7;
      this.healthBarValue.material.opacity = fadeRatio * 0.9;

      // Add wobble and sink effect
      this.group.position.y += Math.sin(elapsedDeathTime * 10) * 0.01;
      this.group.position.z -= 0.2 * delta;
      this.group.rotation.z = Math.sin(elapsedDeathTime * 3) * 0.2;
    } else {
      // Death animation complete
      this.isActive = false;
      this.scene.remove(this.group);
    }
  }

  getPosition() {
    return this.group.position;
  }

  isInRange(position, range) {
    if (!this.isActive || this.isDying) return false;
    return this.group.position.distanceTo(position) <= range;
  }
}

const Ground = () => {
  const { camera, gl, scene } = useThree();
  const clickableObjs = useGameStore((s) => s.clickableObjs);
  const removeClickableObj = useGameStore((s) => s.removeClickableObj);

  const [tilesGrid, setTilesGrid] = useState([]);
  //   const [path, setPath] = useState([]);
  const [temporaryTower, setTemporaryTower] = useState(null);
  const [towers, setTowers] = useState([]);
  const [activeParticles, setActiveParticles] = useState([]);
  const [minions, setMinions] = useState([]);

  const pathRef = useRef([]);
  const raycaster = useRef(new THREE.Raycaster());
  const towerTimers = useRef({}); // Track firing cooldowns per tower
  const clock = useRef(new THREE.Clock());
  const spawnTimerRef = useRef(0); // Using a ref instead of state for the spawn timer

  const createTilesGrid = () => {
    const tiles = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      const currentRow = [];
      for (let y = 0; y < DEFAULT_COLS; y++) {
        currentRow.push(createInitialGrid(x, y));
      }
      tiles.push(currentRow);
    }
    return tiles;
  };

  const resetTilesGrid = () => {
    const tiles = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      const currentRow = [];
      for (let y = 0; y < DEFAULT_COLS; y++) {
        const node = tilesGrid[x][y];
        currentRow.push({
          ...node,
          distance: Infinity,
          totalDistance: Infinity,
          isVisited: false,
          previousNode: null,
        });
      }
      tiles.push(currentRow);
    }
    return tiles;
  };

  // Create a new minion
  const spawnMinion = () => {
    if (minions.length >= MINION_COUNT) return;

    const newMinion = new Minion(minions.length, scene, clock.current, pathRef.current);

    setMinions((prev) => [...prev, newMinion]);
  };

  useEffect(() => {
    const tiles = createTilesGrid();
    setTilesGrid(tiles);
    calculateInitialPath(tiles);
    clock.current.start();

    // Initial minion spawn
    spawnMinion();
    spawnTimerRef.current = MINION_SPAWN_DELAY; // Initialize spawn timer

    // Cleanup function to remove any remaining particles when component unmounts
    return () => {
      activeParticles.forEach((particle) => {
        if (particle.mesh && scene) {
          scene.remove(particle.mesh);
        }
      });

      // Cleanup minions
      minions.forEach((minion) => {
        if (minion.group && scene) {
          scene.remove(minion.group);
        }
      });
    };
  }, []);

  const calculateInitialPath = (tiles) => {
    const startNode = tiles[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = tiles[FINISH_NODE_ROW][FINISH_NODE_COLUMN];
    astar(tiles, startNode, finishNode);
    const shortestPathInOrder = getShortestPathInOrder(finishNode);
    pathRef.current = shortestPathInOrder;
    // setPath(shortestPathInOrder);
  };

  const createFireParticle = () => {
    // Create a small, bright sphere for the particle
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      //   emissive: 0xff2000,
      //   emissiveIntensity: 2,
    });
    const mesh = new THREE.Mesh(geometry, material);

    // Add a point light to make it glow
    const light = new THREE.PointLight(0xff4500, 0.5, 1);
    light.position.set(0, 0, 0);
    mesh.add(light);

    return mesh;
  };

  const detectMinionsInRange = (towerPosition, range) => {
    // Return array of minions in range
    return minions.filter(
      (minion) => minion.isActive && !minion.isDying && minion.isInRange(towerPosition, range)
    );
  };

  const fireParticleFromTower = (towerId, towerPosition, targetMinion) => {
    // Check cooldown for this tower
    const currentTime = clock.current.getElapsedTime();
    if (
      towerTimers.current[towerId] &&
      currentTime - towerTimers.current[towerId] < TOWER_FIRE_RATE
    ) {
      return null; // Still on cooldown
    }

    // Update tower's last fire time
    towerTimers.current[towerId] = currentTime;

    // Create particle
    const particle = createFireParticle();
    particle.position.copy(towerPosition);
    particle.position.z += 0.25; // Adjust to fire from tower center

    // Calculate direction toward minion
    const direction = new THREE.Vector3()
      .subVectors(targetMinion.getPosition(), towerPosition)
      .normalize();

    // Create particle data structure
    const particleData = {
      id: `particle_${Date.now()}_${Math.random()}`,
      mesh: particle,
      direction,
      target: targetMinion,
      speed: PARTICLE_SPEED,
      createdAt: currentTime,
    };

    // Add to scene and tracking array
    scene.add(particle);
    setActiveParticles((prev) => [...prev, particleData]);

    return particleData;
  };

  // Update particles and check collisions
  const updateParticles = (delta) => {
    if (activeParticles.length === 0) return;

    const particlesToRemove = [];

    activeParticles.forEach((particle) => {
      // Move particle
      const movement = particle.direction.clone().multiplyScalar(particle.speed * delta);
      particle.mesh.position.add(movement);

      // Check for collision with target minion
      const distanceToTarget = particle.mesh.position.distanceTo(particle.target.getPosition());

      if (distanceToTarget < 0.5) {
        // Collision detected - mark for removal
        particlesToRemove.push(particle.id);
        scene.remove(particle.mesh);

        // Deal damage to minion
        particle.target.takeDamage(PARTICLE_DAMAGE);
      }

      // Remove particles that have been alive too long (5 seconds max)
      const currentTime = clock.current.getElapsedTime();
      if (currentTime - particle.createdAt > 5) {
        particlesToRemove.push(particle.id);
        scene.remove(particle.mesh);
      }
    });

    // Remove processed particles from active list
    if (particlesToRemove.length > 0) {
      setActiveParticles((prev) => prev.filter((p) => !particlesToRemove.includes(p.id)));
    }
  };

  // Create a visual indicator for tower range
  const createRangeIndicator = (radius) => {
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
  };

  useFrame((state, delta) => {
    // Update spawn timer for new minions
    if (minions.length < MINION_COUNT) {
      // Decrement the spawn timer
      spawnTimerRef.current -= delta;

      // Spawn a new minion when timer reaches zero
      if (spawnTimerRef.current <= 0) {
        spawnMinion();
        spawnTimerRef.current = MINION_SPAWN_DELAY; // Reset timer
      }
    }

    // Update all minions
    minions.forEach((minion) => {
      if (minion.isActive) {
        minion.update(delta, camera);
      }
    });

    // Process tower targeting and firing
    towers.forEach((tower, index) => {
      const towerId = `tower_${index}`;
      const towerPosition = new THREE.Vector3(tower.position.x, tower.position.y, GROUND_HEIGHT);

      // Find minions in range
      const minionsInRange = detectMinionsInRange(towerPosition, TOWER_RANGE);

      if (minionsInRange.length > 0) {
        // Fire at first minion in range
        fireParticleFromTower(towerId, towerPosition, minionsInRange[0]);
      }
    });

    // Update particles
    updateParticles(delta);
  });

  const handlePointerMove = (event) => {
    const { clientX, clientY } = event;
    const { left, top, width, height } = gl.domElement.getBoundingClientRect();
    const x = ((clientX - left) / width) * 2 - 1;
    const y = -((clientY - top) / height) * 2 + 1;

    raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera);
    const intersects = raycaster.current.intersectObjects(Array.from(clickableObjs));

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      setTemporaryTower(obj);
    }
  };

  const handlePointerUp = () => {
    if (temporaryTower) {
      const _grids = resetTilesGrid();
      _grids[temporaryTower.position.x][temporaryTower.position.y].isTower = true;

      // Find a minion to get current position for path recalculation
      const activeMinion = minions.find((m) => m.isActive && !m.isDying);
      if (activeMinion) {
        const minionPos = activeMinion.getPosition();
        const currentRow = Math.round(minionPos.x);
        const currentCol = Math.round(minionPos.y);
        const newStartNode = _grids[currentRow][currentCol];
        const finishNode = _grids[FINISH_NODE_ROW][FINISH_NODE_COLUMN];

        astar(_grids, newStartNode, finishNode);
        const shortestPathInOrder = getShortestPathInOrder(finishNode);

        if (shortestPathInOrder.length > 1) {
          removeClickableObj(temporaryTower);
          setTilesGrid(_grids);
          setTowers([...towers, temporaryTower]);
          pathRef.current = shortestPathInOrder;

          // Update all minions' paths
          minions.forEach((minion) => {
            minion.path = shortestPathInOrder;
          });

          setTemporaryTower(null);
        } else {
          console.warn("Placing this tower will block the path. Try another position.");
        }
      } else {
        // No active minions, just add the tower
        removeClickableObj(temporaryTower);
        setTilesGrid(_grids);
        setTowers([...towers, temporaryTower]);
        setTemporaryTower(null);
      }
    }
  };

  useEffect(() => {
    gl.domElement.addEventListener("mousemove", handlePointerMove);
    gl.domElement.addEventListener("mousedown", handlePointerMove);
    gl.domElement.addEventListener("mouseup", handlePointerUp);

    return () => {
      gl.domElement.removeEventListener("mousemove", handlePointerMove);
      gl.domElement.removeEventListener("mousedown", handlePointerMove);
      gl.domElement.removeEventListener("mouseup", handlePointerUp);
    };
  }, [temporaryTower, towers, clickableObjs]);

  return (
    <>
      <group>
        {tilesGrid.flat().map((tile) => (
          <Tile
            key={`${tile.row}-${tile.col}`}
            position={[tile.row, tile.col, 0]}
            startNode={tile.startNode}
            finishNode={tile.finishNode}
            rest={tile}
          />
        ))}

        {towers.map(({ position }, index) => (
          <group key={index}>
            <mesh position={[position.x, position.y, GROUND_HEIGHT]} renderOrder={2}>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshBasicMaterial color="green" />
            </mesh>
            {/* Add range indicator circle */}
            <primitive
              object={createRangeIndicator(TOWER_RANGE)}
              position={[position.x, position.y, GROUND_Z_OFFSET]}
            />
          </group>
        ))}
        {temporaryTower && (
          <group>
            <mesh
              position={[temporaryTower.position.x, temporaryTower.position.y, GROUND_HEIGHT]}
              renderOrder={2}
            >
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshBasicMaterial color="red" />
            </mesh>
            {/* Add range indicator for temporary tower too */}
            <primitive
              object={createRangeIndicator(TOWER_RANGE)}
              position={[temporaryTower.position.x, temporaryTower.position.y, GROUND_Z_OFFSET]}
            />
          </group>
        )}
      </group>
    </>
  );
};

export default Ground;

const createInitialGrid = (x, y) => {
  return {
    startNode: x === START_NODE_ROW && y === START_NODE_COLUMN,
    finishNode: x === FINISH_NODE_ROW && y === FINISH_NODE_COLUMN,
    row: x,
    col: y,
    distance: Infinity,
    totalDistance: Infinity,
    isVisited: false,
    isTower: false,
    previousNode: null,
    name: `node`,
  };
};
