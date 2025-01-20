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

  // Guardamos en un ref la referencia más reciente de las pelotas
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

  // Para evitar reiniciar la cámara múltiples veces en el mismo cliente
  const [cameraReady, setCameraReady] = useState(false);

  // Sincroniza la ref de pelotas con su último valor de estado
  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  /**
   * Efecto principal:
   * - Registrar jugador en la sala
   * - Suscribirse a la sala (para leer isStarted, players, balls)
   * - Precargar modelo de pose
   * - Mantener onDisconnect
   */
  useEffect(() => {
    // 1) Escuchar el .info/connected para saber si estamos en línea
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      const isOnline = snap.val();
      if (isOnline) {
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

    // Cleanup
    return () => {
      off(connectedRef);
      off(roomRef);
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
    };
  }, []);

  /**
   * Cuando `isStarted` pasa a true, todos los clientes deben iniciar
   * su cámara, pose y bucle de render, si no lo han hecho ya.
   */
  useEffect(() => {
    // Sólo inicializar si isStarted=true, ya se precargó el modelo y
    // este cliente aún no ha inicializado su cámara (cameraReady=false).
    if (isStarted && !isPreloading && !cameraReady) {
      startLocalGame(); // inicia cámara y loop
    }
  }, [isStarted, isPreloading, cameraReady]);

  /**
   * Registra un jugador en la sala, y crea pelotas si no existen
   */
  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);

    // 1) Crear jugador con score inicial
    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });

    // 2) Al desconectarse, se elimina
    onDisconnect(playerRef).remove();

    // 3) Si no existen pelotas, crearlas
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
   * Precarga del modelo de pose con un video "dummy"
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
   * (1) El usuario que da clic en "Start Game" avisa a Firebase
   *     que la sala está iniciada (isStarted = true).
   * (2) Todos los clientes (incluyendo el que clicó) lo capturan en
   *     el useEffect y llaman a startLocalGame() (si no está ya corriendo).
   */
  async function startGame() {
    if (isPreloading || isStarted) return;
    // Actualizar isStarted en Firebase
    update(ref(db, `rooms/${ROOM_ID}`), { isStarted: true });
  }

  /**
   * Esta función inicia la cámara y el bucle de render local
   * en *este* cliente. La llamamos cuando vemos isStarted=true.
   */
  async function startLocalGame() {
    try {
      // Marcar que ya no volvamos a iniciar
      setCameraReady(true);

      // Iniciar la cámara
      const video = await initCamera();
      videoRef.current = video;

      // Configurar el canvas
      const canvas = canvasRef.current!;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d")!;
      ctxRef.current = ctx;

      // Limpiar el modelo dummy, si estaba activo
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }

      // Iniciar poseLandmarker real
      poseLandmarkerCleanupRef.current = await initPoseLandmarker(video, (
        allLandmarks
      ) => handlePoseResults(allLandmarks, canvas));

      // Iniciar bucle de dibujo local
      const draw = () => {
        if (!ctxRef.current || !videoRef.current) return;
        drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
        requestAnimationFrame(draw);
      };
      draw();
    } catch (error) {
      console.error("Error iniciando cámara/modelo local:", error);
    }
  }

  /**
   * Reiniciar juego:
   * - Resetea scores
   * - Genera nuevas pelotas
   * - isStarted = false (vuelven a ver la pantalla de inicio)
   */
  async function restartGame() {
    try {
      // 1) Obtener jugadores
      const playersSnap = await get(ref(db, `rooms/${ROOM_ID}/players`));
      const playersData = playersSnap.val() || {};

      // 2) Scores en 0
      Object.keys(playersData).forEach((playerId) => {
        playersData[playerId].score = 0;
      });

      // 3) Nuevas pelotas
      const newBalls = generateBalls(10);
      const newBallsObj: Record<string, any> = {};
      newBalls.forEach((b) => {
        newBallsObj[b.id] = b;
      });

      // 4) Actualizar sala
      await update(ref(db, `rooms/${ROOM_ID}`), {
        isStarted: false,
        players: playersData,
        balls: newBallsObj,
      });

      // 5) Opcional: En cada cliente, podrías hacer un cleanup local
      //    si quieres parar la cámara, etc. Ejemplo:
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
      setCameraReady(false);

    } catch (error) {
      console.error("Error reiniciando la partida:", error);
    }
  }

  /**
   * Procesa los resultados de la pose
   */
  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    // Landmarks de la mano (ajusta índices a tu conveniencia)
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );
    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  /**
   * Verifica colisiones mano-pelota y actualiza en Firebase
   */
  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...balls };

    handLandmarks.forEach((lm) => {
      // Landmark normalizado (0..1) => píxeles
      const handX = lm.x * canvas.width;
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
          // Desactivamos
          ball.active = false;
          // Enviar a Firebase
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), {
            active: false,
          });
          // Incrementar score atómicamente
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 1
          ).catch((error) => {
            console.error("Error incrementando score:", error);
          });
        }
      });
    });

    // Actualizar estado local
    setBalls(currentBalls);
  }

  /**
   * Bucle de dibujo
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

    // Landmarks
    if (landmarks?.length) {
      drawLandmarks(ctx, canvas, landmarks);
    }

    // Pelotas
    drawBalls(ctx, latestBallsRef.current);
  }

  /**
   * Dibuja landmarks
   */
  function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    landmarks.forEach((lm) => {
      // Ajusta si necesitas espejo (ej: x => (1 - lm.x))
      const x = lm.x * canvas.width;
      const y = lm.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  }

  /**
   * Dibuja pelotas
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
   * Genera pelotas con coordenadas normalizadas
   */
  function generateBalls(count: number) {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random(),  // [0..1]
      y: Math.random(),
      radius: 0.04,       // 4% del ancho (aprox.)
      active: true,
    }));
  }

  return {
    // Estados
    isPreloading,
    isStarted,
    players,
    balls,

    // Referencia para el canvas
    canvasRef,

    // Métodos
    startGame,
    restartGame,
  };
}

/** Genera un ID aleatorio */
function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
