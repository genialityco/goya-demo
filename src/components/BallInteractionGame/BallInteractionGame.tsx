import React from "react";
import { useMultiplayerGame } from "./useMultiplayerGame";
import { Scoreboard } from "./Scoreboard";
import { OverlayWelcome } from "./OverlayWelcome";

const ROOM_ID = "miSala";

export const BallInteractionGame: React.FC = () => {
  // Consumimos la lógica del hook
  const {
    isPreloading,
    isStarted,
    players,
    canvasRef,
    startGame,
    restartGame,
  } = useMultiplayerGame();

  return (
    <>
      {/* Overlay de bienvenida/carga */}
      <OverlayWelcome
        isPreloading={isPreloading}
        isStarted={isStarted}
        roomId={ROOM_ID}
        startGame={startGame}
      />

      {/* Scoreboard (tabla de puntos) */}
      <Scoreboard players={players} />

      {/* Canvas del juego */}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />

      {/**Botón para reiniciar */}
      <button
        onClick={restartGame}
        style={{
          position: "absolute",
          bottom: "5%",
          right: "5%",
          zIndex: 5,
          padding: "10px 20px",
        }}
      >
        Reiniciar
      </button>
    </>
  );
};
