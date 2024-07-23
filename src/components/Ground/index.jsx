/* eslint-disable react/prop-types */
import { useEffect, useRef } from "react";
import { Plane, Stats, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

const Ground = () => {
  const controls = useThree((s) => s.controls);
  const tileRef = useRef(); // Ref for OrbitControls
  const tiles = [];
  const rows = 10;
  const cols = 10;

  const Tile = ({ position }) => {
    const texture = useTexture("textures/grass.jpg");

    return (
      <>
        <Plane
          ref={position[0] === 5 && position[1] === 5 ? tileRef : null}
          args={[1, 1]}
          position={position}
          receiveShadow
        >
          <planeGeometry />
          <meshLambertMaterial
            side={THREE.FrontSide}
            vertexColors={THREE.vertexColors}
            map={texture}
          />
        </Plane>
      </>
    );
  };

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

  // Function to reset the camera
  const resetCamera = () => {
    // Ensure controlsRef.current is defined
    if (!tileRef.current || !controls) return;

    controls.fitToBox(tileRef.current, false, {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 5,
    });
    controls.truckSpeed = 0;
  };

  useEffect(() => {
    resetCamera();
  }, [tileRef.current, controls]);

  return (
    <>
      <group>
        {tiles.map(({ row, col }) => (
          <Tile key={`${row}-${col}`} position={[row, col, 0]} />
        ))}
      </group>

      <Stats />
    </>
  );
};

export default Ground;
