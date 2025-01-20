/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase"; // Ajusta la ruta a tu archivo de config
import {
  ref,
  onValue,
  update,
  set,
  off,
  runTransaction,
  get,
  onDisconnect,
} from "firebase/database";
import { initPoseLandmarker } from "../../services/PoseLandmarker";
import { initCamera } from "../../services/Camera";

const ROOM_ID = "miSala";

export function useMultiplayerGame() {
  const [isPreloading, setIsPreloading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});
  const latestBallsRef = useRef<{ [key: string]: any }>({});
  const [localPlayerId] = useState(() => generatePlayerId());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  useEffect(() => {
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      const isOnline = snap.val();
      if (isOnline) {
        await registerPlayerInRoom();
      }
    });

    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val();
      if (!roomData) return;
      console.log("Cambio");
      setIsStarted(roomData.isStarted || false);
      setPlayers(roomData.players || {});
      setBalls(roomData.balls || {});
    });

    preloadModel();

    return () => {
      off(connectedRef);
      off(roomRef);
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
    };
  }, []);

  useEffect(() => {
    const ballsRef = ref(db, `rooms/${ROOM_ID}/balls`);
    onValue(ballsRef, (snapshot) => {
      const ballsData = snapshot.val() || {};
      setBalls(ballsData);

      const allBallsInactive = Object.values(ballsData).every(
        (ball: any) => !ball.active
      );
      if (allBallsInactive && Object.keys(ballsData).length > 0) {
        update(ref(db, `rooms/${ROOM_ID}`), { isStarted: false });
      }
    });
  }, []);

  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);
  
    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });
  
    onDisconnect(playerRef).remove();
  
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (!data?.balls) {
        const initialBalls = generateBalls(10);
        const ballsObject: any = {};
        initialBalls.forEach((b) => {
          ballsObject[b.id] = b;
        });
        update(ref(db, `rooms/${ROOM_ID}`), {
          balls: ballsObject,
          isStarted: false,
        });
      }
    }, { onlyOnce: true });
  }
  

  async function preloadModel() {
    try {
      const dummyVideo = document.createElement("video");
      poseLandmarkerCleanupRef.current = await initPoseLandmarker(
        dummyVideo,
        () => {}
      );
      setIsPreloading(false);
    } catch (error) {
      console.error("Error precargando el modelo:", error);
      setIsPreloading(false);
    }
  }

  async function startGame() {
    if (isPreloading || isStarted) return;

    update(ref(db, `rooms/${ROOM_ID}`), { isStarted: true });

    const video = await initCamera();
    videoRef.current = video;

    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d")!;
    ctxRef.current = ctx;

    if (poseLandmarkerCleanupRef.current) {
      poseLandmarkerCleanupRef.current();
    }

    poseLandmarkerCleanupRef.current = await initPoseLandmarker(
      video,
      (allLandmarks) => handlePoseResults(allLandmarks, canvas)
    );

    const draw = () => {
      if (!ctxRef.current || !videoRef.current) return;
      drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
      requestAnimationFrame(draw);
    };
    draw();
  }

  async function restartGame() {
    try {
      const playersSnap = await get(ref(db, `rooms/${ROOM_ID}/players`));
      const playersData = playersSnap.val() || {};

      Object.keys(playersData).forEach((playerId) => {
        playersData[playerId].score = 0;
      });

      const newBalls = generateBalls(5);
      const newBallsObj: Record<string, any> = {};
      newBalls.forEach((b) => {
        newBallsObj[b.id] = b;
      });

      await update(ref(db, `rooms/${ROOM_ID}`), {
        isStarted: false,
        players: playersData,
        balls: newBallsObj,
      });
    } catch (error) {
      console.error("Error reiniciando la partida:", error);
    }
  }

  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );
    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...balls };
  
    handLandmarks.forEach((landmark) => {
      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;
  
        const ballX = ball.relativeX * canvas.width;
        const ballY = ball.relativeY * canvas.height;
  
        const dx = (1 - landmark.x) * canvas.width - ballX;
        const dy = landmark.y * canvas.height - ballY;
        const distanceSquared = dx * dx + dy * dy;
  
        if (distanceSquared < ball.radius * ball.radius) {
          ball.active = false;
          setBalls(currentBalls);
  
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), { active: false });
  
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 1
          ).catch((error) => {
            console.error("Error incrementando score:", error);
          });
        }
      });
    });
  }
  

  function drawFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    if (landmarks) drawLandmarks(ctx, canvas, landmarks);
    drawBalls(ctx, latestBallsRef.current, canvas);
  }

  function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    landmarks.forEach((landmark) => {
      const x = (1 - landmark.x) * canvas.width;
      const y = landmark.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  }

  function drawBalls(ctx: CanvasRenderingContext2D, ballsObj: any, canvas: HTMLCanvasElement) {
    Object.values(ballsObj).forEach((ball: any) => {
      if (!ball.active) return;
      const x = ball.relativeX * canvas.width;
      const y = ball.relativeY * canvas.height;
  
      ctx.beginPath();
      ctx.arc(x, y, ball.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";
      ctx.fill();
    });
  }
  

  function generateBalls(count: number) {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      relativeX: Math.random(), // Valor entre 0 y 1
      relativeY: Math.random(), // Valor entre 0 y 1
      radius: 25, // Radio fijo en píxeles
      active: true,
    }));
  }

  return {
    isPreloading,
    isStarted,
    players,
    balls,
    canvasRef,
    startGame,
    restartGame,
  };
}

function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
