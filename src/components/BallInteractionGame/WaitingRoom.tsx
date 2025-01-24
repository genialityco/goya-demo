import React from "react";

interface Player {
  name: string;
  score: number;
}

interface WaitingRoomProps {
  players: { [key: string]: Player };
  isOwner: boolean;
  nicknameLocal: string;
  isMobile: boolean;
  startGame: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  players,
  isMobile,
}) => {
  // Filtra o transforma la lista si deseas ordenarla.
  const playerList = Object.values(players);

  return (
    <div
      style={{
        position: "absolute",
        right: isMobile ? "" : "5px",
        bottom: isMobile ? "5px" : "5px",
        width: isMobile ? "80%" : "260px",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        borderRadius: "12px",

        color: "#fff",
        fontFamily: "sans-serif",
        // Ajusta la altura si quieres scroll interno
        maxHeight: isMobile ? "40%" : "50%",
        overflowY: "auto",
        boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
      }}
    >
      <hr style={{ border: "none", height: "1px", backgroundColor: "#ccc" }} />

      <h3 style={{ margin: "8px 0", fontSize: isMobile ? "14px" : "16px" }}>
        Jugadores conectados:
      </h3>

      {playerList.length === 0 ? (
        <p style={{ fontSize: "14px" }}>Nadie en la sala...</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {playerList.map((player, index) => (
            <li
              key={index}
              style={{
                marginBottom: "4px",
                fontSize: isMobile ? "14px" : "16px",
              }}
            >
              {player.name}
            </li>
          ))}
        </ul>
      )}
      <hr style={{ border: "none", height: "1px", backgroundColor: "#ccc" }} />
    </div>
  );
};
