/* eslint-disable @typescript-eslint/no-explicit-any */
import  { useEffect, useRef, useState } from "react";
import { initPoseLandmarker } from "../services/PoseLandmarker";
import { initCamera } from "../services/Camera";

const BallInteractionGame = () => {
  // Estados
  const [isPreloading, setIsPreloading] = useState(true); 
  const [isStarted, setIsStarted] = useState(false);
  const [score, setScore] = useState(0);

  // Referencias
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const ballsRef = useRef<any[]>([]);
  const landmarksRef = useRef<any[]>([]);

  // Para limpiar luego el modelo (si fuera necesario)
  const poseLandmarkerCleanupRef = useRef<null | (() => void)>(null);

  /**
   * 1) Efecto para **precargar** el modelo:
   *    - No iniciamos la cámara todavía.
   *    - Usamos un "video fantasma" para que initPoseLandmarker no falle
   *      (dependerá de la forma en que esté implementada tu librería).
   */
  useEffect(() => {
    const preloadModel = async () => {
      try {
        // En caso de que tu initPoseLandmarker requiera un video obligatoriamente:
        const dummyVideo = document.createElement("video");

        // Cargamos el modelo en segundo plano
        // En la callback final no hacemos nada, pues no estamos
        // usando realmente este "video fantasma".
        poseLandmarkerCleanupRef.current = await initPoseLandmarker(dummyVideo, () => {});

        // Una vez ha terminado la carga:
        setIsPreloading(false);
      } catch (error) {
        console.error("Error precargando el modelo:", error);
        setIsPreloading(false);
      }
    };

    preloadModel();

    // Limpieza al desmontar componente (por si acaso)
    return () => {
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }
    };
  }, []);

  /**
   * 2) Función que se llama al hacer clic en "Empezar":
   *    - Inicia la cámara.
   *    - Re-inicializa el modelo (si es necesario) con el video "real".
   *    - Genera las pelotas.
   *    - Inicia el bucle de renderizado.
   */
  const startGame = async () => {
    // Evitar múltiples inicios, o que se inicie antes de terminar precarga.
    if (isPreloading || isStarted) return;

    setIsStarted(true);

    try {
      // Iniciamos la cámara
      const video = await initCamera();
      const canvas = canvasRef.current!;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const ctx = canvas.getContext("2d")!;
      ctxRef.current = ctx;

      // Generar pelotas
      ballsRef.current = generateBalls(10, canvas.width, canvas.height);

      // Si ya habíamos precargado el modelo con un "video fantasma", primero lo limpiamos
      if (poseLandmarkerCleanupRef.current) {
        poseLandmarkerCleanupRef.current();
      }

      // Ahora sí, pasamos el video REAL al poseLandmarker
      poseLandmarkerCleanupRef.current = await initPoseLandmarker(video, (landmarks) =>
        handlePoseResults(landmarks, canvas)
      );

      // Iniciamos loop
      const draw = () => {
        drawFrame(ctx, video, canvas, landmarksRef.current);
        requestAnimationFrame(draw);
      };
      draw();
    } catch (error) {
      console.error("Error al iniciar el juego:", error);
    }
  };

  /**
   * Lógica para generar pelotas
   */
  const generateBalls = (count: number, width: number, height: number) => {
    const padding = 50;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      x: Math.random() * (width - 2 * padding) + padding,
      y: Math.random() * (height - 2 * padding) + padding,
      radius: 25,
      active: true,
    }));
  };

  /**
   * Callback que maneja los resultados de pose
   */
  const handlePoseResults = (landmarks: any[], canvas: HTMLCanvasElement) => {
    const handLandmarks = landmarks.filter((_, index) =>
      [15, 16, 17, 18, 19, 20, 21, 22].includes(index)
    );

    landmarksRef.current = handLandmarks;
    checkInteractions(handLandmarks, canvas);
  };

  /**
   * Verificamos si algún landmark de la mano colisiona con alguna pelota
   */
  const checkInteractions = (landmarks: any[], canvas: HTMLCanvasElement) => {
    landmarks.forEach((landmark) => {
      ballsRef.current.forEach((ball) => {
        if (!ball.active) return;

        const dx = (1 - landmark.x) * canvas.width - ball.x;
        const dy = landmark.y * canvas.height - ball.y;
        const distanceSquared = dx * dx + dy * dy;

        if (distanceSquared < ball.radius * ball.radius) {
          ball.active = false;
          // ¡Ojo! Para actualizar estado con el valor anterior usar setScore((prev) => prev + 1)
          setScore((prev) => prev + 1);
        }
      });
    });
  };

  /**
   * Función que dibuja cada frame
   */
  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar video invertido horizontalmente (efecto espejo)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Dibujar landmarks
    if (landmarks) drawLandmarks(ctx, canvas, landmarks);

    // Dibujar pelotas
    drawBalls(ctx);
  };

  /**
   * Dibuja los landmarks
   */
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    landmarks: any[]
  ) => {
    landmarks.forEach((landmark) => {
      const x = (1 - landmark.x) * canvas.width;
      const y = landmark.y * canvas.height;

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = "red";
      ctx.fill();
    });
  };

  /**
   * Dibuja las pelotas
   */
  const drawBalls = (ctx: CanvasRenderingContext2D) => {
    ballsRef.current.forEach((ball) => {
      if (!ball.active) return;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, 2 * Math.PI);
      ctx.fillStyle = "blue";
      ctx.fill();
    });
  };

  return (
    <>
      {/* 
        Overlay de bienvenida (pantalla de inicio) 
        - Se ve solo cuando isStarted es false 
      */}
      {!isStarted && (
        <div
          style={{
            position: "absolute",
            zIndex: 10,
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.8)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "24px",
          }}
        >
          {isPreloading ? (
            <p>Cargando modelo...</p>
          ) : (
            <>
              <h2>Bienvenido/a al juego</h2>
              <button
                style={{ fontSize: "18px", padding: "10px 20px", cursor: "pointer" }}
                onClick={startGame}
              >
                Empezar
              </button>
            </>
          )}
        </div>
      )}

      {/* 
        Mostrar el marcador de score
        - Posición fija en la esquina superior
      */}
      <div
        style={{
          position: "absolute",
          top: "5%",
          left: "5%",
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          color: "#fff",
          padding: "10px 20px",
          borderRadius: "10px",
          fontSize: "24px",
          zIndex: 5,
        }}
      >
        Score: {score}
      </div>

      {/* 
        Canvas donde se dibuja el juego 
      */}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
};

export default BallInteractionGame;
