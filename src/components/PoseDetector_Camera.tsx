import { useEffect, useRef } from "react";
import * as THREE from "three";
import { initCamera } from "./Camera";
import { initPoseLandmarker } from "./PoseLandmarker";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Interfaz opcional para mayor claridad en TypeScript
 */
interface Landmark {
  visibility: number;
  x: number;
  y: number;
  z: number;
}

const PoseDetector = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeCanvasRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Referencias para escena, cámara y renderer
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  /**
   * Función para configurar la escena y el renderer
   */
  const setupScene = () => {
    if (!sceneRef.current) {
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
      );
      camera.position.z = 5;
      cameraRef.current = camera;

      const renderer = new THREE.WebGLRenderer({ alpha: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      rendererRef.current = renderer;

      if (threeCanvasRef.current) {
        threeCanvasRef.current.appendChild(renderer.domElement);
      }

      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 5, 5);
      scene.add(light);

      const axesHelper = new THREE.AxesHelper(1);
      scene.add(axesHelper);
    }
  };

  /**
   * Cargar modelo GLTF en la escena.
   */
  const loadModel = () => {
    if (!sceneRef.current || modelRef.current) return;

    const loader = new GLTFLoader();
    loader.load("/models/XBot.glb", (gltf) => {
      const model = gltf.scene;
      model.scale.set(2, 2, 2);
      model.position.set(0, -2, 0);
      sceneRef.current?.add(model);
      modelRef.current = model;
    });
  };

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
      initialVec.normalize(),
      direction.normalize()
    );
    // .invert();

    return quaternion;
  };

  /**
   * Sincroniza la pose de la persona con la del modelo 3D.
   */
  /**
   * Sincroniza la pose de la persona con la del modelo 3D.
   * Si faltan landmarks, forzar brazos abajo.
   */
  const syncModeloCompleto = (landmarks: Landmark[], model: THREE.Object3D) => {
    if (!landmarks || landmarks.length === 0) return;

    // Reflejar landmarks para trabajar en modo espejo (si aplica)
    const mirroredLandmarks = landmarks;

    // Landmarks clave para brazo izquierdo
    const hombroIzquierdoLandmark = mirroredLandmarks[12];
    const codoIzquierdoLandmark = mirroredLandmarks[14];
    const manoIzquierdaLandmark = mirroredLandmarks[16];

    // Landmarks clave para brazo derecho
    const hombroDerechoLandmark = mirroredLandmarks[11];
    const codoDerechoLandmark = mirroredLandmarks[13];
    const manoDerechaLandmark = mirroredLandmarks[15];

    // Obtener huesos del brazo izquierdo
    const brazoI = model.getObjectByName("mixamorigLeftArm");
    const antebrazoI = model.getObjectByName("mixamorigLeftForeArm");

    // Obtener huesos del brazo derecho
    const brazoD = model.getObjectByName("mixamorigRightArm");
    const antebrazoD = model.getObjectByName("mixamorigRightForeArm");

    // Rotación por defecto (brazos abajo). Ajusta estos valores según tu rig:
    // Si la T-Pose tiene los brazos estirados hacia los lados (+X o -X),
    // girar -90° en Z (o en X) los hace "caer" hacia abajo.
    const brazoAbajoEulerIzq = new THREE.Euler(1.2, 0, 0);
    const brazoAbajoEulerDer = new THREE.Euler(1.2, 0, 0);
    const brazoAbajoQuatIzq = new THREE.Quaternion().setFromEuler(
      brazoAbajoEulerIzq
    );
    const brazoAbajoQuatDer = new THREE.Quaternion().setFromEuler(
      brazoAbajoEulerDer
    );

    // (Opcional) El antebrazo quizás quieras dejarlo en 0,0,0
    // o con un leve doblez. Aquí lo dejamos "recto".
    const antebrazoAbajoQuat = new THREE.Quaternion().identity();

    // Crear un pequeño offset de 40° en X
    const mySmallOffsetQuaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(-40), // 15° en X
        0, // 0° en Y
        0 // 0° en Z
      )
    );

    // ----- BRAZO IZQUIERDO -----
    if (brazoI && antebrazoI) {
      // Verificar si los landmarks del codo y mano existen
      if (
        codoIzquierdoLandmark &&
        codoIzquierdoLandmark.visibility > 0.5 &&
        manoIzquierdaLandmark &&
        manoIzquierdaLandmark.visibility > 0.5
      ) {
        // Calcular rotación para el brazo izquierdo
        const rotationBrazoI = calculateQuaternion(
          hombroIzquierdoLandmark,
          codoIzquierdoLandmark,
          new THREE.Vector3(-1, 0, 0)
        );

        // Aplica el offset
        rotationBrazoI.multiply(mySmallOffsetQuaternion);

        // Asigna la rotación resultante
        brazoI.quaternion.copy(rotationBrazoI);

        // Calcular rotación para el antebrazo izquierdo
        const rotationAntebrazoI = calculateQuaternion(
          codoIzquierdoLandmark,
          manoIzquierdaLandmark,
          new THREE.Vector3(-1, 0, 0)
        );

        antebrazoI.quaternion.copy(rotationAntebrazoI);
      } else {
        // Si faltan codo o mano => brazo "abajo"
        brazoI.quaternion.copy(brazoAbajoQuatIzq);
        antebrazoI.quaternion.copy(antebrazoAbajoQuat);
      }
    }

    // ----- BRAZO DERECHO -----
    if (brazoD && antebrazoD) {
      // Verificar si los landmarks del codo y mano existen
      if (
        codoDerechoLandmark &&
        codoDerechoLandmark.visibility > 0.5 &&
        manoDerechaLandmark &&
        manoDerechaLandmark.visibility > 0.5
      ) {
        // Calcular rotación para el brazo derecho
        const rotationBrazoD = calculateQuaternion(
          hombroDerechoLandmark,
          codoDerechoLandmark,
          new THREE.Vector3(0.98, -0.21, 0)
        );

        rotationBrazoD.multiply(mySmallOffsetQuaternion);

        brazoD.quaternion.copy(rotationBrazoD);

        // Calcular rotación para el antebrazo derecho
        const rotationAntebrazoD = calculateQuaternion(
          codoDerechoLandmark,
          manoDerechaLandmark,
          new THREE.Vector3(1, 0, 0)
        );
        antebrazoD.quaternion.copy(rotationAntebrazoD);
      } else {
        // Si faltan codo o mano => brazo "abajo"
        brazoD.quaternion.copy(brazoAbajoQuatDer);
        antebrazoD.quaternion.copy(antebrazoAbajoQuat);
      }
    }
  };

  useEffect(() => {
    // Configurar escena y renderer
    setupScene();

    // Cargar modelo
    loadModel();

    // Iniciar cámara y Pose Landmarker
    let landmarkerCleanup: null | (() => void) = null;

    const setupPoseLandmarker = async () => {
      const video = await initCamera();
      videoRef.current = video;

      const canvas = canvasRef.current!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;

      landmarkerCleanup = await initPoseLandmarker(video, (landmarks) => {
        // Dibuja landmarks en el canvas
        drawLandmarks(ctx, canvas, video, landmarks);

        // Sincroniza pose con el modelo usando landmarks originales
        if (modelRef.current) {
          syncModeloCompleto(landmarks, modelRef.current);
        }
      });
    };

    setupPoseLandmarker().catch(console.error);

    // Animar escena
    const animate = () => {
      requestAnimationFrame(animate);
      if (sceneRef.current && cameraRef.current && rendererRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Manejar resize de la ventana
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      if (landmarkerCleanup) {
        landmarkerCleanup();
      }
      rendererRef.current?.dispose();
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
