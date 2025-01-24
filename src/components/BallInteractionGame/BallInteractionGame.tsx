import React from "react";
import { useMultiplayerGame } from "./useMultiplayerGame";
import { Scoreboard } from "./Scoreboard";
import { OverlayWelcome } from "./OverlayWelcome";
import "./BallInteractionGame.css";

export const BallInteractionGame: React.FC = () => {
  const {
    // Estados
    isPreloading,
    isStarted,
    isFinishGame,
    userJoined,
    isOwner,
    players,
    explosion,
    userStartLocalGame,

    // Refs
    canvasRef,

    // Métodos
    joinRoom,
    startGame,
    restartGame,
    scorePopups,

    // Nickname
    nicknameLocal,
    setNicknameLocal,
  } = useMultiplayerGame();

  return (
    <div className="game-container">
      {/* Overlay: controla la lógica de ingresar, iniciar juego, etc. */}
      <OverlayWelcome
        isPreloading={isPreloading}
        isStarted={isStarted}
        isFinishGame={isFinishGame}
        userJoined={userJoined}
        isOwner={isOwner}
        players={players}
        joinRoom={joinRoom}
        startGame={startGame}
        restartGame={restartGame}
        nicknameLocal={nicknameLocal}
        setNicknameLocal={setNicknameLocal}
        userStartLocalGame={userStartLocalGame}
      />

      {/* Si el juego está activo y no finalizó, mostramos scoreboard */}
      {isStarted && !isFinishGame && <Scoreboard players={players} />}

      {/* Canvas principal */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Botón de reiniciar, sólo visible si:
          - el juego está iniciado,
          - no ha terminado,
          - y si eres el dueño. 
          (Opcional, depende de tu preferencia de UI)
       */}
      {isStarted && !isFinishGame && isOwner && (
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

      {/* Explosión */}
      {explosion && explosion.visible && (
        <img
          src="/gifs/3iCN.gif"
          alt="explosión"
          style={{
            position: "absolute",
            left: explosion.x - 75,
            top: explosion.y - 75,
            width: "150px",
            height: "150px",
            pointerEvents: "none",
          }}
        />
      )}
      {scorePopups.map(
        (popup) =>
          popup.visible && (
            <div
              key={popup.id}
              style={{
                position: "absolute",
                left: popup.x,
                top: popup.y,
                transform: "translate(-50%, -50%)",
              }}
              className="popup-score"
            >
              +100
            </div>
          )
      )}
    </div>
  );
};
