import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDCh1lbKO31LR1PlPL03OzUrmFwyiyeDxs",
  authDomain: "pipelineballgame.firebaseapp.com",
  databaseURL: "https://pipelineballgame-default-rtdb.firebaseio.com",
  projectId: "pipelineballgame",
  storageBucket: "pipelineballgame.appspot.com", // Asegúrate de usar .appspot.com
  messagingSenderId: "925743476157",
  appId: "1:925743476157:web:5d552bf432a417f62536d4",
  measurementId: "G-S72YES61T6",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore
export const db = getFirestore(app);