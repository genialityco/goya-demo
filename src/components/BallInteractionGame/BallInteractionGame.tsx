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
    isFinishGame
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
      />

      {/* Scoreboard (tabla de puntos) */}
      <Scoreboard players={players} />

      {/* Canvas del juego */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Botón para reiniciar */}
      {isStarted && (
        <button
          onClick={restartGame}
          className="restart-button"
        />
      )}

      {/* Aquí mostramos la explosión si está visible */}
      {explosion && explosion.visible && (
        <img
          src="/gifs/energy-explosion.gif" 
          alt="explosión"
          style={{
            position: "absolute",
            // Ajustamos para centrar la imagen en x, y
            left: explosion.x - 50,
            top: explosion.y - 50,
            width: "200px",
            height: "200px",
            pointerEvents: "none", // Para que no interfiera con clics, etc.
          }}
        />
      )}
    </div>
  );
};
