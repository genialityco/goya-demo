import React from "react";
import { useMultiplayerGame } from "./useMultiplayerGame";
import { Scoreboard } from "./Scoreboard";
import { OverlayWelcome } from "./OverlayWelcome";
import "./BallInteractionGame.css"; // Importa la hoja de estilos

const ROOM_ID = "miSala";

export const BallInteractionGame: React.FC = () => {
  const {
    isPreloading,
    isStarted,
    players,
    canvasRef,
    startGame,
    restartGame,
    explosion,
    isFinishGame,
  } = useMultiplayerGame();

  return (
    <div className="game-container">
      {/* Overlay de bienvenida/carga */}
      <OverlayWelcome
        isPreloading={isPreloading}
        isStarted={isStarted}
        roomId={ROOM_ID}
        startGame={startGame}
        isFinishGame={isFinishGame}
        restartGame={restartGame}
        players={players}
      />

      {/* Scoreboard (tabla de puntos) */}
      <Scoreboard players={players} />

      {/* Canvas del juego */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Botón para reiniciar */}
      {isStarted && (
        <img
          src="/DESKTOP/BOTOM-RESTART.png"
          alt="Botón reiniciar"
          style={{
            position: "absolute",
            left: "3%",
            bottom: "5%",
            width: "200px",
            height: "auto",
            cursor: "pointer",
          }}
          className="restart-button"
          onClick={restartGame}
        />
      )}

      {/* Aquí mostramos la explosión si está visible */}
      {explosion && explosion.visible && (
        <img
          src="/gifs/3iCN.gif"
          alt="explosión"
          style={{
            position: "absolute",
            // Ajusta la mitad del GIF si quieres centrarlo
            left: explosion.x - 75,
            top: explosion.y - 75,
            width: "150px",
            height: "150px",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};
