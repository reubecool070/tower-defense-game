/* eslint-disable react/prop-types */
import { useEffect, useRef } from "react";
import { CameraControls, Plane, Stats } from "@react-three/drei";
import * as THREE from "three";

const Ground = () => {
  const controlsRef = useRef(); // Ref for OrbitControls
  const tileRef = useRef(); // Ref for OrbitControls
  // const set = useThree((state) => state.set);
  const tiles = [];
  const rows = 10;
  const cols = 10;

  const Tile = ({ position, color }) => {
    return (
      <Plane
        ref={position[0] === 5 && position[1] === 5 ? tileRef : null}
        args={[1, 1]}
        position={position}
        receiveShadow
      >
        <meshLambertMaterial color={color} />
      </Plane>
    );
  };

  for (let x = 0; x < rows; x++) {
    for (let y = 0; y < cols; y++) {
      const color = new THREE.Color(
        Math.random(),
        Math.random(),
        Math.random()
      );
      tiles.push({
        startNode: 0,
        finishNode: 0,
        row: x,
        col: y,
        color: color,
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
        maxAzimuthAngle={0}
        minAzimuthAngle={0}
        maxDistance={50}
      />
      {tiles.map(({ row, col, color }) => (
        <Tile key={`${row}-${col}`} position={[row, col, 0]} color={color} />
      ))}
      <Stats />
    </>
  );
};

export default Ground;
