import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export async function initPoseLandmarker(
  video: HTMLVideoElement,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onResults: (landmarks: any[]) => void
): Promise<() => void> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );

  const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  let isRunning = true;

  const detectPose = async () => {
    if (!isRunning) return;

    const result = await poseLandmarker.detectForVideo(video, performance.now());

    if (result?.landmarks?.length) {
      onResults(result.landmarks[0]); // Enviar las landmarks detectadas
    }

    requestAnimationFrame(detectPose);
  };

  detectPose();

  return () => {
    isRunning = false;
    poseLandmarker.close();
  };
}
