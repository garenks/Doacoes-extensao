// ============================================================
// CONFIGURAÇÃO DO FIREBASE (SDK compat, carregado via <script>)
// Define a variável global "firebaseDb" usada pelo main.js
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBxl2sOurOSPW3xZXuhdYjbrAMnH-l-CAo",
  authDomain: "ong-extensao.firebaseapp.com",
  projectId: "ong-extensao",
  storageBucket: "ong-extensao.firebasestorage.app",
  messagingSenderId: "238669137907",
  appId: "1:238669137907:web:aba9e80b95d47db9f5b486"
};

// Evita inicializar duas vezes caso o script seja carregado de novo.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firebaseDb = firebase.firestore();