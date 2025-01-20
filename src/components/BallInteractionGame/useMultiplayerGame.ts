/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase"; // Ajusta la ruta a tu config
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
  // -----------------------
  // Estados
  // -----------------------
  const [isPreloading, setIsPreloading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});

  // Guarda la última versión de `balls`
  const latestBallsRef = useRef<{ [key: string]: any }>({});

  // ID único de jugador
  const [localPlayerId] = useState(() => generatePlayerId());

  // Canvas, contexto, video, pose
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarksRef = useRef<any[]>([]);

  // Cleanup del modelo
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  // Para evitar iniciar la cámara varias veces
  const [cameraReady, setCameraReady] = useState(false);

  // Sincronizar la ref con el estado
  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  // -----------------------
  // useEffect principal:
  //   - Registrar jugador
  //   - Suscribirse a "rooms/miSala"
  //   - Precargar el modelo
  // -----------------------
  useEffect(() => {
    // 1) Verificamos si está en línea
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      if (snap.val()) {
        // Registramos el jugador en la sala
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

    // 3) Precargar el modelo de pose
    preloadModel();

    // Cleanup
    return () => {
      off(connectedRef);
      off(roomRef);
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
    };
  }, []);

  // -----------------------
  // Efecto: si isStarted=true y ya no está precargando, iniciamos cámara local
  // -----------------------
  useEffect(() => {
    if (isStarted && !isPreloading && !cameraReady) {
      startLocalGame();
    }
  }, [isStarted, isPreloading, cameraReady]);

  // -----------------------
  // Registrar jugador => NO generamos pelotas aquí
  // -----------------------
  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);

    // Crear/actualizar jugador
    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });

    // Eliminarlo en desconexión
    onDisconnect(playerRef).remove();
  }

  // -----------------------
  // Precarga del modelo (dummy)
  // -----------------------
  async function preloadModel() {
    try {
      const dummyVideo = document.createElement("video");
      poseLandmarkerCleanupRef.current = await initPoseLandmarker(
        dummyVideo,
        () => {}
      );
      setIsPreloading(false);
    } catch (error) {
      console.error("Error precargando modelo:", error);
      setIsPreloading(false);
    }
  }

  // -----------------------
  // startGame => si no existen pelotas, se generan,
  //              luego se pone isStarted=true
  // -----------------------
  async function startGame() {
    // Evitar doble inicio
    if (isPreloading || isStarted) return;

    try {
      const roomRef = ref(db, `rooms/${ROOM_ID}`);
      const snap = await get(roomRef);
      const data = snap.val();

      // Si no hay pelotas, las generamos
      let ballsObj = data?.balls;
      if (!ballsObj) {
        const newBalls = generateBalls(5); // 10 pelotas normalizadas
        ballsObj = {};
        newBalls.forEach((b) => {
          ballsObj[b.id] = b;
        });
      }

      // Subir isStarted=true y pelotas (si no había)
      await update(roomRef, {
        isStarted: true,
        balls: ballsObj,
      });
    } catch (err) {
      console.error("Error al iniciar juego:", err);
    }
  }

  // -----------------------
  // startLocalGame => inicia la cámara y el bucle de dibujo
  // -----------------------
  async function startLocalGame() {
    try {
      setCameraReady(true);

      // Iniciar cámara real
      const video = await initCamera();
      videoRef.current = video;

      // Configurar canvas
      const canvas = canvasRef.current!;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d")!;
      ctxRef.current = ctx;

      // Limpiar landmarker dummy
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }

      // Iniciar landmarker con la cámara real
      poseLandmarkerCleanupRef.current = await initPoseLandmarker(video, (
        allLandmarks
      ) => handlePoseResults(allLandmarks, canvas));

      // Bucle de dibujo
      const draw = () => {
        if (!ctxRef.current || !videoRef.current) return;
        drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
        requestAnimationFrame(draw);
      };
      draw();
    } catch (err) {
      console.error("Error iniciando juego local:", err);
    }
  }

  // -----------------------
  // restartGame => reiniciar scores, nuevas pelotas y isStarted=false
  // -----------------------
  async function restartGame() {
    try {
      // 1) Leer jugadores y poner sus scores en 0
      const playersSnap = await get(ref(db, `rooms/${ROOM_ID}/players`));
      const playersData = playersSnap.val() || {};
      Object.keys(playersData).forEach((pid) => {
        playersData[pid].score = 0;
      });

      // 2) Generar pelotas nuevas
      const newBalls = generateBalls(5);
      const ballsObj: Record<string, any> = {};
      newBalls.forEach((b) => {
        ballsObj[b.id] = b;
      });

      // 3) Subir a la DB => isStarted=false, scores=0, pelotas
      await update(ref(db, `rooms/${ROOM_ID}`), {
        isStarted: false,
        players: playersData,
        balls: ballsObj,
      });

      // 4) (Opcional) Parar cámara local
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
      setCameraReady(false);
    } catch (err) {
      console.error("Error reiniciando juego:", err);
    }
  }

  // -----------------------
  // handlePoseResults => filtrar landmarks de mano y checar colisión
  // -----------------------
  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    // Ajusta índices si tu modelo difiere
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );

    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  // -----------------------
  // checkInteractions => colisiones
  // -----------------------
  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    // Clonar balls local
    const currentBalls = { ...balls };

    handLandmarks.forEach((lm) => {
      // Supongamos un espejo => x = (1 - lm.x)
      const handX = (1 - lm.x) * canvas.width;
      const handY = lm.y * canvas.height;

      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        // Pelota en coords de píxeles
        const ballX = ball.x * canvas.width;
        const ballY = ball.y * canvas.height;
        const radius = ball.radius * canvas.width;

        // Distancia
        const dx = handX - ballX;
        const dy = handY - ballY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          // Desactiva local
          ball.active = false;

          // Actualiza en Firebase => para que desaparezca a todos
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), {
            active: false,
          });

          // Sumar score atómicamente
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 1
          ).catch((err) => console.error("Error sumando score:", err));
        }
      });
    });

    // Actualizar estado local ya
    setBalls(currentBalls);
  }

  // -----------------------
  // drawFrame => dibujar video y pelotas
  // -----------------------
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

  // -----------------------
  // drawLandmarks => dibujar marca de mano
  // -----------------------
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

  // -----------------------
  // drawBalls => dibujar pelotas normalizadas
  // -----------------------
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

  // -----------------------
  // generateBalls => en coords normalizadas
  // -----------------------
  function generateBalls(count: number) {
    const result = [];
    for (let i = 0; i < count; i++) {
      result.push({
        id: i,
        x: Math.random(),   // [0..1]
        y: Math.random(),
        radius: 0.04,       // 8% del ancho
        active: true,
      });
    }
    return result;
  }

  return {
    // Estados
    isPreloading,
    isStarted,
    players,
    balls,

    // Ref para el canvas
    canvasRef,

    // Métodos
    startGame,
    restartGame,
  };
}

/**
 * Genera un ID de jugador aleatorio
 */
function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
