import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { BallInteractionGame } from "./components/BallInteractionGame/BallInteractionGame";
import "./App.css";
// import PoseDetector from "./components/PoseDetector_Camera";
// import BoneInspector from "./components/BoneInspector";

const setupBackend = async () => {
  await tf.setBackend("webgl");
  await tf.ready();
};

setupBackend().catch(console.error);

// const Home = () => (
//   <div className="home">
//     <h1 className="title">Experiencias Interactivas</h1>
//     <p className="subtitle">
//       Explora diferentes demos de geniality construidos con tecnologías
//       interactivas.
//     </p>
//     <nav className="nav">
//       <Link to="/demo1" className="link">
//         Juego multijugador - Detección manos con cámara
//       </Link>
//       <Link to="/demo3" className="link">
//         Avatar 3D con detección de movimiento
//       </Link>
//       <Link to="/demo2" className="link">
//         Inspector de animación(rigging) modelo 3D
//       </Link>
//     </nav>
//   </div>
// );

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BallInteractionGame />} />
        {/* <Route path="/demo1" element={<BallInteractionGame />} />
        <Route path="/demo2" element={<BoneInspector />} />
        <Route path="/demo3" element={<PoseDetector />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
