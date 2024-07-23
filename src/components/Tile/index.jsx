import { Plane, useTexture } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

// eslint-disable-next-line react/prop-types
const Tile = ({ position }) => {
  const texture = useTexture("textures/grass.jpg");
  const tileRef = useRef(); // Ref for OrbitControls
  const controls = useThree((s) => s.controls);

  // Function to reset the camera
  const resetCamera = () => {
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

export default Tile;
