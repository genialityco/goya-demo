import React from "react";

interface Player {
  name: string;
  score: number;
}

interface ScoreboardProps {
  players: { [key: string]: Player };
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ players }) => {
  // Ordenar jugadores por score descendente
  const sortedPlayers = Object.entries(players).sort(
    ([, pA], [, pB]) => pB.score - pA.score
  );

  return (
    <div
      style={{
        position: "absolute",
        top: "5%",
        right: "5%",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "10px",
        fontSize: "18px",
        zIndex: 5,
      }}
    >
      <h3>Scoreboard</h3>
      {sortedPlayers.map(([playerId, player]) => (
        <div key={playerId}>
          {player.name}: {player.score}
        </div>
      ))}
    </div>
  );
};
