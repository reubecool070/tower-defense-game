import { useGameStore } from "../../store";

// Game Stats display component
export const GameStatsDisplay = () => {
  const gameStats = useGameStore((state) => state.gameStats);
  const resetGameStats = useGameStore((state) => state.resetGameStats);

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
        right: "10px",
        background: "rgba(0,0,0,0.7)",
        color: "white",
        padding: "20px",
        borderRadius: "5px",
        fontFamily: "Arial, sans-serif",
        zIndex: 100,
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "200px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Tower Defense</div>
      <div>Score: {gameStats.score}</div>
      <div>Lives: {gameStats.lives}</div>
      <div>Wave: {gameStats.waveNumber}</div>
      <div>
        Minions: {gameStats.minionsSpawned}/{gameStats.totalMinions}
      </div>

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
