/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import Tile from "../Tile";

const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 10;

const Ground = () => {
  const [tilesGrid, setTilesGrid] = useState([]);

  useEffect(() => {
    const tiles = [];
    for (let x = 0; x < DEFAULT_ROWS; x++) {
      for (let y = 0; y < DEFAULT_COLS; y++) {
        createInitialGrid(tiles, x, y);
      }
    }
    setTilesGrid(tiles);
  }, []);

  return (
    <>
      <group>
        {tilesGrid.map(({ row, col, startNode, finishNode }) => (
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

const createInitialGrid = (tiles, x, y) => {
  tiles.push({
    startNode: x === 0 && y === 5,
    finishNode: x === 9 && y === 5,
    row: x,
    col: y,
  });
};
