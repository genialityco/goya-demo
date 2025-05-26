import React from "react";
import { useSinglePlayerGame } from "./useMultiplayerGame";
import { OverlayWelcome } from "./OverlayWelcome";
import "./BallInteractionGame.css";

export const BallInteractionGame: React.FC = () => {
  const {
    // Estados
    isStarted,
    isFinishGame,
    isPreloading,
    userStartLocalGame,
    explosion,
    scorePopups,
    score,
    balls,

    // Refs
    canvasRef,

    // Métodos
    startGame,

    // Nickname
    nicknameLocal,
    setNicknameLocal,
  } = useSinglePlayerGame();

  const maxScore = Object.keys(balls).length * 100;

  return (
    <div className="game-container">
      {/* Overlay para ingresar nombre y comenzar */}
      <OverlayWelcome
        isPreloading={isPreloading}
        isStarted={isStarted}
        isFinishGame={isFinishGame}
        userStartLocalGame={userStartLocalGame}
        startGame={startGame}
        restartGame={() => window.location.reload()}
        nicknameLocal={nicknameLocal}
        setNicknameLocal={setNicknameLocal}
      />

      {/* Canvas de juego */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Barra visual de progreso */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "auto",
        }}
      >
        <div
          style={{
            position: "relative",
            left: "20%", // ajusta según el margen izquierdo deseado
            width: "60%",
            height: "80px", // ajusta según la altura real de la imagen
            backgroundImage: 'url("/public/goya/BARRA/BARRA.png")',
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "52%",
              left: "13%", // ajusta según el inicio visible del tubo rojo (plato)
              transform: "translateY(-50%)",
              height: "12px", // grosor visual del tubo rojo
              backgroundColor: "#fff",
              width: `${Math.min((score / maxScore) * 420, 420)}px`, // 420px = longitud visible del tubo
              borderRadius: "6px",
              transition: "width 0.3s ease-in-out",
            }}
          />
        </div>
      </div>

      {/* Botón de reiniciar solo si juego activo */}
      {isStarted && !isFinishGame && (
        <img
          src="/goya/BOTON_RESTART.png"
          alt="Botón reiniciar"
          style={{
            position: "absolute",
            left: "0%",
            top: "0%",
            width: "200px",
            height: "auto",
            cursor: "pointer",
          }}
          className="restart-button"
          onClick={() => window.location.reload()}
        />
      )}

      {/* Explosión visual */}
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

      {/* Popups de puntuación */}
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

      {/* Score en pantalla */}
      {isStarted && <div className="score-display">Puntos: {score}</div>}
    </div>
  );
};
