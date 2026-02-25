import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAzLo8xEBP-jI3alE-Qjx2RiiQaBuzYYvs",
  authDomain: "erp-rpg.firebaseapp.com",
  databaseURL: "https://erp-rpg.firebaseio.com",
  projectId: "erp-rpg",
  storageBucket: "erp-rpg.firebasestorage.app",
  messagingSenderId: "369184771827",
  appId: "1:369184771827:web:c34135b764910310a6f186",
  measurementId: "G-3YPG5KQKPM",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const functions = getFunctions(app);
