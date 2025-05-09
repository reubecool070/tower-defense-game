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

const Ground = () => {
  const { camera, gl, scene } = useThree();
  const clickableObjs = useGameStore((s) => s.clickableObjs);
  const removeClickableObj = useGameStore((s) => s.removeClickableObj);

  const [tilesGrid, setTilesGrid] = useState([]);
  const [path, setPath] = useState([]);
  const [temporaryTower, setTemporaryTower] = useState(null);
  const [towers, setTowers] = useState([]);
  const [activeParticles, setActiveParticles] = useState([]);
  const [minionHealth, setMinionHealth] = useState(MINION_MAX_HEALTH);
  const [isMinionDying, setIsMinionDying] = useState(false);
  const [minionDeathTime, setMinionDeathTime] = useState(null);

  const minionRef = useRef();
  const minionMeshRef = useRef();
  const healthBarRef = useRef();
  const healthBarValueRef = useRef();
  const pathIndexRef = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());
  const towerTimers = useRef({}); // Track firing cooldowns per tower
  const clock = useRef(new THREE.Clock());

  // Function to create a health bar
  const createHealthBar = () => {
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

    // Save references
    healthBarRef.current = group;
    healthBarValueRef.current = valueBar;

    return group;
  };

  // Function to update health bar display
  const updateHealthBar = (currentHealth) => {
    if (healthBarValueRef.current) {
      // Calculate health percentage
      const healthPercent = currentHealth / MINION_MAX_HEALTH;

      // Update scale and position of health bar
      healthBarValueRef.current.scale.x = healthPercent;
      healthBarValueRef.current.position.x = -0.3 * (1 - healthPercent);

      // Change color based on health level
      if (healthPercent > 0.6) {
        healthBarValueRef.current.material.color.setHex(0x00ff00); // Green
      } else if (healthPercent > 0.3) {
        healthBarValueRef.current.material.color.setHex(0xffff00); // Yellow
      } else {
        healthBarValueRef.current.material.color.setHex(0xff0000); // Red
      }

      // Check if health is zero
      if (currentHealth <= 0 && !isMinionDying) {
        handleMinionDeath();
      }
    }
  };

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

  const calculateInitialPath = (tiles) => {
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

  const detectMinionsInRange = (towerPosition, minions, range) => {
    return minions.filter((minion) => {
      const distance = new THREE.Vector3(
        towerPosition.x,
        towerPosition.y,
        towerPosition.z
      ).distanceTo(minion.position);
      return distance <= range;
    });
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
      .subVectors(targetMinion.position, towerPosition)
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

  // Function to handle minion death
  const handleMinionDeath = () => {
    if (!isMinionDying) {
      setIsMinionDying(true);
      setMinionDeathTime(clock.current.getElapsedTime());

      // Play death sound or trigger other death effects here
      console.log("Minion defeated!");
    }
  };

  // Function to update minion opacity during death animation
  const updateMinionDeathAnimation = (delta) => {
    if (!isMinionDying || !minionDeathTime || !minionMeshRef.current) return;

    const currentTime = clock.current.getElapsedTime();
    const elapsedDeathTime = currentTime - minionDeathTime;

    // Calculate fade based on elapsed time
    if (elapsedDeathTime < DEATH_FADE_DURATION) {
      const fadeRatio = 1 - elapsedDeathTime / DEATH_FADE_DURATION;

      // Update minion mesh opacity
      if (minionMeshRef.current.material) {
        minionMeshRef.current.material.opacity = fadeRatio;
      }

      // Update health bar opacity
      if (healthBarRef.current) {
        healthBarRef.current.children.forEach((child) => {
          if (child.material) {
            child.material.opacity = fadeRatio * 0.7; // Maintain original relative opacity
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

        // Optionally spawn a new minion after delay
        // setTimeout(() => respawnMinion(), 2000);
      }
    }
  };

  // Update particles and check collisions
  const updateParticles = (delta) => {
    if (activeParticles.length === 0) return;

    const particlesToRemove = [];

    activeParticles.forEach((particle) => {
      // Move particle
      const movement = particle.direction.clone().multiplyScalar(particle.speed * delta);
      particle.mesh.position.add(movement);

      // Check for collision with target
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
      }

      // Process tower targeting and firing
      if (minionHealth > 0) {
        // Only target living minions
        towers.forEach((tower, index) => {
          const towerId = `tower_${index}`;
          const towerPosition = tower.position;
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

  // Setup effect to create minion and health bar once on initial render
  useEffect(() => {
    // Initialize the minion group if it doesn't exist
    if (!minionRef.current) {
      // Create minion group
      const minionGroup = new THREE.Group();
      minionGroup.position.set(START_NODE_ROW, START_NODE_COLUMN, GROUND_HEIGHT);

      // Create minion mesh
      const minionMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshBasicMaterial({
          color: "blue",
          transparent: true,
          opacity: 1.0,
        })
      );

      // Save reference to minion mesh
      minionMeshRef.current = minionMesh;

      // Add minion mesh to group
      minionGroup.add(minionMesh);

      // Create and add health bar to group
      const healthBar = createHealthBar();
      minionGroup.add(healthBar);

      // Save reference to minion group
      minionRef.current = minionGroup;

      // Add minion group to scene
      scene.add(minionGroup);
    }
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
