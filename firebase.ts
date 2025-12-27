import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCijGUuiqUjDhBu1H0IClZdW-SUrTc-OEk",
  authDomain: "mushroom1-1db55.firebaseapp.com",
  projectId: "mushroom1-1db55",
  storageBucket: "mushroom1-1db55.firebasestorage.app",
  messagingSenderId: "381076705990",
  appId: "1:381076705990:web:b35189ae6c51dd6cf77dc7"
};

const app = initializeApp(firebaseConfig);

// Enable Offline Persistence with multi-tab support
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Initialize Storage
const storage = getStorage(app);

export { db, storage };