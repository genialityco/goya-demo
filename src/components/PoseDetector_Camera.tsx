import { useEffect, useRef } from "react";
import * as THREE from "three";
import { initCamera } from "./Camera";
import { initPoseLandmarker } from "./PoseLandmarker";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Interfaz opcional para mayor claridad en TypeScript
 */
interface Landmark {
  x: number;
  y: number;
  z: number;
}

const PoseDetector = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeCanvasRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  /**
   * Función para dibujar landmarks en el canvas.
   */
  const drawLandmarks = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    landmarks: Landmark[]
  ) => {
    // Limpiar área de dibujo
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar el video en modo espejo
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Dibujar cada punto de landmark
    landmarks.forEach((landmark) => {
      ctx.beginPath();
      ctx.arc(
        canvas.width - landmark.x * canvas.width,
        landmark.y * canvas.height,
        5,
        0,
        2 * Math.PI
      );
      ctx.fillStyle = "red";
      ctx.fill();
    });
  };

  /**
   * Calcula un quaternion a partir de un vector inicial y dos puntos (start, end).
   */
  const calculateQuaternion = (
    start: Landmark,
    end: Landmark,
    initialVec: THREE.Vector3
  ) => {
    // Crear vectores 3D a partir de las landmarks
    const startVec = new THREE.Vector3(start.x, start.y, start.z);
    const endVec = new THREE.Vector3(end.x, end.y, end.z);
  
    const direction = new THREE.Vector3()
      .subVectors(endVec, startVec)
      .normalize();
  
    // Calcular el quaternion que rota initialVec hacia la dirección calculada
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      initialVec,
      direction
    ).invert(); 
  
    return quaternion;
  };
  

  /**
   * Sincroniza la pose de la persona con la del modelo 3D.
   */
  const syncModeloCompleto = (
    landmarks: Landmark[],
    model: THREE.Object3D,
    initialVecManual?: THREE.Vector3
  ) => {
    if (!landmarks || landmarks.length === 0) return;
  
    // Reflejar landmarks para trabajar en modo espejo
    const mirroredLandmarks = landmarks.map((landmark) => ({
      x: 1 - landmark.x, // Reflejar el eje X
      y: landmark.y,
      z: 1 - landmark.z, // Reflejar el eje Z
    }));
  
    // Landmarks clave
    const codoDerechoLandmark = mirroredLandmarks[13];
    const manoDerechaLandmark = mirroredLandmarks[15];
  
    if (!codoDerechoLandmark || !manoDerechaLandmark) {
      console.warn("Landmarks necesarios para el antebrazo derecho no están disponibles.");
      return;
    }
  
    // Obtener hueso del antebrazo derecho del modelo
    const antebrazoD = model.getObjectByName("mixamorigRightForeArm");
    if (!antebrazoD) {
      console.warn("El hueso 'mixamorigRightForeArm' no fue encontrado en el modelo.");
      return;
    }
  
    // Usar vector inicial del modelo o el proporcionado manualmente
    const initialVec = initialVecManual
      ? initialVecManual.normalize()
      : new THREE.Vector3().copy(antebrazoD.position).normalize();
  
    // Calcular rotación para el antebrazo derecho
    const rotationAntebrazoD = calculateQuaternion(
      codoDerechoLandmark,
      manoDerechaLandmark,
      initialVec
    );
  
    // Aplicar rotación al antebrazo derecho
    antebrazoD.quaternion.copy(rotationAntebrazoD);
  };
  
  
  
  
  useEffect(() => {
    // 1. Crear escena, cámara y renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (threeCanvasRef.current) {
      threeCanvasRef.current.appendChild(renderer.domElement);
    }

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 5, 5);
    scene.add(light);

    // 3. Agregar ejes para depuración
    const axesHelper = new THREE.AxesHelper(1);
    scene.add(axesHelper);

    // 4. Cargar modelo GLTF
    const loader = new GLTFLoader();
    loader.load("/models/XBot.glb", (gltf) => {
      const model = gltf.scene;
      console.log(model);
      model.scale.set(2, 2, 2);
      model.position.set(0, -2, 0);
      scene.add(model);
      modelRef.current = model;
    });

    // 5. Iniciar cámara y Pose Landmarker
    let landmarkerCleanup: null | (() => void) = null;

    const setupPoseLandmarker = async () => {
      const video = await initCamera();
      videoRef.current = video;

      const canvas = canvasRef.current!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;

      landmarkerCleanup = await initPoseLandmarker(video, (landmarks) => {
        // Dibuja landmarks espejados en el canvas
        drawLandmarks(ctx, canvas, video, landmarks);
      
        // Sincroniza pose con el modelo usando landmarks originales
        if (modelRef.current) {
          syncModeloCompleto(landmarks, modelRef.current, new THREE.Vector3(1, 0, 0));
        }
      });      
    };

    setupPoseLandmarker().catch(console.error);

    // 6. Función de animación
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // 7. Manejar resize de la ventana
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // 8. Cleanup
    return () => {
      if (landmarkerCleanup) {
        landmarkerCleanup(); // Limpia listeners de la librería de pose
      }
      renderer.dispose(); // Libera el contexto WebGL
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div
        ref={threeCanvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          width: "200px",
          height: "150px",
          zIndex: 1,
          border: "2px solid white",
        }}
      />
    </div>
  );
};

export default PoseDetector;
