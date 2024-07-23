import { Canvas } from "@react-three/fiber";
import Ground from "./components/Ground";
import Light from "./components/Light";
import CameraControl from "./components/CameraControls";

function App() {
  return (
    <Canvas
      shadows
      camera={{
        fov: 30,
        near: 0.1,
        far: 1000,
        up: [0, 0, 1], // Make sure the Z-axis is up
      }}
    >
      <Light />
      <CameraControl />
      <Ground />
    </Canvas>
  );
}

export default App;
