import React from "react";

interface OverlayWelcomeProps {
  isPreloading: boolean;
  isStarted: boolean;
  roomId: string;
  startGame: () => void;
  isFinishGame: boolean;
  restartGame: () => Promise<void>;
}

export const OverlayWelcome: React.FC<OverlayWelcomeProps> = ({
  isPreloading,
  isStarted,
  roomId,
  startGame,
  isFinishGame,
  restartGame,
}) => {
  /**
   * Si el juego ya comenzó y NO se ha marcado como finalizado,
   * no mostramos nada (retornamos null).
   */
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
        backgroundColor: "rgba(0,0,0,0.8)",
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
         * Si el juego ha finalizado, mostramos un mensaje y un botón para reiniciar.
         */
        <>
          <h2>¡El juego ha finalizado!</h2>
          <button
            style={{ fontSize: "18px", padding: "10px 20px", cursor: "pointer" }}
            onClick={restartGame}
          >
            Reiniciar
          </button>
        </>
      ) : (
        /**
         * De lo contrario, mostramos la vista de bienvenida normal
         */
        <>
          <h2>Bienvenido a la sala {roomId}</h2>
          <button
            style={{ fontSize: "18px", padding: "10px 20px", cursor: "pointer" }}
            onClick={startGame}
          >
            Empezar
          </button>
        </>
      )}
    </div>
  );
};
