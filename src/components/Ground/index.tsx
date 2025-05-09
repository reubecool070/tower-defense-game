import { useEffect, useRef, useState, MutableRefObject } from "react";
import Tile from "../Tile";
import { astar, getShortestPathInOrder } from "../../algorithms/astar";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../store";
import {
  DEFAULT_ROWS,
  DEFAULT_COLS,
  START_NODE_ROW,
  START_NODE_COLUMN,
  FINISH_NODE_ROW,
  FINISH_NODE_COLUMN,
  GROUND_Z_OFFSET,
  GROUND_HEIGHT,
  TOWER_FIRE_RATE,
  PARTICLE_SPEED,
  TOWER_RANGE,
  PARTICLE_DAMAGE,
  MINION_MAX_HEALTH,
} from "../../utils/constant";
import { TileNode, ParticleData } from "../../types";

// Define death animation duration constant
const DEATH_FADE_DURATION = 1.0; // 1 second fade-out animation

const Ground = () => {
  const { camera, gl, scene } = useThree();
  const clickableObjs = useGameStore((s) => s.clickableObjs);
  const removeClickableObj = useGameStore((s) => s.removeClickableObj);

  const [tilesGrid, setTilesGrid] = useState<TileNode[][]>([]);
  const [path, setPath] = useState<TileNode[]>([]);
  const [temporaryTower, setTemporaryTower] = useState<THREE.Object3D | null>(null);
  const [towers, setTowers] = useState<THREE.Object3D[]>([]);
  const [activeParticles, setActiveParticles] = useState<ParticleData[]>([]);
  const [minionHealth, setMinionHealth] = useState<number>(MINION_MAX_HEALTH);
  const [isMinionDying, setIsMinionDying] = useState<boolean>(false);
  const [minionDeathTime, setMinionDeathTime] = useState<number | null>(null);

  // Use internal refs that we can freely assign to
  const minionGroupInternal = useRef<THREE.Group | null>(null);
  const minionMeshInternal = useRef<THREE.Mesh | null>(null);
  const healthBarGroupInternal = useRef<THREE.Group | null>(null);
  const healthBarValueInternal = useRef<THREE.Mesh | null>(null);

  // Create refs that are exposed to the component
  const minionRef = minionGroupInternal as MutableRefObject<THREE.Group | null>;
  const minionMeshRef = minionMeshInternal as MutableRefObject<THREE.Mesh | null>;
  const healthBarRef = healthBarGroupInternal as MutableRefObject<THREE.Group | null>;
  const healthBarValueRef = healthBarValueInternal as MutableRefObject<THREE.Mesh | null>;

  const pathIndexRef = useRef<number>(0);
  const raycaster = useRef(new THREE.Raycaster());
  const towerTimers = useRef<Record<string, number>>({});
  const clock = useRef(new THREE.Clock());

  // Function to create a health bar
  const createHealthBar = (): THREE.Group => {
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

    // Assign references directly to internal refs
    healthBarGroupInternal.current = group;
    healthBarValueInternal.current = valueBar;

    return group;
  };

  // Function to update health bar display
  const updateHealthBar = (currentHealth: number): void => {
    if (healthBarValueRef.current) {
      // Calculate health percentage
      const healthPercent = currentHealth / MINION_MAX_HEALTH;

      // Update scale and position of health bar
      healthBarValueRef.current.scale.x = healthPercent;
      healthBarValueRef.current.position.x = -0.3 * (1 - healthPercent);

      // Change color based on health level
      if (healthPercent > 0.6) {
        (healthBarValueRef.current.material as THREE.MeshBasicMaterial).color.setHex(0x00ff00); // Green
      } else if (healthPercent > 0.3) {
        (healthBarValueRef.current.material as THREE.MeshBasicMaterial).color.setHex(0xffff00); // Yellow
      } else {
        (healthBarValueRef.current.material as THREE.MeshBasicMaterial).color.setHex(0xff0000); // Red
      }

      // Check if health is zero
      if (currentHealth <= 0 && !isMinionDying) {
        handleMinionDeath();
      }
    }
  };

  const createTilesGrid = (): TileNode[][] => {
    const tiles: TileNode[][] = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      const currentRow: TileNode[] = [];
      for (let y = 0; y < DEFAULT_COLS; y++) {
        currentRow.push(createInitialGrid(x, y));
      }
      tiles.push(currentRow);
    }
    return tiles;
  };

  const resetTilesGrid = (): TileNode[][] => {
    const tiles: TileNode[][] = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      const currentRow: TileNode[] = [];
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

  useEffect(() => {
    const tiles = createTilesGrid();
    setTilesGrid(tiles);
    calculateInitialPath(tiles);
    clock.current.start();

    // Reset minion health
    setMinionHealth(MINION_MAX_HEALTH);

    // Cleanup function to remove any remaining particles when component unmounts
    return () => {
      activeParticles.forEach((particle) => {
        if (particle.mesh && scene) {
          scene.remove(particle.mesh);
        }
      });
    };
  }, []);

  const calculateInitialPath = (tiles: TileNode[][]): void => {
    const startNode = tiles[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = tiles[FINISH_NODE_ROW][FINISH_NODE_COLUMN];
    astar(tiles, startNode, finishNode);
    const shortestPathInOrder = getShortestPathInOrder(finishNode);
    setPath(shortestPathInOrder);
    pathIndexRef.current = 0; // Reset path index when path is recalculated
    if (minionRef.current) {
      minionRef.current.position.set(START_NODE_ROW, START_NODE_COLUMN, GROUND_HEIGHT);
    }
  };

  const createFireParticle = (): THREE.Mesh => {
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
  };

  const detectMinionsInRange = (
    towerPosition: THREE.Vector3,
    minions: THREE.Object3D[],
    range: number
  ): THREE.Object3D[] => {
    return minions.filter((minion) => {
      const distance = new THREE.Vector3(
        towerPosition.x,
        towerPosition.y,
        towerPosition.z
      ).distanceTo(minion.position);
      return distance <= range;
    });
  };

  const fireParticleFromTower = (
    towerId: string,
    towerPosition: THREE.Vector3,
    targetMinion: THREE.Object3D
  ): ParticleData | null => {
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
    scene.add(particle);
    setActiveParticles((prev) => [...prev, particleData]);

    return particleData;
  };

  // Function to handle minion death
  const handleMinionDeath = (): void => {
    if (!isMinionDying) {
      setIsMinionDying(true);
      setMinionDeathTime(clock.current.getElapsedTime());

      // Play death sound or trigger other death effects here
      console.log("Minion defeated!");
    }
  };

  // Function to update minion opacity during death animation
  const updateMinionDeathAnimation = (delta: number): void => {
    if (!isMinionDying || !minionDeathTime || !minionMeshRef.current) return;

    const currentTime = clock.current.getElapsedTime();
    const elapsedDeathTime = currentTime - minionDeathTime;

    // Calculate fade based on elapsed time
    if (elapsedDeathTime < DEATH_FADE_DURATION) {
      const fadeRatio = 1 - elapsedDeathTime / DEATH_FADE_DURATION;

      // Update minion mesh opacity
      if (minionMeshRef.current.material) {
        (minionMeshRef.current.material as THREE.MeshBasicMaterial).opacity = fadeRatio;
      }

      // Update health bar opacity
      if (healthBarRef.current) {
        healthBarRef.current.children.forEach((child) => {
          if ((child as THREE.Mesh).material) {
            ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = fadeRatio * 0.7; // Maintain original relative opacity
          }
        });
      }

      // Optional: add wobble or sink effect
      if (minionRef.current) {
        minionRef.current.position.y += Math.sin(elapsedDeathTime * 10) * 0.01;
        minionRef.current.position.z -= 0.2 * delta; // Sink into ground
        minionRef.current.rotation.z = Math.sin(elapsedDeathTime * 3) * 0.2; // Wobble
      }
    } else {
      // Death animation complete, remove minion from scene
      if (minionRef.current && scene) {
        scene.remove(minionRef.current);

        // Reset state after death
        setIsMinionDying(false);
        setMinionHealth(MINION_MAX_HEALTH);
        setMinionDeathTime(null);

        // Respawn minion
        setupMinion();
      }
    }
  };

  // Update particles and check collisions
  const updateParticles = (delta: number): void => {
    if (activeParticles.length === 0) return;

    const particlesToRemove: string[] = [];

    activeParticles.forEach((particle) => {
      // Move particle
      const movement = particle.direction.clone().multiplyScalar(particle.speed * delta);
      particle.mesh.position.add(movement);

      // Check for collision with target
      if (particle.target && particle.target.position) {
        const distanceToTarget = particle.mesh.position.distanceTo(particle.target.position);

        if (distanceToTarget < 0.5) {
          // Collision detected - mark for removal
          particlesToRemove.push(particle.id);
          scene.remove(particle.mesh);

          // Handle damage or effects here
          if (!isMinionDying) {
            setMinionHealth((current) => {
              const newHealth = Math.max(0, current - PARTICLE_DAMAGE);
              updateHealthBar(newHealth);
              return newHealth;
            });
          }
        }
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

  useFrame((state, delta) => {
    // Update minion death animation
    updateMinionDeathAnimation(delta);

    // Update minion movement (only if not dying)
    if (
      minionRef.current &&
      path.length > 0 &&
      pathIndexRef.current < path.length &&
      !isMinionDying
    ) {
      const minion = minionRef.current;
      const speed = 2.0;
      const pathIndex = pathIndexRef.current;
      const target = path[pathIndex];
      const targetPosition = new THREE.Vector3(target.row, target.col, GROUND_HEIGHT);
      const direction = targetPosition.clone().sub(minion.position).normalize();
      minion.position.add(direction.multiplyScalar(delta * speed));

      // Update health bar to face the camera
      if (healthBarRef.current) {
        healthBarRef.current.quaternion.copy(camera.quaternion);
      }

      if (minion.position.distanceToSquared(targetPosition) < GROUND_Z_OFFSET) {
        pathIndexRef.current++;

        // If reached end of path, log message and remove from scene
        if (pathIndexRef.current >= path.length) {
          console.log("Minion reached the destination!");

          // Remove minion from scene
          scene.remove(minion);

          // Reset for future use if needed
          minionGroupInternal.current = null;
          minionMeshInternal.current = null;
        }
      }

      // Process tower targeting and firing
      if (minionHealth > 0) {
        // Only target living minions
        towers.forEach((tower, index) => {
          const towerId = `tower_${index}`;
          const towerPosition = tower.position.clone();
          towerPosition.z = GROUND_HEIGHT;
          const minionsInRange = detectMinionsInRange(towerPosition, [minion], TOWER_RANGE);

          if (minionsInRange.length > 0) {
            // Fire at first minion in range if cooldown allows
            fireParticleFromTower(towerId, towerPosition, minionsInRange[0]);
          }
        });
      }
    }

    // Update particles
    updateParticles(delta);
  });

  const handlePointerMove = (event: MouseEvent): void => {
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

  const handlePointerUp = (): void => {
    if (temporaryTower) {
      const _grids = resetTilesGrid();
      _grids[temporaryTower.position.x][temporaryTower.position.y].isTower = true;

      if (minionRef.current) {
        const currentMinionPos = minionRef.current.position;
        const currentRow = Math.round(currentMinionPos.x);
        const currentCol = Math.round(currentMinionPos.y);
        const newStartNode = _grids[currentRow][currentCol];
        const finishNode = _grids[FINISH_NODE_ROW][FINISH_NODE_COLUMN];

        astar(_grids, newStartNode, finishNode);
        const shortestPathInOrder = getShortestPathInOrder(finishNode);

        if (shortestPathInOrder.length > 1) {
          removeClickableObj(temporaryTower);
          setTilesGrid(_grids);
          setTowers([...towers, temporaryTower]);
          pathIndexRef.current = 0;
          setPath(shortestPathInOrder);
          setTemporaryTower(null);
        } else {
          console.warn("Placing this tower will block the path. Try another position.");
        }
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

  // Create a visual indicator for tower range
  const createRangeIndicator = (radius: number): THREE.Group => {
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

  // Function to create and set up minion
  const setupMinion = (): void => {
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
    const healthBar = createHealthBar();
    minionGroup.add(healthBar);

    // Assign to internal refs
    minionGroupInternal.current = minionGroup;
    minionMeshInternal.current = minionMesh;

    // Reset path index
    pathIndexRef.current = 0;

    // Add minion group to scene
    scene.add(minionGroup);
  };

  // Setup effect to create minion and health bar once on initial render
  useEffect(() => {
    setupMinion();
  }, []);

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

const createInitialGrid = (x: number, y: number): TileNode => {
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
