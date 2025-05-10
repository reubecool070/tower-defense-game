import { useCallback, useEffect, useRef, useState } from "react";
import Tile from "../Tile";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../store";
import {
  GROUND_HEIGHT,
  TOWER_RANGE,
  MINION_SPAWN_INTERVAL,
  MAX_ACTIVE_MINIONS,
} from "../../utils/constant";

// Import managers
import { MinionManager } from "./MinionManager";
import { ParticleSystem } from "./ParticleSystem";
import { TowerManager } from "./TowerManager";
import { PathManager } from "./PathManager";

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

  // Ref for tracking time since last spawn
  const lastSpawnTimeRef = useRef<number>(0);
  const raycaster = useRef(new THREE.Raycaster());
  const towerTimers = useRef<Record<string, number>>({});
  const clock = useRef(new THREE.Clock());
  const waveCompletionCheckedRef = useRef<boolean>(false);

  // Initialize manager refs
  const pathManagerRef = useRef<PathManager>(new PathManager());
  const minionManagerRef = useRef<MinionManager>(
    new MinionManager(scene, clock.current, increaseScore, decreaseLives, increaseTotalMinions)
  );
  const particleSystemRef = useRef<ParticleSystem>(new ParticleSystem(scene, clock.current));
  const towerManagerRef = useRef<TowerManager>(new TowerManager(scene));

  // State for temporary tower reference
  const [temporaryTower, setTemporaryTower] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    clock.current.start();

    // Set initial path for minion manager
    minionManagerRef.current.setPath(pathManagerRef.current.getPath());

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

    // Cleanup function
    return () => {
      particleSystemRef.current.cleanupParticles();
      minionManagerRef.current.cleanupMinions();
      towerManagerRef.current.cleanupAllTowers();

      // Remove visibility change listener
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Reset wave completion check when wave changes
  useEffect(() => {
    waveCompletionCheckedRef.current = false;
    console.log(`Wave ${gameStats.waveNumber} - Spawning ${gameStats.totalMinions} minions`);
  }, [gameStats.waveNumber]);

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

  const handlePointerMove = (event: MouseEvent): void => {
    const { clientX, clientY } = event;
    const { left, top, width, height } = gl.domElement.getBoundingClientRect();
    const x = ((clientX - left) / width) * 2 - 1;
    const y = -((clientY - top) / height) * 2 + 1;

    raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera);
    const intersects = raycaster.current.intersectObjects(Array.from(clickableObjs));

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      if (
        !temporaryTower ||
        temporaryTower.position.x !== obj.position.x ||
        temporaryTower.position.y !== obj.position.y
      ) {
        setTemporaryTower(obj);
        towerManagerRef.current.setTemporaryTower(obj);
      }

      // Update preview position
      towerManagerRef.current.updatePreviewPosition(obj.position);

      // Check if placement is valid at this position
      const towerX = obj.position.x;
      const towerY = obj.position.y;

      // Check for minions on this tile
      const minionOnTile = minionManagerRef.current.isMinionOnTile(towerX, towerY);

      // Check if placing the tower would block the path
      const pathValid = pathManagerRef.current.isPathValid(towerX, towerY);

      // Position is valid if: no minion on tile AND valid path exists
      const isValid = !minionOnTile && pathValid;
      towerManagerRef.current.setIsValidPlacement(isValid);
    } else if (temporaryTower) {
      // Clear temporary tower if mouse moves off grid
      setTemporaryTower(null);
      towerManagerRef.current.setTemporaryTower(null);
    }
  };

  const handlePointerUp = (event: MouseEvent): void => {
    if (!temporaryTower) return;

    // Check if placement is valid at this position
    const towerX = temporaryTower.position.x;
    const towerY = temporaryTower.position.y;

    // Check if any minion is on or very close to this tile
    const minionOnTile = minionManagerRef.current.isMinionOnTile(towerX, towerY);

    if (minionOnTile) {
      // Can't place tower here because a minion is on this tile
      console.warn("Cannot place tower here - a minion is occupying this tile!");
      return;
    }

    // Update grid with new tower
    const newGrid = pathManagerRef.current.updateGridWithTower(towerX, towerY);

    // Calculate new path
    const newPath = pathManagerRef.current.calculatePath(newGrid);

    if (newPath.length > 1) {
      // Valid path exists, update everything
      removeClickableObj(temporaryTower);
      pathManagerRef.current.setTilesGrid(newGrid);
      pathManagerRef.current.setPath(newPath);
      towerManagerRef.current.addTower(temporaryTower);

      // Clear the temporary tower
      setTemporaryTower(null);
      towerManagerRef.current.setTemporaryTower(null);

      // Redirect all active minions to the new path
      minionManagerRef.current.redirectMinionsToNewPath(newPath);
    } else {
      console.warn("Placing this tower will block the path. Try another position.");
    }
  };

  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === " ") {
        setPaused(!isPaused);
      }
    },
    [isPaused]
  );

  useEffect(() => {
    gl.domElement.addEventListener("mousemove", handlePointerMove);
    gl.domElement.addEventListener("mousedown", handlePointerMove);
    gl.domElement.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("keypress", handleKeyPress);

    return () => {
      gl.domElement.removeEventListener("mousemove", handlePointerMove);
      gl.domElement.removeEventListener("mousedown", handlePointerMove);
      gl.domElement.removeEventListener("mouseup", handlePointerUp);
      document.removeEventListener("keypress", handleKeyPress);
    };
  }, [temporaryTower, clickableObjs, isPaused]);

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
        const activeCount = minionManagerRef.current.getMinions().filter((m) => !m.isDying).length;
        if (activeCount < MAX_ACTIVE_MINIONS) {
          minionManagerRef.current.spawnMinion(gameStats);
        }
        lastSpawnTimeRef.current = currentTime;
      }
    }

    // Check for wave completion
    checkAndHandleWaveCompletion();

    // Update minion death animations
    minionManagerRef.current.updateMinionDeathAnimations(delta);

    // Update minion movement
    minionManagerRef.current.updateMinionsMovement(delta, camera);

    // Process tower targeting and firing
    const towers = towerManagerRef.current.getTowers();
    const minions = minionManagerRef.current.getMinions();

    towers.forEach((tower, index) => {
      const towerId = `tower_${index}`;
      const towerPosition = tower.position.clone();
      towerPosition.z = GROUND_HEIGHT;

      // Detect minions in range
      const minionsInRange = particleSystemRef.current.detectMinionsInRange(
        towerPosition,
        minions,
        TOWER_RANGE
      );

      if (minionsInRange.length > 0) {
        // Fire at first minion in range if cooldown allows
        particleSystemRef.current.fireParticleFromTower(
          towerId,
          towerPosition,
          minionsInRange[0],
          towerTimers.current
        );
      }
    });

    // Update particles
    particleSystemRef.current.updateParticles(
      delta,
      minions,
      (minionId) => minionManagerRef.current.handleMinionDeath(minionId),
      (healthBar, health) => minionManagerRef.current.updateHealthBar(healthBar, health)
    );
  });

  // Get current state data for rendering
  const tilesGrid = pathManagerRef.current.getTilesGrid();

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
      </group>
    </>
  );
};

export default Ground;
