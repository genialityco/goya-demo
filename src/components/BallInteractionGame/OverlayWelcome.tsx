import React from "react";
import { Scoreboard } from "./Scoreboard"; // <-- importar tu componente de puntuación

interface Player {
  name: string;
  score: number;
}
interface OverlayWelcomeProps {
  isPreloading: boolean;
  isStarted: boolean;
  roomId: string;
  startGame: () => void;
  isFinishGame: boolean;
  restartGame: () => Promise<void>;
  players: { [key: string]: Player }; // <-- nueva prop para pasar jugadores
}

export const OverlayWelcome: React.FC<OverlayWelcomeProps> = ({
  isPreloading,
  isStarted,
  startGame,
  isFinishGame,
  restartGame,
  players, // <-- recibimos los jugadores
}) => {
  // Detecta si es móvil o escritorio utilizando el ancho de la ventana.
  const isMobile = window.innerWidth <= 768;

  // Selecciona la imagen de fondo según el dispositivo.
  const backgroundImage = isMobile
    ? "/MOBILE/BALLOON_HOME_MOBILE.png"
    : "/DESKTOP/FONDO_DSKTOP.png";

  // Si el juego ya comenzó y no se ha marcado como finalizado, no mostramos nada (retornamos null).
  if (isStarted && !isFinishGame) {
    return null;
  }

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
        /**
         * Si el juego ha finalizado, mostramos un mensaje, la tabla
         * de puntuaciones y un botón para reiniciar.
         */
        <>
          <h2>¡El juego ha finalizado!</h2>
          {/* Aquí renderizas la tabla de puntuaciones */}
          <Scoreboard players={players} overlay />

          <img
            src="/DESKTOP/BOTOM-RESTART.png"
            alt="Botón restart"
            style={{
              position: "absolute",
              bottom: "4%",
              width: "200px",
              height: "auto",
              cursor: "pointer",
            }}
            className="restart-button"
            onClick={restartGame}
          />
        </>
      ) : (
        /**
         * De lo contrario, mostramos la vista de bienvenida normal
         */
        <>
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
            className="restart-button"
            onClick={startGame}
          />
        </>
      )}
    </div>
  );
};
