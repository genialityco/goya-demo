/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase"; // Ajusta ruta
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

/** La sala que usaremos en Firebase */
const ROOM_ID = "miSala";

export function useMultiplayerGame() {
  // Estados
  const [isPreloading, setIsPreloading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});

  const latestBallsRef = useRef<{ [key: string]: any }>({});
  const [localPlayerId] = useState(() => generatePlayerId());

  // Referencias para dibujar
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Landmarks de la mano
  const landmarksRef = useRef<any[]>([]);

  // Cleanup del modelo
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  // Para no reiniciar la cámara varias veces
  const [cameraReady, setCameraReady] = useState(false);

  // Sincronizar la ref con el estado
  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  // ------------------------------------------------------------------
  // useEffect principal:
  // 1) Verificar conexión
  // 2) Suscribirse a la sala
  // 3) Precargar modelo
  // ------------------------------------------------------------------
  useEffect(() => {
    // 1) Conexión
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      if (snap.val()) {
        // Registrar jugador
        await registerPlayerInRoom();
      }
    });

    // 2) Suscribirse a la sala
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val();
      if (!roomData) return;

      setIsStarted(roomData.isStarted || false);
      setPlayers(roomData.players || {});
      setBalls(roomData.balls || {});
    });

    // 3) Precarga del modelo
    preloadModel();

    // Cleanup
    return () => {
      off(connectedRef);
      off(roomRef);
      poseLandmarkerCleanupRef.current?.();
    };
  }, []);

  // Cuando isStarted=true y no estamos precargando => iniciar cámara local si no lo hicimos
  useEffect(() => {
    if (isStarted && !isPreloading && !cameraReady) {
      startLocalGame();
    }
  }, [isStarted, isPreloading, cameraReady]);

  // ------------------------------------------------------------------
  // Registrar jugador en la sala (sin generar pelotas aquí)
  // ------------------------------------------------------------------
  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);

    // Crear jugador en la DB
    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });

    // Eliminar si se desconecta
    onDisconnect(playerRef).remove();
  }

  // ------------------------------------------------------------------
  // Precarga del modelo con video dummy
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // startGame => solo el usuario que da clic genera las pelotas (si no existen) y setea isStarted=true
  // ------------------------------------------------------------------
  async function startGame() {
    if (isPreloading || isStarted) return;

    try {
      const roomRef = ref(db, `rooms/${ROOM_ID}`);
      const snapshot = await get(roomRef);
      const data = snapshot.val();

      // 1) Si no existen pelotas, las creamos
      let ballsObject = data?.balls;
      if (!ballsObject) {
        const newBalls = generateBalls(10);
        ballsObject = {};
        newBalls.forEach((b) => {
          ballsObject[b.id] = b;
        });
      }

      // 2) Actualizar la DB => isStarted=true y (pelotas si no había)
      await update(roomRef, {
        isStarted: true,
        balls: ballsObject,
      });
    } catch (error) {
      console.error("Error en startGame:", error);
    }
  }

  // ------------------------------------------------------------------
  // startLocalGame => inicia la cámara y bucle de render en este cliente
  // ------------------------------------------------------------------
  async function startLocalGame() {
    try {
      setCameraReady(true);

      // Iniciar cámara
      const video = await initCamera();
      videoRef.current = video;

      // Canvas
      const canvas = canvasRef.current!;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d")!;
      ctxRef.current = ctx;

      // Limpiar modelo dummy
      poseLandmarkerCleanupRef.current?.();

      // Iniciar landmarker
      poseLandmarkerCleanupRef.current = await initPoseLandmarker(video, (
        allLandmarks
      ) => handlePoseResults(allLandmarks, canvas));

      // Bucle de dibujado
      const draw = () => {
        if (!ctxRef.current || !videoRef.current) return;
        drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
        requestAnimationFrame(draw);
      };
      draw();
    } catch (err) {
      console.error("Error en startLocalGame:", err);
    }
  }

  // ------------------------------------------------------------------
  // restartGame => regenerar pelotas, scores=0 y isStarted=false
  // ------------------------------------------------------------------
  async function restartGame() {
    try {
      // Poner scores a 0
      const playersSnap = await get(ref(db, `rooms/${ROOM_ID}/players`));
      const playersData = playersSnap.val() || {};
      Object.keys(playersData).forEach((pid) => {
        playersData[pid].score = 0;
      });

      // Generar pelotas nuevas
      const newBalls = generateBalls(10);
      const newBallsObj: Record<string, any> = {};
      newBalls.forEach((b) => {
        newBallsObj[b.id] = b;
      });

      // Actualizar DB => isStarted=false, pelotas nuevas
      await update(ref(db, `rooms/${ROOM_ID}`), {
        isStarted: false,
        players: playersData,
        balls: newBallsObj,
      });

      // (Opcional) Parar cámara local
      poseLandmarkerCleanupRef.current?.();
      setCameraReady(false);
    } catch (error) {
      console.error("Error en restartGame:", error);
    }
  }

  // ------------------------------------------------------------------
  // Manejar resultados de pose => filtrar landmarks
  // ------------------------------------------------------------------
  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );
    landmarksRef.current = handLandmarks;

    checkInteractions(handLandmarks, canvas);
  }

  // ------------------------------------------------------------------
  // checkInteractions => detectar colisiones y actualizarlas en DB
  // ------------------------------------------------------------------
  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...balls };

    handLandmarks.forEach((lm) => {
      // Si dibujas espejo, x = (1 - lm.x)
      const handX = (1 - lm.x) * canvas.width;
      const handY = lm.y * canvas.height;

      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        const ballX = ball.x * canvas.width;
        const ballY = ball.y * canvas.height;
        const radius = ball.radius * canvas.width;

        const dx = handX - ballX;
        const dy = handY - ballY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          // Desactivamos la pelota localmente
          ball.active = false;

          // Actualizar en Firebase => la pelota se desactiva para todos
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), {
            active: false,
          });

          // Aumentar score de este jugador
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 1
          ).catch((err) => console.error("Error incrementando score:", err));
        }
      });
    });

    setBalls(currentBalls);
  }

  // ------------------------------------------------------------------
  // Dibujar cada frame
  // ------------------------------------------------------------------
  function drawFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibuja video en espejo
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Landmarks
    if (landmarks?.length) {
      drawLandmarks(ctx, canvas, landmarks);
    }

    // Pelotas
    drawBalls(ctx, latestBallsRef.current);
  }

  // ------------------------------------------------------------------
  // Dibuja landmarks
  // ------------------------------------------------------------------
  function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    landmarks.forEach((lm) => {
      const x = (1 - lm.x) * canvas.width;
      const y = lm.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  }

  // ------------------------------------------------------------------
  // Dibuja pelotas
  // ------------------------------------------------------------------
  function drawBalls(ctx: CanvasRenderingContext2D, ballsObj: any) {
    Object.values(ballsObj).forEach((ball: any) => {
      if (!ball.active) return;

      const x = ball.x * ctx.canvas.width;
      const y = ball.y * ctx.canvas.height;
      const radius = ball.radius * ctx.canvas.width;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";
      ctx.fill();
    });
  }

  // ------------------------------------------------------------------
  // Genera pelotas => en columna vertical (x=0.5) para ejemplo
  // ------------------------------------------------------------------
  function generateBalls(count: number) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        id: i,
        x: 0.5,
        y: (i + 1) / (count + 1),
        radius: 0.04,
        active: true,
      });
    }
    return arr;
  }

  return {
    // Estados para la UI
    isPreloading,
    isStarted,
    players,
    balls,

    // Ref para <canvas>
    canvasRef,

    // Métodos para botones
    startGame,
    restartGame,
  };
}

/** Genera un ID aleatorio */
function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
