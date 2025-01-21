/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase";
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
import { initCamera } from "../../services/Camera";
import { loadPoseModel } from "../../services/loadPoseModel";
import { startPoseDetection } from "../../services/startPoseDetection";

const ROOM_ID = "miSala";

export function useMultiplayerGame() {
  const [isPreloading, setIsPreloading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinishGame, setIsFinishGame] = useState(false);
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});
  const latestBallsRef = useRef<{ [key: string]: any }>({});
  const [localPlayerId] = useState(() => generatePlayerId());

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);
  const balloonImageRef = useRef<HTMLImageElement | null>(null);

  // Estado para manejar la explosión en el DOM
  // (x, y) coordenadas sobre el canvas donde explotó
  // visible: si debemos mostrar el GIF o no
  const [explosion, setExplosion] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);

  useEffect(() => {
    // Cargar la imagen del globo
    const img = new Image();
    img.src = "/images/BOMBA.png"; // Ruta a tu imagen
    balloonImageRef.current = img;
  }, []);

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
        setIsFinishGame(true);
      }
    });
  }, []);

  useEffect(() => {
    if (isStarted) {
      startLocalGame();
    }
  }, [isStarted]);

  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);

    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });

    onDisconnect(playerRef).remove();

    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(
      roomRef,
      (snapshot) => {
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
      },
      { onlyOnce: true }
    );
  }

  async function preloadModel() {
    // Si ya se cargó, no lo recarga
    try {
      await loadPoseModel(); // Se descarga y almacena en sharedPoseLandmarker
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

    const poseLandmarker = await loadPoseModel(); 

    poseLandmarkerCleanupRef.current = startPoseDetection(
      video,
      poseLandmarker,
      (allLandmarks) => handlePoseResults(allLandmarks, canvas)
    );

    function draw() {
      if (!ctxRef.current || !videoRef.current) return;
      drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
      requestAnimationFrame(draw);
    }
    draw();
  }

  async function startLocalGame() {
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

    const poseLandmarker = await loadPoseModel();

    poseLandmarkerCleanupRef.current = startPoseDetection(
      video,
      poseLandmarker,
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
      setIsFinishGame(false);
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

  /**
   * Mostrar explosión en la interfaz (fuera del canvas)
   */
  function showExplosion(x: number, y: number) {
    setExplosion({ x, y, visible: true });
    // Ocultarla tras 1 segundo (ajusta el tiempo a tu gusto)
    setTimeout(() => {
      setExplosion((prev) => (prev ? { ...prev, visible: false } : null));
    }, 1000);
  }

  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...balls };

    handLandmarks.forEach((landmark) => {
      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        // Coordenadas del globo en el canvas
        const ballX = ball.relativeX * canvas.width;
        const ballY = ball.relativeY * canvas.height;

        // Tamaño del globo (4 veces el radio => double radius^2)
        const balloonRadius = ball.radius * 2;

        // Distancia entre la mano y el centro del globo
        const dx = (1 - landmark.x) * canvas.width - ballX;
        const dy = landmark.y * canvas.height - ballY;
        const distanceSquared = dx * dx + dy * dy;

        // Verificar colisión
        if (distanceSquared < balloonRadius * balloonRadius) {
          ball.active = false;
          setBalls(currentBalls);

          // Actualizar en Firebase
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), {
            active: false,
          });

          // Sumar puntuación
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 1
          ).catch((error) => {
            console.error("Error incrementando score:", error);
          });

          // Mostrar explosión en esa posición (x,y)
          showExplosion(ballX, ballY);
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

  function drawBalls(
    ctx: CanvasRenderingContext2D,
    ballsObj: any,
    canvas: HTMLCanvasElement
  ) {
    const img = balloonImageRef.current;
    if (!img) return; // Asegúrate de que la imagen esté cargada

    Object.values(ballsObj).forEach((ball: any) => {
      if (!ball.active) return;

      const x = ball.relativeX * canvas.width;
      const y = ball.relativeY * canvas.height;

      // Dibuja la imagen del globo
      const radius = ball.radius;
      ctx.drawImage(
        img,
        x - radius, // Centrar la imagen en la posición de la bola
        y - radius,
        radius * 3, // Ancho de la imagen (doble del radio)
        radius * 3 // Alto de la imagen
      );
    });
  }

  function generateBalls(count: number) {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      relativeX: Math.random(), // Valor entre 0 y 1
      relativeY: Math.random(), // Valor entre 0 y 1
      radius: 30, // Radio fijo en píxeles
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
    explosion,
    isFinishGame,
  };
}

function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
