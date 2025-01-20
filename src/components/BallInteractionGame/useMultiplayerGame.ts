/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase"; // Ajusta la ruta
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
  // Estados principales
  // -----------------------
  const [isPreloading, setIsPreloading] = useState(true); // Preload del modelo
  const [isStarted, setIsStarted] = useState(false);      // Flag: partida iniciada
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});
  const latestBallsRef = useRef<{ [key: string]: any }>({});

  // Identificador único de jugador
  const [localPlayerId] = useState(() => generatePlayerId());

  // -----------------------
  // Canvas y modelo
  // -----------------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Donde guardamos los landmarks más recientes
  const landmarksRef = useRef<any[]>([]);

  // Cleanup del modelo si hace falta
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  // Para no reiniciar cámara dos veces
  const [cameraReady, setCameraReady] = useState(false);

  // Sincronizar ref con estado de balls
  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  // -----------------------
  // useEffect principal
  // -----------------------
  useEffect(() => {
    // 1) Verificar si estamos conectados (online)
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      if (snap.val()) {
        // Si está en línea, registrar jugador
        await registerPlayerInRoom();
      }
    });

    // 2) Suscribirse a cambios en la sala (isStarted, players, balls)
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val();
      if (!roomData) return;
      setIsStarted(roomData.isStarted || false);
      setPlayers(roomData.players || {});
      setBalls(roomData.balls || {});
    });

    // 3) Precarga del modelo de pose (dummy video)
    preloadModel();

    // Limpieza al desmontar
    return () => {
      off(connectedRef);
      off(roomRef);
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
    };
  }, []);

  /**
   * Cuando detectamos que `isStarted` es true y ya no estamos precargando,
   * cada cliente inicia localmente su cámara y loop (si no lo ha hecho).
   */
  useEffect(() => {
    if (isStarted && !isPreloading && !cameraReady) {
      startLocalGame(); // Arranca cámara y render en este cliente
    }
  }, [isStarted, isPreloading, cameraReady]);

  // -----------------------
  // Registro en la sala
  // -----------------------
  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);

    // 1) Crear jugador con score inicial
    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });

    // 2) Eliminar al jugador en caso de desconexión
    onDisconnect(playerRef).remove();

    // 3) Crear pelotas si no existen
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
      console.error("Error precargando el modelo:", error);
      setIsPreloading(false);
    }
  }

  // -----------------------
  // Start Game (para Firebase)
  // -----------------------
  async function startGame() {
    // Solo el usuario que da clic: avisa a Firebase "la sala está iniciada"
    if (isPreloading || isStarted) return;
    update(ref(db, `rooms/${ROOM_ID}`), { isStarted: true });
  }

  // -----------------------
  // startLocalGame (cámara y bucle)
  // -----------------------
  async function startLocalGame() {
    try {
      setCameraReady(true);

      // Iniciar cámara
      const video = await initCamera();
      videoRef.current = video;

      // Configurar canvas
      const canvas = canvasRef.current!;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext("2d")!;
      ctxRef.current = ctx;

      // Limpiar el modelo dummy si estaba activo
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
    } catch (error) {
      console.error("Error iniciando cámara/localGame:", error);
    }
  }

  // -----------------------
  // restartGame
  // -----------------------
  async function restartGame() {
    try {
      // 1) Leer jugadores y poner score=0
      const playersSnap = await get(ref(db, `rooms/${ROOM_ID}/players`));
      const playersData = playersSnap.val() || {};

      Object.keys(playersData).forEach((playerId) => {
        playersData[playerId].score = 0;
      });

      // 2) Generar nuevas pelotas
      const newBalls = generateBalls(10);
      const newBallsObj: Record<string, any> = {};
      newBalls.forEach((b) => {
        newBallsObj[b.id] = b;
      });

      // 3) Actualizar la sala => isStarted: false (pantalla inicial)
      await update(ref(db, `rooms/${ROOM_ID}`), {
        isStarted: false,
        players: playersData,
        balls: newBallsObj,
      });

      // 4) (Opcional) Parar la cámara local en este cliente, si quieres
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
      setCameraReady(false);

    } catch (error) {
      console.error("Error reiniciando partida:", error);
    }
  }

  // -----------------------
  // Procesar resultados de Pose
  // -----------------------
  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    // Filtrar landmarks de mano (ajusta los índices si tu modelo difiere)
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );

    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  // -----------------------
  // Colisiones mano - pelotas
  // -----------------------
  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...balls };

    handLandmarks.forEach((lm) => {
      // Opción A) SIN espejo en colisiones:
      //   const handX = lm.x * canvas.width;
      //   const handY = lm.y * canvas.height;
      //
      // Opción B) CON espejo en colisiones (si dibujaste espejo en video):
      //   const handX = (1 - lm.x) * canvas.width;
      //   const handY = lm.y * canvas.height;

      const handX = (1 - lm.x) * canvas.width; // <--- Ajusta según necesites
      const handY = lm.y * canvas.height;

      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        // Posición pelota (normalizada => pixeles)
        const ballX = ball.x * canvas.width;
        const ballY = ball.y * canvas.height;
        const radius = ball.radius * canvas.width; // radio

        // Distancia
        const dx = handX - ballX;
        const dy = handY - ballY;
        const distSq = dx * dx + dy * dy;

        // Si está dentro del radio, se "atrapa"
        if (distSq < radius * radius) {
          ball.active = false;
          // Actualizar en DB => desaparece para todos
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), {
            active: false,
          });
          // Sumar score atómicamente
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 1
          ).catch((err) => console.error("Error incrementando score:", err));
        }
      });
    });

    // Actualizar estado local inmediatamente
    setBalls(currentBalls);
  }

  // -----------------------
  // Dibujo en cada frame
  // -----------------------
  function drawFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Ejemplo de dibujar en espejo la cámara:
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Dibujar landmarks (ojo con el espejo):
    if (landmarks?.length) {
      drawLandmarks(ctx, canvas, landmarks);
    }

    // Dibujar pelotas
    drawBalls(ctx, latestBallsRef.current);
  }

  /**
   * Dibujar landmarks
   * Si estás dibujando el video en espejo, y quieres que la mano
   * coincida visualmente, podrías usar x = (1 - lm.x) en lugar de lm.x.
   */
  function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    landmarks.forEach((lm) => {
      // SIN espejo (x = lm.x):
      // const x = lm.x * canvas.width;
      // const y = lm.y * canvas.height;

      // CON espejo (x = (1 - lm.x)):
      const x = (1 - lm.x) * canvas.width;
      const y = lm.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  }

  /**
   * Dibujar pelotas (normalizadas => pixeles)
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

  // -----------------------
  // Generar pelotas normalizadas
  // -----------------------
  function generateBalls(count: number) {
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random(),  // [0..1]
      y: Math.random(),
      radius: 0.04,      // 4% del ancho (aprox.)
      active: true,
    }));
  }

  return {
    // Estados
    isPreloading,
    isStarted,
    players,
    balls,

    // Referencia para el canvas (para el <canvas ref={canvasRef} />)
    canvasRef,

    // Métodos públicos
    startGame,
    restartGame,
  };
}

/** Genera un ID de jugador aleatorio */
function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
