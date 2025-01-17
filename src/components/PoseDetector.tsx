import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface BoneInfo {
  name: string;
  position: THREE.Vector3;
  rotation: { x: number; y: number; z: number };
  initialVector?: { x: number; y: number; z: number };
}

const BoneInspector = () => {
  const threeCanvasRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);

  // Lista de nombres de huesos
  const [bones, setBones] = useState<string[]>([]);
  // Mapa de “initial vectors” por nombre de hueso
  const [initialVectors, setInitialVectors] = useState<Record<string, THREE.Vector3>>({});
  // Hueso seleccionado
  const [selectedBone, setSelectedBone] = useState<THREE.Bone | null>(null);
  // Controlar modal y la info del hueso actual
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [boneInfo, setBoneInfo] = useState<BoneInfo>({
    name: "",
    position: new THREE.Vector3(0, 0, 0),
    rotation: { x: 0, y: 0, z: 0 },
  });

  // 1. Inicializar la escena y el modelo UNA SOLA VEZ
  useEffect(() => {
    // Crear escena, cámara y renderer
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

    // Cargar modelo GLTF
    const loader = new GLTFLoader();
    loader.load("/models/XBot.glb", (gltf) => {
      const model = gltf.scene;
      model.scale.set(2, 2, 2);
      model.position.set(0, -2, 0);
      scene.add(model);
      modelRef.current = model;

      // Listar huesos + calcular sus "initial vectors"
      const boneNames: string[] = [];
      const boneInitVecs: Record<string, THREE.Vector3> = {};

      model.traverse((child) => {
        if (child.isBone) {
          const bone = child as THREE.Bone;
          boneNames.push(bone.name);

          // Calcular vector local en T-Pose
          // Asumimos que el hueso "apunta" originalmente en +X
          const localDir = new THREE.Vector3(1, 0, 0);

          // Aplicar la rotación local del hueso a ese vector
          localDir.applyQuaternion(bone.quaternion);
          localDir.normalize(); // Lo normalizamos para tener un vector unitario

          boneInitVecs[bone.name] = localDir.clone();
        }
      });

      setBones(boneNames); 
      setInitialVectors(boneInitVecs);
    });

    // Animación
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Manejar resize de la ventana
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, []); // Se ejecuta una vez al montar

  // 2. Seleccionar un hueso sin afectar la escena
  const selectBone = (boneName: string) => {
    if (!modelRef.current) return;

    const bone = modelRef.current.getObjectByName(boneName) as THREE.Bone;
    if (bone) {
      setSelectedBone(bone);

      // Obtener su “initial vector” (si existe) para mostrar
      const initVec = initialVectors[boneName] || new THREE.Vector3(0, 0, 0);

      setBoneInfo({
        name: bone.name,
        position: bone.position.clone(),
        rotation: {
          x: THREE.MathUtils.radToDeg(bone.rotation.x),
          y: THREE.MathUtils.radToDeg(bone.rotation.y),
          z: THREE.MathUtils.radToDeg(bone.rotation.z),
        },
        // Guardamos el initial vector también en la info
        initialVector: {
          x: initVec.x,
          y: initVec.y,
          z: initVec.z,
        },
      });
      setIsModalOpen(false);
    }
  };

  // 3. Manejar teclas para mover/rotar huesos
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedBone) return;

      switch (event.key) {
        case "ArrowUp":
          selectedBone.position.y += 0.1;
          break;
        case "ArrowDown":
          selectedBone.position.y -= 0.1;
          break;
        case "ArrowLeft":
          selectedBone.position.x -= 0.1;
          break;
        case "ArrowRight":
          selectedBone.position.x += 0.1;
          break;
        case "w":
          selectedBone.position.z -= 0.1;
          break;
        case "s":
          selectedBone.position.z += 0.1;
          break;
        case "q":
          selectedBone.rotation.x += 0.01;
          break;
        case "e":
          selectedBone.rotation.x -= 0.1;
          break;
        case "a":
          selectedBone.rotation.y += 0.1;
          break;
        case "d":
          selectedBone.rotation.y -= 0.1;
          break;
        case "z":
          selectedBone.rotation.z += 0.1;
          break;
        case "x":
          selectedBone.rotation.z -= 0.1;
          break;
        default:
          break;
      }

      // Actualizar la info (posición/rotación) en la UI
      setBoneInfo((prev) => ({
        ...prev,
        position: selectedBone.position.clone(),
        rotation: {
          x: THREE.MathUtils.radToDeg(selectedBone.rotation.x),
          y: THREE.MathUtils.radToDeg(selectedBone.rotation.y),
          z: THREE.MathUtils.radToDeg(selectedBone.rotation.z),
        },
      }));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedBone]);

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
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "10px",
          color: "white",
        }}
      >
        <h3>Hueso Seleccionado:</h3>
        <p>Nombre: {boneInfo.name}</p>
        <p>
          Posición: X: {boneInfo.position.x.toFixed(2)}, Y:{" "}
          {boneInfo.position.y.toFixed(2)}, Z: {boneInfo.position.z.toFixed(2)}
        </p>
        <p>
          Rotación: X: {boneInfo.rotation.x.toFixed(2)}, Y:{" "}
          {boneInfo.rotation.y.toFixed(2)}, Z: {boneInfo.rotation.z.toFixed(2)}
        </p>
        {boneInfo.initialVector && (
          <p>
            <strong>Initial Vector (T-Pose):</strong> X:{" "}
            {boneInfo.initialVector.x.toFixed(2)}, Y:{" "}
            {boneInfo.initialVector.y.toFixed(2)}, Z:{" "}
            {boneInfo.initialVector.z.toFixed(2)}
          </p>
        )}
        <button onClick={() => setIsModalOpen(true)}>Abrir Lista de Huesos</button>
      </div>

      {isModalOpen && (
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "20%",
            width: "60%",
            height: "60%",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            overflowY: "auto",
            padding: "20px",
            borderRadius: "10px",
            zIndex: 10,
          }}
        >
          <h3>Seleccionar Hueso</h3>
          <ul>
            {bones.map((bone) => (
              <li key={bone}>
                <button
                  onClick={() => selectBone(bone)}
                  style={{
                    backgroundColor: "white",
                    color: "black",
                    margin: "5px",
                    padding: "10px",
                    borderRadius: "5px",
                  }}
                >
                  {bone}
                </button>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setIsModalOpen(false)}
            style={{
              backgroundColor: "red",
              color: "white",
              padding: "10px",
              borderRadius: "5px",
              marginTop: "10px",
            }}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
};

export default BoneInspector;
