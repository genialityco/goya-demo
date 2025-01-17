import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAQuTEsrXr6oMSqgoMvXo1qM1ebhzGOGZY",
  authDomain: "multiplayerballgame-c8556.firebaseapp.com",
  projectId: "multiplayerballgame-c8556",
  storageBucket: "multiplayerballgame-c8556.firebasestorage.app",
  messagingSenderId: "563301043458",
  appId: "1:563301043458:web:d8f4804e412d323dc6461b"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);