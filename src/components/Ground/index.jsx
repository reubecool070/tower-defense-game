/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import Tile from "../Tile";

const Ground = () => {
  const [tilesGrid, setTilesGrid] = useState([]);

  const rows = 10;
  const cols = 10;

  useEffect(() => {
    const tiles = [];
    for (let x = 0; x < rows; x++) {
      for (let y = 0; y < cols; y++) {
        tiles.push({
          startNode: 0,
          finishNode: 0,
          row: x,
          col: y,
        });
      }
    }
    setTilesGrid(tiles);
  }, []);

  return (
    <>
      <group>
        {tilesGrid.map(({ row, col }) => (
          <Tile key={`${row}-${col}`} position={[row, col, 0]} />
        ))}
      </group>
    </>
  );
};

export default Ground;
