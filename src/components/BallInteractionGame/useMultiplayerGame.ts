/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase"; // Ajusta la ruta según tu proyecto
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

/** ID de la sala a la que se conectan todos */
const ROOM_ID = "miSala";

export function useMultiplayerGame() {
  // -----------------------
  // Estados principales
  // -----------------------
  const [isPreloading, setIsPreloading] = useState(true); // Preload del modelo
  const [isStarted, setIsStarted] = useState(false);      // Flag: partida iniciada
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});

  // Guarda la versión más reciente de balls
  const latestBallsRef = useRef<{ [key: string]: any }>({});

  // Identificador único de jugador
  const [localPlayerId] = useState(() => generatePlayerId());

  // -----------------------
  // Canvas y modelo
  // -----------------------
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Landmarks más recientes
  const landmarksRef = useRef<any[]>([]);

  // Cleanup del modelo si hace falta
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  // Para no reiniciar cámara varias veces
  const [cameraReady, setCameraReady] = useState(false);

  // Sincronizar el ref con el estado local
  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  // ------------------------------------------------------------------
  // useEffect principal:
  // 1) Verificar conexión
  // 2) Suscribirse a la sala (rooms/miSala)
  // 3) Precargar modelo
  // ------------------------------------------------------------------
  useEffect(() => {
    // 1) Verificar si estamos en línea
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      if (snap.val()) {
        // Registrar jugador en la sala
        await registerPlayerInRoom();
      }
    });

    // 2) Suscribirse a la sala
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val();
      if (!roomData) return;

      // (Opcional) verificar en consola qué llega
      console.log("Nuevos datos de la sala:", roomData);

      setIsStarted(roomData.isStarted || false);
      setPlayers(roomData.players || {});
      setBalls(roomData.balls || {});
    });

    // 3) Precarga del modelo con un video dummy
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
   * Cuando detectamos que isStarted=true y ya no estamos precargando,
   * cada cliente inicia localmente su cámara y loop (si no lo ha hecho).
   */
  useEffect(() => {
    if (isStarted && !isPreloading && !cameraReady) {
      startLocalGame();
    }
  }, [isStarted, isPreloading, cameraReady]);

  // ---------------------------------------------------------
  // Registrar al jugador en la sala: crea pelotas si no existen
  // ---------------------------------------------------------
  async function registerPlayerInRoom() {
    const playerPath = `rooms/${ROOM_ID}/players/${localPlayerId}`;
    const playerRef = ref(db, playerPath);

    // Crear jugador con score = 0
    await set(playerRef, {
      name: `Player-${localPlayerId.slice(0, 5)}`,
      score: 0,
    });

    // Eliminar al jugador si se desconecta
    onDisconnect(playerRef).remove();

    // Crear pelotas si no existen todavía
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();
    if (!data?.balls) {
      const initialBalls = generateBalls(10); // Genera 10 pelotas en columna
      const ballsObject: Record<string, any> = {};
      initialBalls.forEach((b) => {
        // El id numérico de la pelota se usa como key en ballsObject
        ballsObject[b.id] = b;
      });
      // Guardamos en la DB
      await update(roomRef, {
        balls: ballsObject,
        isStarted: false,
      });
    }
  }

  // -----------------------
  // Precarga del modelo
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

  // -----------------------------------------------
  // El usuario que clickea "Start Game" => isStarted=true
  // -----------------------------------------------
  async function startGame() {
    if (isPreloading || isStarted) return;
    update(ref(db, `rooms/${ROOM_ID}`), { isStarted: true });
  }

  // -----------------------------------------------
  // startLocalGame => inicia la cámara y el bucle en este cliente
  // -----------------------------------------------
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

      // Limpiar modelo dummy si estaba activo
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }

      // Iniciar poseLandmarker real con la cámara
      poseLandmarkerCleanupRef.current = await initPoseLandmarker(
        video,
        (allLandmarks) => handlePoseResults(allLandmarks, canvas)
      );

      // Bucle de dibujo (render)
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

  // -----------------------------------------------
  // restartGame => reset de scores y pelotas
  // -----------------------------------------------
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

      // 3) Actualizar la sala => isStarted=false (pantalla inicial)
      await update(ref(db, `rooms/${ROOM_ID}`), {
        isStarted: false,
        players: playersData,
        balls: newBallsObj,
      });

      // 4) Parar la cámara local (opcional)
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
      setCameraReady(false);

    } catch (error) {
      console.error("Error reiniciando partida:", error);
    }
  }

  // -----------------------------------------------
  // Manejo de resultados de pose => landmarks de mano
  // -----------------------------------------------
  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    // Ajusta los índices según tu modelo
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );
    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  // -----------------------------------------------
  // Colisiones mano - pelotas
  // -----------------------------------------------
  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...balls };

    handLandmarks.forEach((lm) => {
      // EJEMPLO: si dibujas el video en espejo, usa (1 - lm.x)
      const handX = (1 - lm.x) * canvas.width;
      const handY = lm.y * canvas.height;

      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        // Convertir coord. normalizada => píxeles
        const ballX = ball.x * canvas.width;
        const ballY = ball.y * canvas.height;
        const radius = ball.radius * canvas.width;

        // Verificar distancia
        const dx = handX - ballX;
        const dy = handY - ballY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          // Pelota atrapada => desactivamos
          ball.active = false;

          // Actualizar en DB para que todos la vean desactivada
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

    // Actualizar estado local ya
    setBalls(currentBalls);
  }

  // -----------------------------------------------
  // Bucle de dibujo
  // -----------------------------------------------
  function drawFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibuja el video en espejo (opcional)
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

  // -----------------------------------------------
  // Dibujar landmarks
  // -----------------------------------------------
  function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    landmarks.forEach((lm) => {
      // Ajustar si quieres espejo
      const x = (1 - lm.x) * canvas.width;
      const y = lm.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  }

  // -----------------------------------------------
  // Dibujar pelotas
  // -----------------------------------------------
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

  // -----------------------------------------------
  // Generar pelotas en columna vertical (x = 0.5)
  // -----------------------------------------------
  function generateBalls(count: number) {
    const balls = [];
    for (let i = 0; i < count; i++) {
      balls.push({
        id: i,
        x: 0.5,                   // Centro horizontal
        y: (i + 1) / (count + 1), // Distribución vertical
        radius: 0.04,
        active: true,
      });
    }
    return balls;
  }

  return {
    // Estados que podrían querer usarse en el UI
    isPreloading,
    isStarted,
    players,
    balls,

    // Referencia para <canvas ref={canvasRef} />
    canvasRef,

    // Métodos para tu interfaz
    startGame,
    restartGame,
  };
}

/** Genera un ID de jugador aleatorio */
function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
