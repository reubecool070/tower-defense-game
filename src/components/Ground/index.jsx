/* eslint-disable react/prop-types */
import { useEffect, useRef } from "react";
import { CameraControls, Plane, Stats, useTexture } from "@react-three/drei";

import * as THREE from "three";

const Ground = () => {
  const controlsRef = useRef(); // Ref for OrbitControls
  const tileRef = useRef(); // Ref for OrbitControls
  const tiles = [];
  const rows = 10;
  const cols = 10;

  const Tile = ({ position }) => {
    const texture = useTexture("textures/ground.png");

    return (
      <>
        <Plane
          ref={position[0] === 5 && position[1] === 5.02 ? tileRef : null}
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
    if (!tileRef.current || !controlsRef.current) return;

    controlsRef.current.fitToBox(tileRef.current, false, {
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 5,
    });
    controlsRef.current.truckSpeed = 0;
  };

  useEffect(() => {
    if (tileRef.current && controlsRef.current) {
      resetCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileRef.current, controlsRef.current]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 10]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <CameraControls
        ref={controlsRef}
        makeDefault
        maxPolarAngle={0}
        minPolarAngle={0}
        // maxAzimuthAngle={0}
        // minAzimuthAngle={0}
        maxDistance={50}
      />
      <group>
        {tiles.map(({ row, col }) => (
          <Tile key={`${row}-${col}`} position={[row, col + 0.02, 0]} />
        ))}
      </group>

      <Stats />
    </>
  );
};

export default Ground;
