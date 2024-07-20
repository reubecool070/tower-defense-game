import { Canvas } from "@react-three/fiber";
import Ground from "./components/Ground";
import { Vector3 } from "three";

function App() {
  return (
    <Canvas
      shadows
      camera={{
        position: [14.167974189157714, 4.665839685727069, 16.523877404187285],
        rotate: new Vector3(
          -0.0005901883181447743,
          0.3230309771883191,
          1.5726555240453586
        ),
        fov: 30,
        near: 0.1,
        far: 1000,
        up: [0, 0, 1], // Make sure the Z-axis is up
      }}
    >
      <Ground />
    </Canvas>
  );
}

export default App;
