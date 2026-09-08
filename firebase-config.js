export const firebaseConfig = {
  apiKey: "AIzaSyDzg5tPqeoGvqk2Eenh0JQWO9gMWrbItdE",
  authDomain: "meal-planner-4d26d.firebaseapp.com",
  projectId: "meal-planner-4d26d",
  storageBucket: "meal-planner-4d26d.firebasestorage.app",
  messagingSenderId: "78237039814",
  appId: "1:78237039814:web:f2a3c51f26be9f2c0babc7",
};

// Shared private data path both devices write to. Not a real secret (it
// ships in this file, readable by anyone who finds the repo) but combined
// with the Firestore rule locked to this exact path, it keeps out random
// bots/scanners hitting the open internet.
export const HOUSEHOLD_ID = "c2f137687c9353238735b61dce19340f";
