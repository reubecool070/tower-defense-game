import { Canvas } from "@react-three/fiber";
import Ground from "./components/Ground";
import Light from "./components/Light";
import CameraControl from "./components/CameraControls";
import { Sky, Stats } from "@react-three/drei";
import { useGameStore } from "./store";

// Game Stats display component
const GameStatsDisplay = () => {
  const gameStats = useGameStore((state) => state.gameStats);

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        background: "rgba(0,0,0,0.7)",
        color: "white",
        padding: "10px",
        borderRadius: "5px",
        fontFamily: "Arial, sans-serif",
        zIndex: 100,
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Tower Defense</div>
      <div>Score: {gameStats.score}</div>
      <div>Lives: {gameStats.lives}</div>
      <div>Wave: {gameStats.waveNumber}</div>
      {gameStats.gameOver && (
        <div style={{ color: "red", fontWeight: "bold", marginTop: "10px" }}>GAME OVER!</div>
      )}
    </div>
  );
};

function App() {
  return (
    <>
      <GameStatsDisplay />
      <Canvas
        shadows
        camera={{
          fov: 30,
          near: 0.1,
          far: 1000,
          up: [0, 0, 1], // Make sure the Z-axis is up
        }}
      >
        <Sky sunPosition={[10, 10, 10]} />
        <Light />
        <CameraControl />
        <Ground />
        <Stats />
      </Canvas>
    </>
  );
}

export default App;
