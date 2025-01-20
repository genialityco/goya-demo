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
  // Estados principales
  const [isPreloading, setIsPreloading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});
  const latestBallsRef = useRef<{ [key: string]: any }>({});

  // Identificador único de jugador
  const [localPlayerId] = useState(() => generatePlayerId());

  // Referencias para Canvas y Pose
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarksRef = useRef<any[]>([]);

  // Cleanup del modelo si hace falta
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  /**
   * Efecto principal:
   * - Registrar jugador en la sala
   * - Suscribirse a la sala (para leer isStarted, players, balls)
   * - Precargar modelo de pose
   * - Mantener activos
   */
  useEffect(() => {
    // Escuchamos el .info/connected para saber si estamos realmente en línea
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      const isOnline = snap.val();
      if (isOnline) {
        // Registra al jugador en la sala y configura onDisconnect
        await registerPlayerInRoom();
      }
    });

    // 2) Suscribirse a la sala (isStarted, players, balls)
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

    return () => {
      off(connectedRef);
      off(roomRef);
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
    };
  }, []);

  /**
   * Función para registrar un jugador en la sala.
   * También inicializa las pelotas en DB si no existen.
   */
  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);

    // 1) Creamos o actualizamos el jugador con un score inicial
    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });

    // 2) Eliminamos al jugador en caso de desconexión
    onDisconnect(playerRef).remove();

    // 3) Si no existen pelotas aún, crearlas
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();
    if (!data?.balls) {
      const initialBalls = generateBalls(10);
      const ballsObject: Record<string, any> = {};
      initialBalls.forEach((b) => {
        ballsObject[b.id] = b;
      });
      await update(roomRef, {
        balls: ballsObject,
        isStarted: false,
      });
    }
  }

  /**
   * Precarga del modelo con un video "dummy" para no bloquear
   */
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

  /**
   * Iniciar el juego:
   * - Actualiza isStarted en la DB
   * - Inicia cámara real
   * - Re-inicializa poseLandmarker con el video real
   * - Arranca el bucle de render
   */
  async function startGame() {
    if (isPreloading || isStarted) return;

    // Marcar la sala como iniciada en Firebase
    update(ref(db, `rooms/${ROOM_ID}`), { isStarted: true });

    // Iniciar la cámara
    const video = await initCamera();
    videoRef.current = video;

    // Configurar canvas
    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d")!;
    ctxRef.current = ctx;

    // Cleanup de modelo dummy
    if (poseLandmarkerCleanupRef.current) {
      poseLandmarkerCleanupRef.current();
    }

    // Iniciar poseLandmarker real
    poseLandmarkerCleanupRef.current = await initPoseLandmarker(
      video,
      (allLandmarks) => handlePoseResults(allLandmarks, canvas)
    );

    // Iniciar el bucle de dibujo
    const draw = () => {
      if (!ctxRef.current || !videoRef.current) return;
      drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
      requestAnimationFrame(draw);
    };
    draw();
  }

  /**
   * Reiniciar juego
   * -Restablece scores
   * -Genera nuevas pelotas
   */
  async function restartGame() {
    try {
      // 1) Obtener la lista de jugadores actual
      const playersSnap = await get(ref(db, `rooms/${ROOM_ID}/players`));
      const playersData = playersSnap.val() || {};

      // 2) Poner todos los scores en 0 (mantenemos los nombres)
      Object.keys(playersData).forEach((playerId) => {
        playersData[playerId].score = 0;
      });

      // 3) Generar nuevas pelotas (coordenadas normalizadas)
      const newBalls = generateBalls(10);
      const newBallsObj: Record<string, any> = {};
      newBalls.forEach((b) => {
        newBallsObj[b.id] = b;
      });

      // 4) Actualizar la sala en la DB:
      //    - isStarted: false (para que todos vuelvan a ver la pantalla de inicio)
      //    - players: playersData (scores en 0)
      //    - balls: newBallsObj
      await update(ref(db, `rooms/${ROOM_ID}`), {
        isStarted: false,
        players: playersData,
        balls: newBallsObj,
      });
    } catch (error) {
      console.error("Error reiniciando la partida:", error);
    }
  }

  /**
   * Procesa los resultados de la pose
   */
  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    // Landmarks de la mano
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );
    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  /**
   * Verifica colisiones de la mano con las pelotas y actualiza DB
   */
  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    // Clonar pelotas locales para mutarlas
    const currentBalls = { ...balls };

    handLandmarks.forEach((lm) => {
      // Convertir landmark normalizado (0..1)
      // a coordenadas de píxeles en este canvas
      const handX = lm.x * canvas.width;
      const handY = lm.y * canvas.height;

      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        // Convertir la posición normalizada de la pelota a píxeles
        const ballX = ball.x * canvas.width;
        const ballY = ball.y * canvas.height;
        const radius = ball.radius * canvas.width; // ej.: relativo al ancho

        // Calcular la distancia
        const dx = handX - ballX;
        const dy = handY - ballY;
        const distSq = dx * dx + dy * dy;

        // Comparar contra radio^2
        if (distSq < radius * radius) {
          // Pelota golpeada: desactivar
          ball.active = false;
          // Actualizar en Firebase
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), {
            active: false,
          });
          // Incrementar puntuación atómicamente
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 1
          ).catch((error) => {
            console.error("Error incrementando score:", error);
          });
        }
      });
    });

    // Actualizar estado local inmediatamente
    setBalls(currentBalls);
  }

  /**
   * Dibuja cada frame
   */
  function drawFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Efecto espejo
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Dibujar landmarks
    if (landmarks?.length) {
      drawLandmarks(ctx, canvas, landmarks);
    }
    // Pelotas
    drawBalls(ctx, latestBallsRef.current);
  }

  /**
   * Dibuja los landmarks (marcas) en el canvas
   */
  function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    landmarks.forEach((lm) => {
      // lm.x, lm.y están normalizados [0..1]
      const x = lm.x * canvas.width;
      const y = lm.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  }

  /**
   * Dibuja las pelotas (ya en pixeles)
   */
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

  /**
   * Genera un conjunto de pelotas con coordenadas normalizadas
   */
  function generateBalls(count: number) {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random(), // Normalizado [0..1]
      y: Math.random(), // Normalizado [0..1]
      radius: 0.04, // ~4% del ancho (puedes ajustar)
      active: true,
    }));
  }

  return {
    // Estados
    isPreloading,
    isStarted,
    players,
    balls,
    // Referencias
    canvasRef,
    // Métodos
    startGame,
    restartGame,
  };
}

/**
 * Genera un ID de jugador aleatorio (solo a modo de ejemplo)
 */
function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
