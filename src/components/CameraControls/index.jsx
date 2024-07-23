import { CameraControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

const CameraControl = () => {
  const controlsRef = useRef(); // Ref for OrbitControls
  const set = useThree((s) => s.set);

  useEffect(() => {
    if (controlsRef.current) {
      set({ controls: controlsRef.current });
    }
  }, [controlsRef.current]);

  return (
    <>
      <CameraControls
        ref={controlsRef}
        makeDefault
        maxPolarAngle={0}
        minPolarAngle={0}
        minDistance={1}
      />
    </>
  );
};

export default CameraControl;
