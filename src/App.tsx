import PoseDetector from "./components/PoseDetector_Camera";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl"; // O "@tensorflow/tfjs-backend-wasm" si usas WASM

const setupBackend = async () => {
  await tf.setBackend("webgl"); // Cambia a "wasm" o "cpu" si es necesario
  await tf.ready();
};

setupBackend().catch(console.error);

const App = () => {
  return (
    <div>
      <PoseDetector />
    </div>
  );
};

export default App;
