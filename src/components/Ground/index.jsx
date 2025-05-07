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

const Ground = () => {
  const { camera, gl, scene } = useThree();
  const clickableObjs = useGameStore((s) => s.clickableObjs);
  const removeClickableObj = useGameStore((s) => s.removeClickableObj);

  const [tilesGrid, setTilesGrid] = useState([]);
  const [path, setPath] = useState([]);
  const [temporaryTower, setTemporaryTower] = useState(null);
  const [towers, setTowers] = useState([]);

  const minionRef = useRef();
  const pathIndexRef = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());

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
  }, []);

  const calculateInitialPath = (tiles) => {
    const startNode = tiles[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = tiles[FINISH_NODE_ROW][FINISH_NODE_COLUMN];
    astar(tiles, startNode, finishNode);
    const shortestPathInOrder = getShortestPathInOrder(finishNode);
    setPath(shortestPathInOrder);
    pathIndexRef.current = 0; // Reset path index when path is recalculated
    if (minionRef.current) {
      minionRef.current.position.set(START_NODE_ROW, START_NODE_COLUMN, 0.25);
    }
  };

  const createFireParticle = () => {
    const geometry = new THREE.SphereGeometry(0.1, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xff4500 });
    const particle = new THREE.Mesh(geometry, material);
    return particle;
  };

  const detectMinionsInRange = (towerPosition, minions, range) => {
    const minionsInRange = minions.filter((minion) => {
      const distance = towerPosition.distanceTo(minion.position);
      return distance <= range;
    });
    return minionsInRange;
  };

  const emitParticleTowardsMinion = (towerPosition, minionPosition, createParticle) => {
    const particle = createParticle();
    particle.position.copy(towerPosition);
    const direction = new THREE.Vector3().subVectors(minionPosition, towerPosition).normalize();
    const speed = 1.0;

    const animateParticle = () => {
      particle.position.add(direction.clone().multiplyScalar(speed * 0.016)); // Assuming 60 FPS
      if (particle.position.distanceTo(minionPosition) < 0.1) {
        // Particle reached the minion
        scene.remove(particle);
        return;
      }
      requestAnimationFrame(animateParticle);
    };

    animateParticle();
    scene.add(particle);
  };

  useFrame((state, delta) => {
    if (minionRef.current && path.length > 0 && pathIndexRef.current < path.length) {
      const minion = minionRef.current;
      const speed = 2.0;
      const pathIndex = pathIndexRef.current;
      const target = path[pathIndex];
      const targetPosition = new THREE.Vector3(target.row, target.col, 0.25);
      const direction = targetPosition.clone().sub(minion.position).normalize();
      minion.position.add(direction.multiplyScalar(delta * speed));

      if (minion.position.distanceToSquared(targetPosition) < 0.01) {
        pathIndexRef.current++;
      }

      // Detect minions in range and emit particles
      towers.forEach((tower) => {
        const towerPosition = tower.position;
        const minionsInRange = detectMinionsInRange(towerPosition, [minion], 3.0);
        minionsInRange.forEach((minionInRange) => {
          emitParticleTowardsMinion(towerPosition, minionInRange.position, createFireParticle);
        });
      });
    }
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

  return (
    <>
      <mesh ref={minionRef} position={[0, 5, 0.25]} renderOrder={2}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial />
      </mesh>
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
          <mesh key={index} position={position} renderOrder={2}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color="green" />
          </mesh>
        ))}
        {temporaryTower && (
          <mesh position={temporaryTower.position} renderOrder={2}>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color="red" />
          </mesh>
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
