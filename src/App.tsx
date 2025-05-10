import { Canvas } from "@react-three/fiber";
import Ground from "./components/Ground";
import Light from "./components/Light";
import CameraControl from "./components/CameraControls";
import { Sky, Stats } from "@react-three/drei";
import { useGameStore } from "./store";

// Game Stats display component
const GameStatsDisplay = () => {
  const gameStats = useGameStore((state) => state.gameStats);
  const resetGameStats = useGameStore((state) => state.resetGameStats);
  const isPaused = useGameStore((state) => state.isPaused);
  const togglePause = useGameStore((state) => state.togglePause);

  // Handle reset game button click
  const handleReset = () => {
    resetGameStats();
    window.location.reload(); // Simple reload to reset the game state completely
  };

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
      <div>
        Minions: {gameStats.minionsSpawned}/{gameStats.totalMinions}
      </div>

      <button
        onClick={togglePause}
        style={{
          marginTop: "10px",
          background: isPaused ? "#4cd137" : "#718093",
          border: "none",
          borderRadius: "3px",
          padding: "5px 10px",
          color: "white",
          cursor: "pointer",
          width: "100%",
        }}
      >
        {isPaused ? "Resume Game" : "Pause Game"}
      </button>

      {gameStats.gameOver && (
        <div style={{ color: "red", fontWeight: "bold", marginTop: "10px" }}>
          GAME OVER!
          <button
            onClick={handleReset}
            style={{
              marginLeft: "10px",
              background: "#ff6b6b",
              border: "none",
              borderRadius: "3px",
              padding: "3px 8px",
              color: "white",
              cursor: "pointer",
            }}
          >
            Restart
          </button>
        </div>
      )}

      {gameStats.victory && (
        <div style={{ color: "#4cd137", fontWeight: "bold", marginTop: "10px" }}>
          VICTORY!
          <button
            onClick={handleReset}
            style={{
              marginLeft: "10px",
              background: "#4cd137",
              border: "none",
              borderRadius: "3px",
              padding: "3px 8px",
              color: "white",
              cursor: "pointer",
            }}
          >
            Play Again
          </button>
        </div>
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
        <Stats className="bottom-right" />
      </Canvas>
    </>
  );
}

export default App;
