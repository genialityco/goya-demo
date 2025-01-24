import React from "react";
import { Scoreboard } from "./Scoreboard";
import { WaitingRoom } from "./WaitingRoom";

interface Player {
  name: string;
  score: number;
}

interface OverlayWelcomeProps {
  // De tu custom hook
  isPreloading: boolean;
  isStarted: boolean;
  isFinishGame: boolean;
  userJoined: boolean;
  isOwner: boolean;

  players: { [key: string]: Player };

  // Métodos
  joinRoom: (nickname: string) => void;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;

  // Para el input de nickname
  nicknameLocal: string;
  setNicknameLocal: React.Dispatch<React.SetStateAction<string>>;

  // Saber si local ya inició cámara, etc.
  userStartLocalGame: boolean;
}

export const OverlayWelcome: React.FC<OverlayWelcomeProps> = ({
  isPreloading,
  isStarted,
  isFinishGame,
  userJoined,
  isOwner,
  players,
  joinRoom,
  startGame,
  restartGame,
  nicknameLocal,
  setNicknameLocal,
  userStartLocalGame,
}) => {
  // Detecta si es móvil o escritorio
  const isMobile = window.innerWidth <= 768;

  // Selecciona la imagen de fondo
  const backgroundImage = isMobile
    ? "/MOBILE/BALLOON_HOME_MOBILE.png"
    : "/DESKTOP/FONDO_DSKTOP.png";

  // Lógica de visibilidad del overlay:
  // 1) Si el juego está en curso y no ha finalizado y el usuario ya “empezó local”, ocultar overlay
  if (isStarted && !isFinishGame && userStartLocalGame) {
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
        // Si el juego ha finalizado
        <>
          <h2>¡El juego ha finalizado!</h2>
          <Scoreboard players={players} />
          {isOwner ? (
            // <button
            //   style={{
            //     fontSize: "18px",
            //     padding: "10px 20px",
            //     marginTop: "20px",
            //   }}
            //   onClick={restartGame}
            // >
            //   Reiniciar (sólo dueño)
            // </button>
            <img
              style={{ width: "250px" }}
              onClick={restartGame}
              className="restart-button"
              src="/DESKTOP/BOTOM-RESTART.png"
            />
          ) : (
            <p>Esperando a que el dueño reinicie...</p>
          )}
        </>
      ) : !userJoined ? (
        // Aún NO nos unimos a la sala: pedir nickname
        <>
          <h2>Ingresa a la sala</h2>
          <input
            type="text"
            placeholder="Ingresa tu nickname"
            value={nicknameLocal}
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
          {/* <button
            style={{
              fontSize: "18px",
              padding: "10px 20px",
              cursor: "pointer",
            }}
            onClick={() => joinRoom(nicknameLocal)}
          >
            Ingresar
          </button> */}
          <img
            style={{ width: "250px" }}
            onClick={() => joinRoom(nicknameLocal)}
            className="restart-button"
            src="/DESKTOP/BOTON_COMENZAR.png"
          />
        </>
      ) : // Aquí userJoined = true, pero el juego no ha iniciado
      !isStarted ? (
        isOwner ? (
          // Eres el dueño y el juego NO está iniciado
          <>
            <h2>¡Bienvenido, {nicknameLocal}!</h2>
            <p>Eres el dueño de la sala</p>
            {/* AQUÍ mostras lista de quienes están conectados */}
            <WaitingRoom
              players={players}
              isOwner={isOwner}
              nicknameLocal={nicknameLocal}
              isMobile={isMobile}
              startGame={startGame}
            />

            <img
              style={{ width: "250px" }}
              onClick={startGame}
              className="restart-button"
              src="/DESKTOP/BOTON_COMENZAR.png"
            />
          </>
        ) : (
          // No eres el dueño y el juego NO está iniciado
          <>
            <h2>¡Bienvenido, {nicknameLocal}!</h2>
            <p>Esperando a que el dueño inicie el juego...</p>
          </>
        )
      ) : null}
    </div>
  );
};
