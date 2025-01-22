import React from "react";
import { Scoreboard } from "./Scoreboard";

interface Player {
  name: string;
  score: number;
}

interface OverlayWelcomeProps {
  isPreloading: boolean;
  isStarted: boolean;
  roomId: string;
  startGame: (nickname: string) => void; // => le pasaremos nickname
  isFinishGame: boolean;
  restartGame: () => Promise<void>;
  players: { [key: string]: Player };
  setNicknameLocal: React.Dispatch<React.SetStateAction<string>>;
}

export const OverlayWelcome: React.FC<OverlayWelcomeProps> = ({
  isPreloading,
  isStarted,
  startGame,
  isFinishGame,
  restartGame,
  players,
  setNicknameLocal,
}) => {
  // Detecta si es móvil o escritorio
  const isMobile = window.innerWidth <= 768;

  // Selecciona la imagen de fondo
  const backgroundImage = isMobile
    ? "/MOBILE/BALLOON_HOME_MOBILE.png"
    : "/DESKTOP/FONDO_DSKTOP.png";

  // Si el juego está iniciado y no está finalizado, no mostramos este overlay
  if (isStarted && !isFinishGame) {
    return null;
  }

  // function onStartClicked() {
  //   // Llamamos a la prop "startGame" pasándole el nickname
  //   startGame(nickname.trim());
  // }

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
        // JUEGO FINALIZADO: mostramos scoreboard y botón de reiniciar
        <>
          <h2>¡El juego ha finalizado!</h2>
          <Scoreboard players={players} />
          <button
            style={{
              fontSize: "18px",
              padding: "10px 20px",
              cursor: "pointer",
              marginTop: "20px",
            }}
            onClick={restartGame}
          >
            Reiniciar
          </button>
        </>
      ) : (
        // OVERLAY DE BIENVENIDA (antes de iniciar juego)
        <>
          {/* Campo para nickname */}
          <input
            type="text"
            placeholder="Ingresa tu nickname"
            onChange={(e) => setNicknameLocal(e.target.value)}
            style={{
              fontSize: "18px",
              padding: "10px",
              marginTop: "20px",
              marginBottom: "20px",
              borderRadius: "8px",
              border: "none",
              textAlign: "center",
            }}
          />
          <h3
            style={{
              textAlign: "center",
              maxWidth: "500px",
              margin: "0 auto",
            }}
          >
            Un demo multijugador donde cada toque cuenta. Trabaja en equipo o
            compite para estallar los globos y ganar puntos.
          </h3>
          {/* Botón para iniciar (si decides que cualquiera puede iniciar) */}
          <img
            src="/DESKTOP/BOTON_COMENZAR.png"
            alt="Botón comenzar"
            style={{
              position: "absolute",
              bottom: "4%",
              width: "200px",
              height: "auto",
              cursor: "pointer",
            }}
            onClick={() => startGame("")}
          />
        </>
      )}
    </div>
  );
};
