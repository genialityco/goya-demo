import React from "react";

interface Player {
  name: string;
  score: number;
}

interface ScoreboardProps {
  players: { [key: string]: Player };
  overlay?: boolean;
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ players, overlay }) => {
  // Ordenar jugadores por score descendente
  const sortedPlayers = Object.entries(players)
    .sort(([, pA], [, pB]) => pB.score - pA.score)
    .map(([, player], index) => ({
      ...player,
      rank: index + 1,
    }));

  // Según la prop overlay, decides el style:
  const containerStyle: React.CSSProperties = overlay
    ? {
        // Estilo normal o centrado, etc.
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "10px",
        fontSize: "18px",
        marginBottom: "20px",
      }
    : {
        position: "absolute",
        top: "5%",
        right: "5%",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        padding: "10px 20px",
        borderRadius: "10px",
        fontSize: "18px",
        zIndex: 5,
      };

  return (
    <div style={containerStyle}>
      <h3>Scoreboard</h3>
      {sortedPlayers.map((player, index) => (
        <div key={index}>
          <strong>#{player.rank}</strong> {player.name}: {player.score}
        </div>
      ))}
    </div>
  );
};
