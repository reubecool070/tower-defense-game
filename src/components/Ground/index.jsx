/* eslint-disable react/prop-types */
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
  const { camera, gl } = useThree();
  const clickableObjs = useGameStore((s) => s.clickableObjs);
  const removeClickableObj = useGameStore((s) => s.removeClickableObj);

  const [tilesGrid, setTilesGrid] = useState([]);
  const [path, setPath] = useState([]);
  const [temporaryTower, setTemporaryTower] = useState(null);
  const [towers, setTowers] = useState([]);

  const minionRef = useRef();
  const pathIndexRef = useRef(0);
  const elapsedTimeRef = useRef(0);
  const raycaster = useRef(new THREE.Raycaster());

  useEffect(() => {
    const tiles = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      const currentRow = [];
      for (let y = 0; y < DEFAULT_COLS; y++) {
        currentRow.push(createInitialGrid(x, y));
      }
      tiles.push(currentRow);
    }

    setTilesGrid(tiles);
    const startNode = tiles[START_NODE_ROW][START_NODE_COLUMN];
    const finishNode = tiles[FINISH_NODE_ROW][FINISH_NODE_COLUMN];
    astar(tiles, startNode, finishNode);
    const shortedPathInOrder = getShortestPathInOrder(finishNode);
    setPath(shortedPathInOrder);
  }, []);

  useFrame((state, delta) => {
    if (minionRef.current && path.length > 0) {
      const duration = 50; // Total duration in seconds to complete the path
      const totalSteps = path.length;
      const stepDuration = duration / totalSteps;

      elapsedTimeRef.current += delta;

      while (elapsedTimeRef.current >= stepDuration && pathIndexRef.current < totalSteps - 1) {
        elapsedTimeRef.current -= stepDuration;
        pathIndexRef.current++;
      }

      const start = path[pathIndexRef.current];
      const end = path[pathIndexRef.current + 1] || start;

      const t = elapsedTimeRef.current / stepDuration;
      minionRef.current.position.lerpVectors(
        new THREE.Vector3(start.row, start.col, 0.25),
        new THREE.Vector3(end.row, end.col, 0.25),
        t
      );
    }
  });

  const handlePointerMove = (event) => {
    const { clientX, clientY } = event;
    const { left, top, width, height } = gl.domElement.getBoundingClientRect();
    const x = ((clientX - left) / width) * 2 - 1;
    const y = -((clientY - top) / height) * 2 + 1;

    raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera);
    const intersects = raycaster.current.intersectObjects(Array.from(clickableObjs));

    // TODO: intersects should not be on startnode and finishnode
    if (intersects.length > 0) {
      const obj = intersects[0].object;
      setTemporaryTower(obj);
    }
  };

  const handlePointerUp = () => {
    if (temporaryTower) {
      removeClickableObj(temporaryTower);
      // update isTower to true for that tile
      const _grids = tilesGrid.slice();
      _grids[temporaryTower.position.x][temporaryTower.position.y].isTower = true;
      setTilesGrid(_grids);

      setTowers([...towers, temporaryTower]);
      setTemporaryTower(null);
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
        {tilesGrid.flat().map(({ row, col, startNode, finishNode }) => (
          <Tile
            key={`${row}-${col}`}
            position={[row, col, 0]}
            startNode={startNode}
            finishNode={finishNode}
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
    name: "node",
  };
};
