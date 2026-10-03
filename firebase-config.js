// =====================================================
// aitoolnotes.com — Firebase config (public keys — safe to expose)
// Security is enforced by Firestore rules + server, NOT by hiding these.
//
// 👉 REPLACE the values below with YOUR OWN Firebase project config.
//    Firebase console → Project settings → Your apps → Web app → config.
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// aitoolnotes.com Firebase project (public keys — safe to expose):
const firebaseConfig = {
  apiKey: "AIzaSyBI4K5-f7SkD890GdaopXbsrAsua0YOcts",
  authDomain: "aitoolnotes-com-4f83b.firebaseapp.com",
  projectId: "aitoolnotes-com-4f83b",
  storageBucket: "aitoolnotes-com-4f83b.firebasestorage.app",
  messagingSenderId: "281314731700",
  appId: "1:281314731700:web:bc394fff3c6388d804d9e1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  sendPasswordResetEmail,
  doc,
  getDoc,
  setDoc
};
