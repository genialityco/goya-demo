import React from "react";

interface OverlayWelcomeProps {
  isPreloading: boolean;
  isStarted: boolean;
  isFinishGame: boolean;

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
}) => {
  const isMobile = window.innerWidth <= 768;

  const backgroundImage = isMobile
    ? "/goya/MOBILE/GOYA_HOME_MOBILE.png"
    : "/goya/DESKTOP/FONDO_GOYA_HOME.png";

  // Oculta el overlay una vez que el juego ha arrancado y no está finalizado
  if (isStarted && !isFinishGame) return null;

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
        fontSize: isMobile ? "18px" : "24px",
        padding: isMobile ? "16px" : "32px",
      }}
    >
      {isPreloading ? (
        <p style={{ fontSize: isMobile ? "16px" : "22px" }}>Cargando modelo...</p>
      ) : isFinishGame ? (
        <>
          <h2 style={{ fontSize: isMobile ? "22px" : "32px", margin: isMobile ? "12px 0" : "24px 0" }}>
            ¡El juego ha finalizado!
          </h2>
          <img
            style={{
              width: isMobile ? "180px" : "250px",
              height: isMobile ? "56px" : "80px",
              cursor: "pointer",
              marginTop: isMobile ? "10px" : "20px",
            }}
            onClick={restartGame}
            className="restart-button"
            src="/goya/BOTON_RESTART.png"
            alt="Reiniciar juego"
          />
        </>
      ) : (
        <>
          <h2 style={{ fontSize: isMobile ? "22px" : "32px", margin: isMobile ? "12px 0" : "24px 0" }}>
            Ingresa tu nombre
          </h2>
          <input
            type="text"
            placeholder="Tu nombre"
            value={nicknameLocal}
            onChange={(e) => setNicknameLocal(e.target.value)}
            style={{
              fontSize: isMobile ? "16px" : "18px",
              padding: isMobile ? "8px" : "10px",
              borderRadius: "8px",
              border: "none",
              textAlign: "center",
              marginBottom: isMobile ? "10px" : "12px",
              width: isMobile ? "80vw" : "320px",
              maxWidth: "90vw",
            }}
          />
          <p
            style={{
              margin: isMobile ? "8px 0" : "12px 0",
              fontSize: isMobile ? "13px" : "15px",
              width: isMobile ? "90vw" : "50%",
              maxWidth: "500px",
              textAlign: "center",
              lineHeight: 1.4,
              background: "rgba(0,0,0,0.7)", // caja negra semitransparente
              borderRadius: "12px",
              padding: isMobile ? "10px 8px" : "16px 18px",
              boxShadow: "0 2px 8px #0006",
              color: "#fff",
              fontWeight: 400,
              marginBottom: isMobile ? "10px" : "18px",
            }}
          >
            <strong>Instrucciones:</strong> Usa tus manos frente a la cámara para
            explotar empaques en pantalla. Ganas puntos por cada empaque que toques.
          </p>
          <img
            style={{
              width: isMobile ? "180px" : "250px",
              height: isMobile ? "56px" : "80px",
              cursor: "pointer",
              marginTop: isMobile ? "10px" : "20px",
            }}
            onClick={startGame}
            className="restart-button"
            src="/goya/DESKTOP/BOTON.png"
            alt="Comenzar juego"
          />
        </>
      )}
    </div>
  );
};
