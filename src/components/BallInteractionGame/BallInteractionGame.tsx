import React from "react";
import { useSinglePlayerGame, TOTAL_BALLS } from "./useMultiplayerGame";
import { OverlayWelcome } from "./OverlayWelcome";
import "./BallInteractionGame.css";

export const BallInteractionGame: React.FC = () => {
  const {
    // Estados
    isPreloading,
    isStarted,
    isFinishGame,
    score,
    balls,
    explosion,
    scorePopups,

    // Refs
    canvasRef,

    // Métodos
    startGame,

    // Nickname
    nicknameLocal,
    setNicknameLocal,
  } = useSinglePlayerGame();

  // Cada bola vale 100 puntos; maxScore = total de bolas * 100
  const maxScore = TOTAL_BALLS * 100;
  console.log("Balls:", balls);

  console.log("Max Score:", maxScore);

  console.log("Score:", score);

  const progressPercent = Math.max(0, Math.min(1, score / maxScore)) * 100;

  // Responsive sizes
  const isMobile = window.innerWidth <= 600;
  const barWidth = isMobile ? "90vw" : "60vw";
  const barMaxWidth = isMobile ? "98vw" : "600px";
  const barHeight = isMobile ? "18px" : "28px";
  const plateSize = isMobile ? 48 : 100;
  const plateTop = isMobile ? `-${plateSize / 1.5}px` : `-${plateSize / 2.5}px`;
  const logoSize = isMobile ? 40 : 80;
  const logoTop = isMobile ? `-${logoSize / 2.2}px` : `-${logoSize / 3.2}px`;
  const logoRight = isMobile ? `-${logoSize / 2}px` : `-${logoSize * 0.75}px`;

  return (
    <div className="game-container">
      {/* Overlay para ingresar nombre y comenzar */}
      <OverlayWelcome
        isPreloading={isPreloading}
        isStarted={isStarted}
        isFinishGame={isFinishGame}
        startGame={startGame}
        restartGame={() => window.location.reload()}
        nicknameLocal={nicknameLocal}
        setNicknameLocal={setNicknameLocal}
      />

      {/* Canvas de juego */}
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Barra visual de progreso manual */}
      {isStarted && (
        <div
          style={{
            position: "absolute",
            bottom: isMobile ? "16px" : "30px",
            left: "50%",
            transform: "translateX(-50%)",
            width: barWidth,
            maxWidth: barMaxWidth,
            height: barHeight,
            background: "#ff3b3b",
            border: "3px solid #1a237e",
            borderRadius: "16px",
            overflow: "visible",
            boxShadow: "0 2px 8px #0002",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Progreso verde */}
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, #2ecc40 60%, #27ae60 100%)",
              borderRadius: "16px 0 0 16px",
              transition: "width 0.3s ease-in-out",
              boxShadow: "0 0 8px 2px #2ecc4088",
              position: "absolute",
              left: 0,
              top: 0,
              zIndex: 2,
            }}
          />
          {/* Capa base roja */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              background: "#ff3b3b",
              borderRadius: "16px",
              zIndex: 1,
            }}
          />
          {/* Plato superpuesto encima de la barra */}
          <img
            src="/goya/PLATO_CARGA.png"
            alt="Plato"
            style={{
              position: "absolute",
              top: plateTop,
              left: `calc(${progressPercent}% - ${plateSize / 2}px)`,
              width: `${plateSize}px`,
              height: `${plateSize}px`,
              zIndex: 20,
              pointerEvents: "none",
              transition: "left 0.3s ease-in-out, width 0.2s, height 0.2s, top 0.2s",
            }}
          />
          {/* Logo al final de la barra */}
          <img
            src="/goya/LOGO_SIMBOLO.png"
            alt="Logo"
            style={{
              position: "absolute",
              top: logoTop,
              right: logoRight,
              width: `${logoSize}px`,
              height: `${logoSize}px`,
              zIndex: 10,
              pointerEvents: "none",
              transition: "width 0.2s, height 0.2s, top 0.2s, right 0.2s",
            }}
          />
        </div>
      )}

      {/* Botón de reiniciar */}
      {isStarted && !isFinishGame && (
        <img
          src="/goya/BOTON_RESTART.png"
          alt="Botón reiniciar"
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            width: "80px",
            cursor: "pointer",
          }}
          onClick={() => window.location.reload()}
        />
      )}

      {/* Explosión visual */}
      {explosion?.visible && (
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
    </div>
  );
};
