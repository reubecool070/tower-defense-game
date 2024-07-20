import { Canvas } from "@react-three/fiber";
import Ground from "./components/Ground";

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
      <Ground />
    </Canvas>
  );
}

export default App;
