/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from "react";
import Tile from "../Tile";
import { astar, getShortestPathInOrder } from "../../algorithms/astar";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;
const START_NODE_ROW = 0;
const START_NODE_COLUMN = 5;
const FINISH_NODE_ROW = 9;
const FINISH_NODE_COLUMN = 0;

const Ground = () => {
  const [tilesGrid, setTilesGrid] = useState([]);
  const minionRef = useRef();
  const [path, setPath] = useState([]);
  const pathIndexRef = useRef(0);
  const elapsedTimeRef = useRef(0);

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
      const duration = 5; // Total duration in seconds to complete the path
      const totalSteps = path.length;
      const stepDuration = duration / totalSteps;

      elapsedTimeRef.current += delta;

      while (
        elapsedTimeRef.current >= stepDuration &&
        pathIndexRef.current < totalSteps - 1
      ) {
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
