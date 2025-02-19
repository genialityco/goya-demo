import React from "react";
import { Scoreboard } from "./Scoreboard";
import { WaitingRoom } from "./WaitingRoom";

interface Player {
  name: string;
  score: number;
}

interface OverlayWelcomeProps {
  isPreloading: boolean;
  isStarted: boolean;
  isFinishGame: boolean;
  userJoined: boolean;
  isOwner: boolean;
  players: { [key: string]: Player };

  joinRoom: (nickname: string) => void;
  startGame: () => Promise<void>;
  restartGame: () => Promise<void>;

  nicknameLocal: string;
  setNicknameLocal: React.Dispatch<React.SetStateAction<string>>;

  userStartLocalGame: boolean;

  // <-- Asegúrate de agregar la función becomeOwner aquí:
  becomeOwner: () => Promise<void>;
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
  becomeOwner, // <-- Aquí la recibimos por props
}) => {
  const isMobile = window.innerWidth <= 768;

  const backgroundImage = isMobile
    ? "/MOBILE/BALLOON_HOME_MOBILE.png"
    : "/DESKTOP/FONDO_DSKTOP.png";

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
        <>
          <h2>¡El juego ha finalizado!</h2>
          <Scoreboard players={players} />
          {isOwner ? (
            <img
              style={{ width: "250px", height: "80px" }}
              onClick={restartGame}
              className="restart-button"
              src="/DESKTOP/BOTOM-RESTART.png"
            />
          ) : (
            <p>Esperando a que el dueño reinicie...</p>
          )}
        </>
      ) : !userJoined ? (
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
              borderRadius: "8px",
              border: "none",
              textAlign: "center",
            }}
          />
          <p
            style={{
              margin: "5px 0",
              fontSize: "15px",
              width: isMobile ? "80%" : "50%",
            }}
          >
            <strong>Instrucciones:</strong> Ingresa tu nombre y haz clic en
            "Comenzar" para unirte al juego.
          </p>
          <img
            style={{ width: "250px", height: "80px" }}
            onClick={() => joinRoom(nicknameLocal)}
            className="restart-button"
            src="/DESKTOP/BOTON_COMENZAR.png"
          />
        </>
      ) : !isStarted ? (
        isOwner ? (
          <>
            <h2>¡Bienvenido, {nicknameLocal}!</h2>
            <p>Eres el dueño de la sala</p>
            <p
              style={{
                margin: "5px 0",
                fontSize: "18px",
                width: isMobile ? "80%" : "50%",
              }}
            >
              <strong>Instrucciones:</strong> Comienza el juego cuando todos los
              jugadores hayan ingresado y estén listos.
            </p>
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
          <>
            <h2>¡Bienvenido, {nicknameLocal}!</h2>
            <p
              style={{
                fontSize: "20px",
              }}
            >
              <strong>Esperando a que el dueño inicie el juego...</strong>
            </p>
            <p
              style={{
                margin: "10px 0",
                fontSize: "12px",
                width: isMobile ? "80%" : "50%",
              }}
            >
              Gen.Ballon es un juego demo en el que, trabajando en equipo,
              capturas globos usando tus manos para interactuar con la
              experiencia. Todas las personas que desees pueden conectarse al
              juego, y juntos podrán alcanzar el objetivo. ¿Cómo funciona? El
              juego utiliza la cámara de tu dispositivo para detectar tus manos
              y rastrear sus movimientos, integrándolos en la experiencia. Así,
              puedes disfrutar sin complicaciones de un mundo de realidad
              aumentada lleno de emociones
            </p>

            {/* Aquí agregamos el botón para solicitar ser dueño */}
            <button
              onClick={becomeOwner}
              style={{
                fontSize: "16px",
                padding: "8px 12px",
                marginTop: "16px",
                cursor: "pointer",
                borderRadius: "8px",
              }}
            >
              Solicitar ser dueño
            </button>
          </>
        )
      ) : null}
    </div>
  );
};
