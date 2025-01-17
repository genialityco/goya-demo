import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl"; // O "@tensorflow/tfjs-backend-wasm" si usas WASM
import BallInteractionGame from "./components/BallInteractionGame";

const setupBackend = async () => {
  await tf.setBackend("webgl"); // Cambia a "wasm" o "cpu" si es necesario
  await tf.ready();
};

setupBackend().catch(console.error);

const App = () => {
  return (
    <div>
      <BallInteractionGame />
    </div>
  );
};

export default App;
