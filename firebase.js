import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import { getAuth } from
"https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import { getFirestore } from
"https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCuYIuB_I9OrrTx6Qox6GnUerkN_vDgIHI",
  authDomain: "ssc-exam-project-8af6b.firebaseapp.com",
  projectId: "ssc-exam-project-8af6b",
  storageBucket: "ssc-exam-project-8af6b.firebasestorage.app",
  messagingSenderId: "288245274853",
  appId: "1:288245274853:web:b4d535a08faf305f5e9c0c",
  measurementId: "G-4BTLY67VDS"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


export { app, auth, db };