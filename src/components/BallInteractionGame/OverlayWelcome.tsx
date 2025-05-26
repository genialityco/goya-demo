import React from "react";

interface OverlayWelcomeProps {
  isPreloading: boolean;
  isStarted: boolean;
  isFinishGame: boolean;
  userStartLocalGame: boolean;

  startGame: () => void;
  restartGame: () => void;

  nicknameLocal: string;
  setNicknameLocal: React.Dispatch<React.SetStateAction<string>>;
}

export const OverlayWelcome: React.FC<OverlayWelcomeProps> = ({
  isPreloading,
  isStarted,
  isFinishGame,
  startGame,
  restartGame,
  nicknameLocal,
  setNicknameLocal,
  userStartLocalGame,
}) => {
  const isMobile = window.innerWidth <= 768;

  const backgroundImage = isMobile
    ? "/goya/MOBILE/GOYA_HOME_MOBILE.png"
    : "/goya/DESKTOP/FONDO_GOYA_HOME.png";

  if (isStarted && !isFinishGame && userStartLocalGame) return null;

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 10,
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
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
      ) : isFinishGame ? (
        <>
          <h2>¡El juego ha finalizado!</h2>
          <img
            style={{ width: "250px", height: "80px", cursor: "pointer" }}
            onClick={restartGame}
            className="restart-button"
            src="/goya/BOTON_RESTART.png"
          />
        </>
      ) : !isStarted ? (
        <>
          <h2>Ingresa tu nombre</h2>
          <input
            type="text"
            placeholder="Tu nombre"
            value={nicknameLocal}
            onChange={(e) => setNicknameLocal(e.target.value)}
            style={{
              fontSize: "18px",
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              textAlign: "center",
              marginBottom: "12px",
            }}
          />
          <p
            style={{
              margin: "5px 0",
              fontSize: "15px",
              width: isMobile ? "80%" : "50%",
              textAlign: "center",
            }}
          >
            <strong>Instrucciones:</strong> Usa tus manos frente a la cámara
            para explotar globos en pantalla. Ganas puntos por cada globo que toques.
          </p>
          <img
            style={{ width: "250px", height: "80px", cursor: "pointer" }}
            onClick={startGame}
            className="restart-button"
            src="/goya/DESKTOP/BOTON.png"
          />
        </>
      ) : null}
    </div>
  );
};
