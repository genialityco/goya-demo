/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { initPoseLandmarker } from "./PoseLandmarker";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
} from "firebase/firestore";
import { db } from "../firebase";
// import { initCameraFullscreen } from "./CameraFullscreen";
import { initCamera } from "./Camera";

const BallInteractionGame = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  // const videoRef = useRef<HTMLVideoElement | null>(null);
  const ballsRef = useRef<any[]>([]); // Pelotas locales
  const landmarksRef = useRef<any[]>([]); // Landmarks locales
  const pendingUpdatesRef = useRef<number[]>([]); // Pelotas a sincronizar
  const [, setBalls] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [, setNickname] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameReady, setGameReady] = useState(false); // Verifica si hay suficientes jugadores
  const gameId = "multiplayer-room";

  const HAND_LANDMARKS_INDICES = [15, 16, 17, 18, 19, 20, 21, 22];

  useEffect(() => {
    const setupGame = async () => {
      const canvas = canvasRef.current!;
    
      // Usa la nueva función para inicializar la cámara
      const video = await initCamera();
    
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    
      const ctx = canvas.getContext("2d")!;
      ctxRef.current = ctx;
    
      await setupFirestore(canvas.width, canvas.height);
    
      const cleanupPoseLandmarker = await initPoseLandmarker(
        video,
        (landmarks) => handlePoseResults(landmarks, canvas)
      );
    
      const draw = () => {
        drawFrame(ctx, video, canvas, landmarksRef.current);
        requestAnimationFrame(draw);
      };
      draw();
    
      return cleanupPoseLandmarker;
    };

    const cleanup = setupGame().catch(console.error);

    return () => {
      cleanup.then((cleanupPose) => cleanupPose?.());
    };
  }, []);

  const generateBalls = (count: number, width: number, height: number) => {
    const padding = 50; 
    return Array.from({ length: count }).map((_, i) => ({
      id: i, 
      x: Math.random() * (width - 2 * padding) + padding,
      y: Math.random() * (height - 2 * padding) + padding,
      radius: 25, 
      active: true, 
    }));
  };

  const setupFirestore = async (width: number, height: number) => {
    const gameRef = doc(db, "games", gameId);

    const gameSnapshot = await getDoc(gameRef);
    if (!gameSnapshot.exists()) {
      const initialBalls = generateBalls(10, width, height);
      ballsRef.current = initialBalls;
      await setDoc(gameRef, { balls: initialBalls, players: [] });
      setBalls(initialBalls);
    } else {
      onSnapshot(gameRef, (snapshot) => {
        const data = snapshot.data();
        if (data) {
          console.log(data);
          ballsRef.current = data.balls;
          setBalls(data.balls);
          setPlayers(data.players || []);
          setGameReady((data.players || []).length >= 2);
        }
      });
    }
  };

  const joinGame = async () => {
    const nicknameInput =
      prompt("Enter your nickname") ||
      `Player-${Math.floor(Math.random() * 1000)}`;
    setNickname(nicknameInput);

    const playerRef = collection(db, "games", gameId, "players");
    const playerDoc = await addDoc(playerRef, {
      nickname: nicknameInput,
      score: 0,
    });
    setPlayerId(playerDoc.id);
  };

  const handlePoseResults = (landmarks: any[], canvas: HTMLCanvasElement) => {
    if (!gameReady) return; 

    const handLandmarks = landmarks.filter((_, index) =>
      HAND_LANDMARKS_INDICES.includes(index)
    );

    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  };

  const checkInteractions = (landmarks: any[], canvas: HTMLCanvasElement) => {
    landmarks.forEach((landmark) => {
      ballsRef.current.forEach((ball) => {
        if (!ball.active) return;

        const dx = (1 - landmark.x) * canvas.width - ball.x;
        const dy = landmark.y * canvas.height - ball.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < ball.radius * ball.radius) {
          ball.active = false;
          pendingUpdatesRef.current.push(ball.id);

          // Actualizar puntuación del jugador
          const playerRef = doc(db, "games", gameId, "players", playerId!);
          updateDoc(playerRef, {
            score: (players.find((p) => p.id === playerId)?.score || 0) + 1,
          });
        }
      });
    });

    if (pendingUpdatesRef.current.length >= 5) {
      syncBallUpdates();
    }
  };

  const syncBallUpdates = async () => {
    const gameRef = doc(db, "games", gameId);

    const updatedBalls = ballsRef.current.map((ball) =>
      pendingUpdatesRef.current.includes(ball.id)
        ? { ...ball, active: false }
        : ball
    );

    ballsRef.current = updatedBalls;
    setBalls(updatedBalls);

    await updateDoc(gameRef, { balls: updatedBalls });
    pendingUpdatesRef.current = [];
  };

  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) => {
    landmarks.forEach((landmark) => {
      const x = (1 - landmark.x) * canvas.width;
      const y = landmark.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  };

  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (landmarks) drawLandmarks(ctx, canvas, landmarks);
    drawBalls(ctx);

    // Mostrar nombres de jugadores
    players.forEach((player, index) => {
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.fillText(`${player.nickname}: ${player.score}`, 10, 30 + index * 20);
    });
  };

  const drawBalls = (ctx: CanvasRenderingContext2D) => {
    ballsRef.current.forEach((ball) => {
      if (!ball.active) return;

      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";
      ctx.fill();
    });
  };

  useEffect(() => {
    joinGame();
  }, []);

  return (
    <>
      {!gameReady && <div>Waiting for more players...</div>}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
};

export default BallInteractionGame;
