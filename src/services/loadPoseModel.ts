import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let sharedPoseLandmarker: PoseLandmarker | null = null;

/**
 * Carga el modelo si no está cargado y retorna
 * la instancia de PoseLandmarker compartida.
 */
export async function loadPoseModel(): Promise<PoseLandmarker> {
  if (sharedPoseLandmarker) {
    // Ya está cargado en memoria, retorna la misma instancia
    return sharedPoseLandmarker;
  }

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  sharedPoseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  return sharedPoseLandmarker;
}
