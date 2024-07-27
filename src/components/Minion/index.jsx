// import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

const Minion = () => {
  const minionRef = useRef();

  //   useFrame((state, delta) => {
  //     if (minionRef.current) {
  //       //   minionRef.current.position.x += 0.5 * delta;
  //     }
  //   });
  return (
    <>
      <mesh ref={minionRef} position={[0, 5, 0.25]} renderOrder={2}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial />
      </mesh>
    </>
  );
};

export default Minion;
