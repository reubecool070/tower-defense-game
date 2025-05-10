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
  DEATH_FADE_DURATION,
  MINION_SPAWN_INTERVAL,
  MAX_ACTIVE_MINIONS,
} from "../../utils/constant";
import { TileNode, ParticleData, Minion } from "../../types";

// Interface for tracking minions
const Ground = () => {
  const { camera, gl, scene } = useThree();

  // Game store access
  const clickableObjs = useGameStore((s) => s.clickableObjs);
  const removeClickableObj = useGameStore((s) => s.removeClickableObj);
  const increaseScore = useGameStore((s) => s.increaseScore);
  const decreaseLives = useGameStore((s) => s.decreaseLives);
  const increaseTotalMinions = useGameStore((s) => s.increaseTotalMinions);
  const checkWaveCompletion = useGameStore((s) => s.checkWaveCompletion);
  const advanceToNextWave = useGameStore((s) => s.advanceToNextWave);
  const gameStats = useGameStore((s) => s.gameStats);
  const isPaused = useGameStore((s) => s.isPaused);
  const setPaused = useGameStore((s) => s.setPaused);

  const [tilesGrid, setTilesGrid] = useState<TileNode[][]>([]);
  const [path, setPath] = useState<TileNode[]>([]);
  const [temporaryTower, setTemporaryTower] = useState<THREE.Object3D | null>(null);
  const [towers, setTowers] = useState<THREE.Object3D[]>([]);
  const [activeParticles, setActiveParticles] = useState<ParticleData[]>([]);
  const [minions, setMinions] = useState<Minion[]>([]);

  // Ref for tracking time since last spawn
  const lastSpawnTimeRef = useRef<number>(0);
  const raycaster = useRef(new THREE.Raycaster());
  const towerTimers = useRef<Record<string, number>>({});
  const clock = useRef(new THREE.Clock());
  const waveCompletionCheckedRef = useRef<boolean>(false);

  // Function to create a health bar
  const createHealthBar = (): { group: THREE.Group; valueBar: THREE.Mesh } => {
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
  };

  // Function to update health bar display
  const updateHealthBar = (valueBar: THREE.Mesh, currentHealth: number): void => {
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

    console.log(
      `Starting Wave ${gameStats.waveNumber} - Spawning ${gameStats.totalMinions} minions`
    );

    // Setup visibility change detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, pause the game
        setPaused(true);
      }
    };

    // Add event listener for visibility change
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup function to remove any remaining particles and minions when component unmounts
    return () => {
      activeParticles.forEach((particle) => {
        if (particle.mesh && scene) {
          scene.remove(particle.mesh);
        }
      });

      minions.forEach((minion) => {
        if (minion.group && scene) {
          scene.remove(minion.group);
        }
      });

      // Remove visibility change listener
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Reset wave completion check when wave changes
  useEffect(() => {
    waveCompletionCheckedRef.current = false;
    console.log(`Wave ${gameStats.waveNumber} - Spawning ${gameStats.totalMinions} minions`);
  }, [gameStats.waveNumber]);

  const calculateInitialPath = (tiles: TileNode[][]): void => {
    const startNode = tiles[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = tiles[FINISH_NODE_ROW][FINISH_NODE_COLUMN];
    astar(tiles, startNode, finishNode);
    const shortestPathInOrder = getShortestPathInOrder(finishNode);
    setPath(shortestPathInOrder);
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
    minionObjects: THREE.Object3D[],
    range: number
  ): THREE.Object3D[] => {
    return minionObjects.filter((minion) => {
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
  const handleMinionDeath = (minionId: string): void => {
    setMinions((prevMinions) =>
      prevMinions.map((minion) =>
        minion.id === minionId && !minion.isDying
          ? {
              ...minion,
              isDying: true,
              deathStartTime: clock.current.getElapsedTime(),
            }
          : minion
      )
    );

    // Increase score using the game store
    increaseScore();

    console.log(`Minion ${minionId} defeated! +1 Score`);
  };

  // Function to create and set up a new minion
  const spawnMinion = (): void => {
    if (path.length === 0) return;

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
    const { group: healthBar, valueBar: healthBarValue } = createHealthBar();
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
    increaseTotalMinions();

    // Add to state
    setMinions((prevMinions) => [...prevMinions, newMinion]);

    // Add to scene
    scene.add(minionGroup);

    console.log(
      `Spawned minion ${minionId} (${gameStats.minionsSpawned + 1}/${gameStats.totalMinions})`
    );
  };

  // Update minion death animations
  const updateMinionDeathAnimations = (delta: number): void => {
    let minionRemovalIds: string[] = [];

    setMinions((prevMinions) =>
      prevMinions.map((minion) => {
        if (minion.isDying && minion.deathStartTime) {
          const currentTime = clock.current.getElapsedTime();
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
                ((child as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
                  fadeRatio * 0.7;
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
            scene.remove(minion.group);
            return minion;
          }
        }
        return minion;
      })
    );

    // Remove dead minions
    if (minionRemovalIds.length > 0) {
      setMinions((prevMinions) =>
        prevMinions.filter((minion) => !minionRemovalIds.includes(minion.id))
      );
    }
  };

  // Update particles and check collisions
  const updateParticles = (delta: number): void => {
    if (activeParticles.length === 0) return;

    const particlesToRemove: string[] = [];
    const minionsHit: { id: string; damage: number }[] = [];

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

          // Find which minion was hit
          const hitMinionId = minions.find((m) => m.group === particle.target)?.id;

          if (hitMinionId) {
            minionsHit.push({ id: hitMinionId, damage: PARTICLE_DAMAGE });
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

    // Apply damage to hit minions
    if (minionsHit.length > 0) {
      setMinions((prevMinions) =>
        prevMinions.map((minion) => {
          const hitInfo = minionsHit.find((hit) => hit.id === minion.id);
          if (hitInfo && !minion.isDying) {
            const newHealth = Math.max(0, minion.health - hitInfo.damage);
            updateHealthBar(minion.healthBarValue, newHealth);

            // Check for death
            if (newHealth <= 0 && !minion.isDying) {
              handleMinionDeath(minion.id);
            }

            return {
              ...minion,
              health: newHealth,
            };
          }
          return minion;
        })
      );
    }

    // Remove processed particles from active list
    if (particlesToRemove.length > 0) {
      setActiveParticles((prev) => prev.filter((p) => !particlesToRemove.includes(p.id)));
    }
  };

  // Check if wave is complete and handle accordingly
  const checkAndHandleWaveCompletion = () => {
    // Only check if we haven't already checked for this wave
    if (!waveCompletionCheckedRef.current) {
      const isWaveComplete = checkWaveCompletion();

      if (isWaveComplete) {
        waveCompletionCheckedRef.current = true;

        // Delay advancing to next wave to allow time for animations and UI to update
        setTimeout(() => {
          advanceToNextWave();
        }, 3000);
      }
    }
  };

  useFrame((state, delta) => {
    // If game is paused, don't update anything
    if (isPaused) return;

    const currentTime = clock.current.getElapsedTime();

    // Only spawn new minions if:
    // 1. Game is not over or victory
    // 2. We haven't reached the total minions limit for this wave
    if (
      !gameStats.gameOver &&
      !gameStats.victory &&
      gameStats.minionsSpawned < gameStats.totalMinions
    ) {
      // Handle minion spawning
      if (currentTime - lastSpawnTimeRef.current > MINION_SPAWN_INTERVAL) {
        // Only spawn if we're under the maximum active minions
        const activeCount = minions.filter((m) => !m.isDying).length;
        if (activeCount < MAX_ACTIVE_MINIONS) {
          spawnMinion();
        }
        lastSpawnTimeRef.current = currentTime;
      }
    }

    // Check for wave completion
    checkAndHandleWaveCompletion();

    // Update minion death animations
    updateMinionDeathAnimations(delta);

    // Update minion movement
    minions.forEach((minion) => {
      if (!minion.isDying && path.length > 0 && minion.pathIndex < path.length) {
        const minionGroup = minion.group;
        const speed = 2.0;
        const target = path[minion.pathIndex];
        const targetPosition = new THREE.Vector3(target.row, target.col, GROUND_HEIGHT);
        const direction = targetPosition.clone().sub(minionGroup.position).normalize();
        minionGroup.position.add(direction.multiplyScalar(delta * speed));

        // Update health bar to face the camera
        minion.healthBar.quaternion.copy(camera.quaternion);

        if (minionGroup.position.distanceToSquared(targetPosition) < GROUND_Z_OFFSET) {
          // Update this minion's path index
          setMinions((prevMinions) =>
            prevMinions.map((m) => {
              if (m.id === minion.id) {
                const newPathIndex = m.pathIndex + 1;

                // If reached end of path
                if (newPathIndex >= path.length) {
                  console.log(`Minion ${m.id} reached the destination! -1 Life`);

                  // Reduce player lives using game store
                  decreaseLives();

                  scene.remove(m.group);
                  return {
                    ...m,
                    pathIndex: newPathIndex,
                  };
                }

                return {
                  ...m,
                  pathIndex: newPathIndex,
                };
              }
              return m;
            })
          );
        }
      }
    });

    // Clean up minions that have reached the destination
    setMinions((prevMinions) => prevMinions.filter((minion) => minion.pathIndex < path.length));

    // Process tower targeting and firing
    towers.forEach((tower, index) => {
      const towerId = `tower_${index}`;
      const towerPosition = tower.position.clone();
      towerPosition.z = GROUND_HEIGHT;

      // Get all active minion groups
      const minionGroups = minions.filter((m) => !m.isDying && m.health > 0).map((m) => m.group);

      const minionsInRange = detectMinionsInRange(towerPosition, minionGroups, TOWER_RANGE);

      if (minionsInRange.length > 0) {
        // Fire at first minion in range if cooldown allows
        fireParticleFromTower(towerId, towerPosition, minionsInRange[0]);
      }
    });

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

      // Check if placing the tower would block the path
      const startNode = _grids[START_NODE_ROW][START_NODE_COLUMN];
      const finishNode = _grids[FINISH_NODE_ROW][FINISH_NODE_COLUMN];

      astar(_grids, startNode, finishNode);
      const shortestPathInOrder = getShortestPathInOrder(finishNode);

      if (shortestPathInOrder.length > 1) {
        removeClickableObj(temporaryTower);
        setTilesGrid(_grids);
        setTowers([...towers, temporaryTower]);
        setPath(shortestPathInOrder);
        setTemporaryTower(null);

        // Update all minion paths
        setMinions((prevMinions) =>
          prevMinions.map((minion) => ({
            ...minion,
            // Keep current progress on path
            pathIndex: Math.min(minion.pathIndex, shortestPathInOrder.length - 1),
          }))
        );
      } else {
        console.warn("Placing this tower will block the path. Try another position.");
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
