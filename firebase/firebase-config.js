// ============================================================
// CONFIGURAÇÃO DO FIREBASE (SDK compat, carregado via <script>)
// Define a variável global "firebaseDb" usada pelo main.js
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBBuAVff0_t3bGl5wJrREZ20kdoU4aq79E",
  authDomain: "ong-una.firebaseapp.com",
  projectId: "ong-una",
  storageBucket: "ong-una.firebasestorage.app",
  messagingSenderId: "470871248174",
  appId: "1:470871248174:web:d87dc87bf31f32b5d4bebf",
  measurementId: "G-W3S9ZTNS9D"
};

// Evita inicializar duas vezes caso o script seja carregado de novo.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firebaseDb = firebase.firestore();