/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { initCamera } from "../../services/Camera";
import { loadPoseModel } from "../../services/loadPoseModel";
import { startPoseDetection } from "../../services/startPoseDetection";

export const TOTAL_BALLS = 30;

export function useSinglePlayerGame() {
  const [nicknameLocal, setNicknameLocal] = useState("");
  const [isPreloading, setIsPreloading] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinishGame, setIsFinishGame] = useState(false);
  const [score, setScore] = useState(0);
  const [userStartLocalGame, setUserStartLocalGame] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const landmarksRef = useRef<any[]>([]);
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);
  const empaqueImagesRef = useRef<{ [key: string]: HTMLImageElement }>({});
  const frameImageRef = useRef<HTMLImageElement | null>(null);
  const popAudioRef = useRef<HTMLAudioElement | null>(null);

  const [balls, setBalls] = useState<{ [key: string]: any }>({});
  const latestBallsRef = useRef<{ [key: string]: any }>({});

  const [scorePopups, setScorePopups] = useState<
    { id: string; x: number; y: number; visible: boolean }[]
  >([]);

  const [explosion, setExplosion] = useState<{
    x: number;
    y: number;
    visible: boolean;
  } | null>(null);

  // Carga de imágenes de empaques
  useEffect(() => {
    const images: { [key: string]: HTMLImageElement } = {};
    for (let i = 1; i <= 5; i++) {
      const key = `EMPAQUE_0${i}`;
      const img = new Image();
      img.src = `/goya/PRODUCTO/${key}.png`;
      images[key] = img;
    }
    empaqueImagesRef.current = images;

    const frameImg = new Image();
    frameImg.src =
      window.innerWidth <= 768
        ? "/goya/MOBILE/BALLOON_INTERNA_MOBILE.png"
        : "/goya/DESKTOP/FONDO_GOYA_INTERNA.png";
    frameImageRef.current = frameImg;

    popAudioRef.current = new Audio("/audios/medium-explosion-40472.mp3");

    preloadModel();

    // Generar 30 balls, pero solo activar las primeras 5
    const allBallsArr = generateBalls(TOTAL_BALLS);
    const initialBalls = allBallsArr.reduce((o, b, idx) => {
      o[b.id] = { ...b, active: idx < 5 }; // solo los primeros 5 activos
      return o;
    }, {} as Record<string, any>);
    setBalls(initialBalls);
  }, []);

  // Mantener última referencia de balls y activar nuevas balls conforme desaparecen
  useEffect(() => {
    latestBallsRef.current = balls;

    // Determina el máximo de balls activas según el dispositivo
    const maxActiveBalls = window.innerWidth <= 600 ? 2 : 5;

    // Encuentra balls activas y balls que nunca han sido activadas
    const activeBalls = Object.values(balls).filter((b) => b.active);
    const neverActivated = Object.values(balls).filter((b: any) => !b.active && !b.wasActivated);

    // Si hay menos de maxActiveBalls activas y quedan por activar, activa las siguientes
    if (activeBalls.length < maxActiveBalls && neverActivated.length > 0) {
      const updatedBalls = { ...balls };
      let toActivate = maxActiveBalls - activeBalls.length;
      Object.values(balls).forEach((ball: any) => {
        if (!ball.active && !ball.wasActivated && toActivate > 0) {
          updatedBalls[ball.id] = { ...ball, active: true, wasActivated: true };
          toActivate--;
        }
      });
      setBalls(updatedBalls);
      return; // Importante: salir para evitar evaluar el final del juego antes de activar nuevas
    }

    // Solo marcar el juego como finalizado si ya no quedan balls por activar ni activas
    const allBallsInactive = Object.values(balls).every((b) => !b.active && b.wasActivated);
    setIsFinishGame(allBallsInactive);
  }, [balls]);

  // Cambiar aleatoriamente la imagen de cada empaque cada 3 segundos SOLO de balls activas
  useEffect(() => {
    const interval = setInterval(() => {
      setBalls((prev) => {
        const next: any = { ...prev };
        Object.keys(next).forEach((key) => {
          if (next[key].active) {
            next[key] = {
              ...next[key],
              imageKey: `EMPAQUE_0${Math.floor(Math.random() * 5) + 1}`,
            };
          }
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  async function preloadModel() {
    try {
      await loadPoseModel();
      setIsPreloading(false);
    } catch (err) {
      console.error("Error precargando el modelo:", err);
      setIsPreloading(false);
    }
  }

  async function startGame() {
    if (isPreloading || isStarted) return;
    setIsStarted(true);
    startLocalGame();
  }

  async function startLocalGame() {
    setUserStartLocalGame(true);
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
      (landmarks) => handlePoseResults(landmarks, canvas)
    );

    const draw = () => {
      if (!ctxRef.current || !videoRef.current) return;
      drawFrame(ctxRef.current, videoRef.current, canvas, landmarksRef.current);
      requestAnimationFrame(draw);
    };
    draw();
  }

  function handlePoseResults(allLandmarks: any[], canvas: HTMLCanvasElement) {
    const handLandmarks = allLandmarks.filter((_: any, index: number) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );
    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  }

  function checkInteractions(handLandmarks: any[], canvas: HTMLCanvasElement) {
    const currentBalls = { ...latestBallsRef.current };

    handLandmarks.forEach((landmark) => {
      Object.values(currentBalls).forEach((ball: any) => {
        if (!ball.active) return;

        const { centerX, centerY } = getBallCoordinates(ball, canvas);
        const radius = ball.radius;

        const dx = (1 - landmark.x) * canvas.width - centerX;
        const dy = landmark.y * canvas.height - centerY;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < radius * radius) {
          // Marcar como inactivo y que ya fue activado
          currentBalls[ball.id] = { ...ball, active: false, wasActivated: true };
          setBalls({ ...currentBalls });
          setScore((prev) => prev + 100);
          showExplosion(centerX, centerY);
          showScorePopup(centerX, centerY);
          if (popAudioRef.current) {
            popAudioRef.current.currentTime = 0;
            popAudioRef.current.play().catch(console.error);
          }
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

    drawLandmarks(ctx, canvas, landmarks);
    drawBalls(ctx, latestBallsRef.current, canvas);
    drawFrameOverlay(ctx, canvas);
  }

  function drawLandmarks(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, landmarks: any[]) {
    landmarks.forEach((landmark) => {
      const x = (1 - landmark.x) * canvas.width;
      const y = landmark.y * canvas.height;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  }

  function drawBalls(ctx: CanvasRenderingContext2D, balls: any, canvas: HTMLCanvasElement) {
    Object.values(balls).forEach((ball: any) => {
      if (!ball.active) return;

      const img = empaqueImagesRef.current[ball.imageKey];
      if (!img) return;

      const { centerX, centerY } = getBallCoordinates(ball, canvas);
      const radius = ball.radius;
      ctx.drawImage(img, centerX - radius, centerY - radius, radius * 3, radius * 3);
    });
  }

  function drawFrameOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const frameImg = frameImageRef.current;
    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, canvas.width, canvas.height);
    }
  }

  function showExplosion(x: number, y: number) {
    setExplosion({ x, y, visible: true });
    setTimeout(() => setExplosion((prev) => (prev ? { ...prev, visible: false } : null)), 1000);
  }

  function showScorePopup(x: number, y: number) {
    const id = Math.random().toString(36).substring(2, 9);
    const popup = { id, x, y, visible: true };
    setScorePopups((prev) => [...prev, popup]);
    setTimeout(() => setScorePopups((prev) => prev.filter((p) => p.id !== id)), 1000);
  }

  function getBallCoordinates(ball: any, canvas: HTMLCanvasElement) {
    const centerX = (0.15 + 0.8 * ball.relativeX) * canvas.width;
    const centerY = (0.15 + 0.8 * ball.relativeY) * canvas.height;
    return { centerX, centerY };
  }

  function generateBalls(count: number) {
    const balls: any[] = [];
    const xMin = 0.05, xMax = 0.8, yMin = 0.05, yMax = 0.6;
    for (let i = 0; i < count; i++) {
      let valid = false, attempts = 0;
      const ball = {
        id: i,
        relativeX: 0,
        relativeY: 0,
        radius: 40,
        active: false, // por defecto inactivo
        wasActivated: false, // flag para saber si ya fue activado alguna vez
        imageKey: `EMPAQUE_0${Math.floor(Math.random() * 5) + 1}`,
      };

      while (!valid && attempts < 100) {
        ball.relativeX = xMin + Math.random() * (xMax - xMin);
        ball.relativeY = yMin + Math.random() * (yMax - yMin);
        valid = balls.every(b => {
          const dx = (b.relativeX - ball.relativeX) * window.innerWidth;
          const dy = (b.relativeY - ball.relativeY) * window.innerHeight;
          const distance = Math.sqrt(dx * dx + dy * dy);
          return distance > (b.radius + ball.radius) * 2;
        });
        attempts++;
      }

      if (valid) balls.push(ball);
    }
    return balls;
  }

  return {
    canvasRef,
    isStarted,
    startGame,
    isFinishGame,
    explosion,
    scorePopups,
    nicknameLocal,
    setNicknameLocal,
    score,
    balls,
    userStartLocalGame,
    isPreloading,
  };
}
