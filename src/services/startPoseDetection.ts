/* eslint-disable @typescript-eslint/no-explicit-any */
import { PoseLandmarker } from "@mediapipe/tasks-vision";

export function startPoseDetection(
    video: HTMLVideoElement,
    poseLandmarker: PoseLandmarker,
    onResults: (landmarks: any[]) => void
  ) {
    let isRunning = true;
  
    async function detectPose() {
      if (!isRunning || video.readyState < 2) return;
      const result = await poseLandmarker.detectForVideo(video, performance.now());
      if (result?.landmarks?.length) {
        onResults(result.landmarks[0]);
      }
      if (isRunning) {
        requestAnimationFrame(detectPose);
      }
    }
  
    // Arrancamos el loop
    requestAnimationFrame(detectPose);
  
    // Retornamos una función para detener la detección
    return () => {
      isRunning = false;
      // Si NO deseas cerrar el modelo global, omite:
      // poseLandmarker.close();
      // O si deseas liberar la memoria *solo* cuando cierres la app, hazlo en otro lugar.
    };
  }
  