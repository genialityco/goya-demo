import React from "react";

interface OverlayWelcomeProps {
  isPreloading: boolean;
  isStarted: boolean;
  roomId: string;
  startGame: () => void;
}

export const OverlayWelcome: React.FC<OverlayWelcomeProps> = ({
  isPreloading,
  isStarted,
  roomId,
  startGame,
}) => {
  if (isStarted) return null; // Si ya comenzó, no mostramos nada.

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 10,
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.8)",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "24px",
      }}
    >
      {isPreloading ? (
        <p>Cargando modelo...</p>
      ) : (
        <>
          <h2>Bienvenido a la sala {roomId}</h2>
          <button
            style={{ fontSize: "18px", padding: "10px 20px", cursor: "pointer" }}
            onClick={startGame}
          >
            Empezar
          </button>
        </>
      )}
    </div>
  );
};
