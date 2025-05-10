import { useGameStore } from "../../store";

export const PauseButton = () => {
  const isPaused = useGameStore((state) => state.isPaused);
  const togglePause = useGameStore((state) => state.togglePause);

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 1000,
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
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
          fontSize: "16px",
          fontWeight: "bold",
          textAlign: "center",
          height: "40px",
        }}
      >
        {isPaused ? "Resume Game" : "Pause Game"}
      </button>
    </div>
  );
};
