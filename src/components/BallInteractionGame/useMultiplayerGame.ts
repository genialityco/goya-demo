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
  const [nicknameLocal, setNicknameLocal] = useState("");
  const [isPreloading, setIsPreloading] = useState(true);

  // Estado general del juego
  const [isStarted, setIsStarted] = useState(false);
  const [isFinishGame, setIsFinishGame] = useState(false);

  // Estado de jugadores y pelotas
  const [players, setPlayers] = useState<{ [key: string]: any }>({});
  const [balls, setBalls] = useState<{ [key: string]: any }>({});

  // Referencia a las pelotas (para el loop de dibujado)
  const latestBallsRef = useRef<{ [key: string]: any }>({});

  // Estado para saber si el usuario ya “ingresó” a la sala
  const [userJoined, setUserJoined] = useState(false);

  // Estado para saber si el usuario es el dueño/host
  const [isOwner, setIsOwner] = useState(false);

  // ID local del jugador
  const [localPlayerId] = useState(() => generatePlayerId());

  // Estado para ver si el usuario local ya inició su juego (su cámara, detecciones, etc.)
  const [userStartLocalGame, setUserStartLocalGame] = useState(false);

  // Audio de explosión
  const popAudioRef = useRef<HTMLAudioElement | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  // Imágenes para dibujar en el canvas
  const balloonImageRef = useRef<HTMLImageElement | null>(null);
  const frameImageRef = useRef<HTMLImageElement | null>(null);

  // Estado para manejar los popups de puntuación
  const [scorePopups, setScorePopups] = useState<
    { id: string; x: number; y: number; visible: boolean }[]
  >([]);

  // Estado para manejar la explosión en la UI
  const [explosion, setExplosion] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);

  /* Carga imágenes requeridas */
  useEffect(() => {
    const img = new Image();
    img.src = "/images/EMPANADA.png";
    balloonImageRef.current = img;

    const frameImg = new Image();
    const isMobile = window.innerWidth <= 768;
    frameImg.src = isMobile
      ? "/MOBILE/BALLOON_INTERNA_MOBILE.png"
      : "/DESKTOP/FONDO_BALLOON_INTERNA.png";
    frameImageRef.current = frameImg;

    popAudioRef.current = new Audio("/audios/medium-explosion-40472.mp3");
  }, []);

  // Mantén en sync el “latestBallsRef”
  useEffect(() => {
    latestBallsRef.current = balls;
  }, [balls]);

  /**
   * Lógica para conectarnos a la sala, escuchar sus datos,
   * y cargar modelo en background (preload).
   */
  useEffect(() => {
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, async (snap) => {
      const isOnline = snap.val();
      if (isOnline) {
        // Cuando hay conexión, nos "registramos" potencialmente
        // Pero OJO: ya NO vamos a poner nombre ni nada,
        // aquí sólo aseguramos que exista el player "vacío" con su ID.
        await registerPlayerSkeleton();
      }
    });

    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    onValue(roomRef, (snapshot) => {
      const roomData = snapshot.val();
      if (!roomData) return;
      setIsStarted(roomData.isStarted || false);
      setPlayers(roomData.players || {});
      setBalls(roomData.balls || {});
      setIsOwner(roomData.ownerId === localPlayerId); // saber si el local es el dueño

      // Checar si existe la lista de pelotas:
      if (roomData.balls) {
        const allBallsInactive = Object.values(roomData.balls).every(
          (ball: any) => !ball.active
        );
        if (allBallsInactive && Object.keys(roomData.balls).length > 0) {
          setIsFinishGame(true);
        } else {
          setIsFinishGame(false);
        }
      }
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
    // Escuchamos cambios en la lista de jugadores
    const playersRef = ref(db, `rooms/${ROOM_ID}/players`);
    const roomRef = ref(db, `rooms/${ROOM_ID}`);

    onValue(playersRef, async (snapshot) => {
      const playersData = snapshot.val() || {};
      const playerIds = Object.keys(playersData);

      // Obtenemos la sala para ver quién es el owner actual
      const roomSnap = await get(roomRef);
      if (!roomSnap.exists()) return; // si la sala no existe, salir
      const roomData = roomSnap.val();
      const currentOwner = roomData.ownerId || "";

      // Si no hay jugadores, no hay owner
      if (playerIds.length === 0) {
        await update(roomRef, { ownerId: "" });
        return;
      }

      // Verificar si el dueño actual sigue existiendo
      const ownerStillInGame = playerIds.includes(currentOwner);
      if (!ownerStillInGame) {
        // El dueño actual ya NO está en la lista
        // Elegir un nuevo dueño: por ejemplo, el primer ID de playerIds
        const newOwnerId = playerIds[0];
        await update(roomRef, { ownerId: newOwnerId });
      }
    });

    return () => {
      off(playersRef);
    };
  }, []);

  /**
   * Pedir ser dueño
   */
  async function becomeOwner() {
    try {
      const roomRef = ref(db, `rooms/${ROOM_ID}`);
      await update(roomRef, {
        ownerId: localPlayerId,
      });
    } catch (error) {
      console.error("Error al convertirte en dueño:", error);
    }
  }


  /**
   * Pre-carga el modelo de pose para no demorar al iniciar el juego.
   */
  async function preloadModel() {
    try {
      await loadPoseModel();
      setIsPreloading(false);
    } catch (error) {
      console.error("Error precargando el modelo:", error);
      setIsPreloading(false);
    }
  }

  /**
   * Sólo crea un “esqueleto” de jugador en la sala con ID local.
   * No le asigna nickname todavía.
   * También se asegura de crear las pelotas si no existen.
   */
async function registerPlayerSkeleton() {
  const roomRef = ref(db, `rooms/${ROOM_ID}`);
  const roomSnap = await get(roomRef);

  // Si no existe la sala, la creamos completa
  if (!roomSnap.exists()) {
    const initialBalls = generateBalls(20).reduce((o, b) => {
      o[b.id] = b;
      return o;
    }, {} as Record<string, any>);

    await set(roomRef, {
      ownerId: "",
      isStarted: false,
      players: {
        [localPlayerId]: { name: `P-${localPlayerId.slice(0,5)}`, score: 0 }
      },
      balls: initialBalls,
    });

  } else {
    // Ya existe la sala: si todavía NO tiene `balls`, las agregamos
    const data = roomSnap.val();
    if (!data.balls || Object.keys(data.balls).length === 0) {
      const initialBalls = generateBalls(20).reduce((o, b) => {
        o[b.id] = b;
        return o;
      }, {} as Record<string, any>);

      await update(roomRef, { balls: initialBalls });
    }

    // Si no hay owner, te conviertes
    if (!data.ownerId) {
      await update(roomRef, { ownerId: localPlayerId });
    }
  }

  // Finalmente registrarte como jugador skeleton…
  const playerRef = ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}`);
  await set(playerRef, { name: `P-${localPlayerId.slice(0,5)}`, score: 0 });
  onDisconnect(playerRef).remove();
}


  /**
   * Acción al dar clic en “Ingresar” con nickname:
   * - Actualizar en la DB el nickname del localPlayerId.
   * - Marcar userJoined = true para indicar que ya “estamos dentro”.
   */
  async function joinRoom(nickname: string) {
    if (!nickname.trim()) return;

    const playerRef = ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}`);
    await update(playerRef, {
      name: nickname.trim(),
    });

    setNicknameLocal(nickname.trim());
    setUserJoined(true);
  }

  /**
   * Acción al dar clic en “Comenzar juego” (sólo el dueño la tiene):
   * - Poner isStarted = true en la DB
   * - Cada usuario (en su useEffect) verá isStarted = true y entonces inicia su cámara
   */
  async function startGame() {
    if (isPreloading || isStarted) return;
    const roomRef = ref(db, `rooms/${ROOM_ID}`);
    await update(roomRef, { isStarted: true });
  }

  /**
   * Efecto: cuando isStarted sea true y el usuario YA se haya unido,
   * se inicia la lógica local (cámara, detección, render).
   */
  useEffect(() => {
    if (isStarted && userJoined) {
      startLocalGame();
    }
  }, [isStarted, userJoined]);

  /**
   * Inicia la lógica local (cámara, detecciones, render).
   * Esto se llama sólo cuando isStarted = true y userJoined = true.
   */
  async function startLocalGame() {
    setUserStartLocalGame(true);

    // Iniciar cámara
    const video = await initCamera();
    videoRef.current = video;

    // Ajustar canvas
    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d")!;
    ctxRef.current = ctx;

    // Si ya teníamos un cleanup de Landmarker, lo limpiamos.
    if (poseLandmarkerCleanupRef.current) {
      poseLandmarkerCleanupRef.current();
    }

    // Cargar (o reusar) el model
    const poseLandmarker = await loadPoseModel();

    // Comenzar la detección
    poseLandmarkerCleanupRef.current = startPoseDetection(
      video,
      poseLandmarker,
      (allLandmarks) => handlePoseResults(allLandmarks, canvas)
    );

    // Iniciar el loop de dibujado
    const draw = () => {
      if (!ctxRef.current || !videoRef.current) return;
      drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
      requestAnimationFrame(draw);
    };
    draw();
  }

  /**
   * Reiniciar sólo si eres el dueño. Se renuevan pelotas y scores.
   */
  async function restartGame() {
    if (!isOwner) return;

    try {
      const playersSnap = await get(ref(db, `rooms/${ROOM_ID}/players`));
      const playersData = playersSnap.val() || {};

      Object.keys(playersData).forEach((playerId) => {
        playersData[playerId].score = 0;
      });

      const newBalls = generateBalls(20);
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
      setUserStartLocalGame(false);
    } catch (error) {
      console.error("Error reiniciando la partida:", error);
    }
  }

  /**
   * Se llama cuando hay resultados de pose
   */
  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );
    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  /**
   * Verifica colisiones entre la mano y los globos.
   */
  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...latestBallsRef.current };

    handLandmarks.forEach((landmark) => {
      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        // Coordenadas del globo en el canvas
        const { centerX, centerY } = getBallCoordinates(ball, canvas);
        const balloonRadius = ball.radius * 1; // Ajusta a tu gusto

        // Distancia entre la mano y el centro del globo
        const dx = (1 - landmark.x) * canvas.width - centerX;
        const dy = landmark.y * canvas.height - centerY;
        const distanceSquared = dx * dx + dy * dy;

        // Verificar colisión
        if (distanceSquared < balloonRadius * balloonRadius) {
          ball.active = false;
          // Actualizar en DB
          update(ref(db, `rooms/${ROOM_ID}/balls/${ball.id}`), {
            active: false,
          });
          // Sumar puntuación
          runTransaction(
            ref(db, `rooms/${ROOM_ID}/players/${localPlayerId}/score`),
            (currentScore) => (currentScore || 0) + 100
          ).catch((error) => {
            console.error("Error incrementando score:", error);
          });
          // Explosión visual
          showExplosion(centerX, centerY);

          // Mostrar popup de +100
          showScorePopup(centerX, centerY);

          // Reproducir el sonido (si se cargó correctamente)
          if (popAudioRef.current) {
            popAudioRef.current.currentTime = 0;
            popAudioRef.current.play().catch((err) => console.error(err));
          }
        }
      });
    });
  }

  /**
   * Para dibujar un “frame” (video, globos, overlay)
   */
  function drawFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) {
    // Espejar la cámara
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Dibujar manos
    drawLandmarks(ctx, canvas, landmarks);

    // Dibujar globos
    drawBalls(ctx, latestBallsRef.current, canvas);

    // Dibujar overlay
    drawFrameOverlay(ctx, canvas);
  }

  /**
   * Dibuja cada mano (landmark)
   */
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

  /**
   * Dibuja cada globo
   */
  function drawBalls(
    ctx: CanvasRenderingContext2D,
    ballsObj: any,
    canvas: HTMLCanvasElement
  ) {
    const img = balloonImageRef.current;
    if (!img) return;

    Object.values(ballsObj).forEach((ball: any) => {
      if (!ball.active) return;

      const { centerX, centerY } = getBallCoordinates(ball, canvas);
      const radius = ball.radius;
      ctx.drawImage(
        img,
        centerX - radius,
        centerY - radius,
        radius * 3,
        radius * 3
      );
    });
  }

  /**
   * Dibuja el frame (marco) encima de todo.
   */
  function drawFrameOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement
  ) {
    const frameImg = frameImageRef.current;
    if (!frameImg) return;
    ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
  }

  /**
   * Muestra la explosión en la UI
   */
  function showExplosion(x: number, y: number) {
    setExplosion({ x, y, visible: true });
    setTimeout(() => {
      setExplosion((prev) => (prev ? { ...prev, visible: false } : null));
    }, 1000);
  }

  /**
   * Función para mostrar el popup de +100
   */
  function showScorePopup(x: number, y: number) {
    // Generamos un ID único
    const popupId = Math.random().toString(36).substr(2, 9);

    // Creamos la data del popup
    const newPopup = {
      id: popupId,
      x,
      y,
      visible: true,
    };

    // Agregamos al state
    setScorePopups((prev) => [...prev, newPopup]);

    // Quitarlo tras 1 segundo (o el tiempo que quieras)
    setTimeout(() => {
      setScorePopups((prev) => prev.filter((p) => p.id !== popupId));
    }, 1000);
  }

  /**
   * Calcular coordenadas absolutas del globo
   */
  function getBallCoordinates(ball: any, canvas: HTMLCanvasElement) {
    // Ajusta el factor si quieres distinto relleno en pantalla
    const centerX = (0.15 + 0.8 * ball.relativeX) * canvas.width;
    const centerY = (0.15 + 0.8 * ball.relativeY) * canvas.height;
    return { centerX, centerY };
  }

  /**
   * Genera N pelotas nuevas con posiciones aleatorias
   */
  function generateBalls(count: number) {
    const balls = [];
    const maxAttempts = 100;

    // Límites en coordenadas RELATIVAS (entre 0 y 1)
    // Ajústalos según el espacio que quieras “reservar” para el marco
    const xMin = 0.15;
    const xMax = 0.8;
    const yMin = 0.15;
    const yMax = 0.8;

    for (let i = 0; i < count; i++) {
      let valid = false;
      let attempts = 0;

      const newBall = {
        id: i,
        relativeX: 0,
        relativeY: 0,
        radius: 10,
        active: true,
      };

      while (!valid && attempts < maxAttempts) {
        // Generamos una posición aleatoria SÓLO dentro del bounding box
        const rx = xMin + Math.random() * (xMax - xMin);
        const ry = yMin + Math.random() * (yMax - yMin);

        newBall.relativeX = rx;
        newBall.relativeY = ry;

        // Verificamos que no se superponga con otras pelotas ya colocadas
        valid = balls.every((ball) => {
          const dx = (ball.relativeX - newBall.relativeX) * window.innerWidth;
          const dy = (ball.relativeY - newBall.relativeY) * window.innerHeight;
          const distance = Math.sqrt(dx * dx + dy * dy);

          return distance > (ball.radius + newBall.radius) * 2;
        });

        attempts++;
      }

      if (valid) {
        balls.push(newBall);
      } else {
        console.warn(
          `No se pudo colocar la pelota ${i} sin superposición tras ${maxAttempts} intentos.`
        );
      }
    }

    return balls;
  }

  return {
    // Estados de precarga, unión a sala, y juego
    isPreloading,
    isStarted,
    isFinishGame,
    userJoined,
    isOwner,
    becomeOwner,

    // Data
    players,
    balls,

    // Refs
    canvasRef,

    // Métodos
    joinRoom,
    startGame,
    restartGame,

    // Explosión y nickname
    explosion,
    nicknameLocal,
    setNicknameLocal,
    scorePopups,

    // Saber si local ya inició su cámara
    userStartLocalGame,
  };
}

function generatePlayerId() {
  return Math.random().toString(36).substr(2, 9);
}
