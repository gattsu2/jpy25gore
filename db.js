// Shared cloud storage via Firestore, replacing the old per-device IndexedDB
// store so recipes / the meal plan / the shopping list sync between both
// phones. Firestore's persistent local cache keeps the app working offline
// the same way IndexedDB did — writes made offline queue locally and sync
// once back online. The `DB` API below matches the old IndexedDB version so
// the rest of the app didn't need to change.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import {
  getAuth,
  signInAnonymously,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { firebaseConfig, HOUSEHOLD_ID } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const authReady = signInAnonymously(auth).catch((err) => {
  console.error('Firebase anonymous sign-in failed (offline on first-ever load?)', err);
});

const householdDoc = (...segments) => doc(firestore, 'households', HOUSEHOLD_ID, ...segments);
const householdCollection = (name) => collection(firestore, 'households', HOUSEHOLD_ID, name);

const WEEKPLAN_ID = 'weekPlan';
const SHOPPING_LIST_ID = 'shoppingList';

const DB = {
  async getAllRecipes() {
    await authReady;
    const snap = await getDocs(householdCollection('recipes'));
    const all = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getRecipe(id) {
    await authReady;
    const snap = await getDoc(householdDoc('recipes', id));
    return snap.exists() ? { ...snap.data(), id: snap.id } : null;
  },

  async putRecipe(recipe) {
    await authReady;
    await setDoc(householdDoc('recipes', recipe.id), recipe);
    return recipe;
  },

  async deleteRecipe(id) {
    await authReady;
    await deleteDoc(householdDoc('recipes', id));
  },

  async getWeekPlan() {
    await authReady;
    const snap = await getDoc(householdDoc('state', WEEKPLAN_ID));
    return snap.exists() ? snap.data() : { selectedIds: [] };
  },

  async putWeekPlan(plan) {
    await authReady;
    await setDoc(householdDoc('state', WEEKPLAN_ID), plan);
  },

  async getShoppingList() {
    await authReady;
    const snap = await getDoc(householdDoc('state', SHOPPING_LIST_ID));
    return snap.exists() ? snap.data() : null;
  },

  async putShoppingList(list) {
    await authReady;
    await setDoc(householdDoc('state', SHOPPING_LIST_ID), list);
  },

  // Live updates so both phones see changes without a manual refresh.
  // Callback fires once immediately with current data, then again on
  // every remote (or local) change.
  watchRecipes(callback) {
    return onSnapshot(householdCollection('recipes'), (snap) => {
      const all = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
      callback(all.sort((a, b) => a.name.localeCompare(b.name)));
    });
  },

  watchShoppingList(callback) {
    return onSnapshot(householdDoc('state', SHOPPING_LIST_ID), (snap) => {
      callback(snap.exists() ? snap.data() : null);
    });
  },
};

function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

const SAMPLE_RECIPES = [
  {
    name: 'Spaghetti Bolognese',
    ingredients: [
      { qty: '1', unit: 'lb', name: 'ground beef' },
      { qty: '1', unit: '', name: 'onion' },
      { qty: '2', unit: 'clove', name: 'garlic' },
      { qty: '28', unit: 'oz', name: 'canned tomatoes' },
      { qty: '1', unit: 'lb', name: 'spaghetti' },
      { qty: '2', unit: 'tbsp', name: 'olive oil' },
    ],
    instructions: '1. Cook spaghetti according to package directions.\n2. Saute onion and garlic in olive oil until soft.\n3. Add ground beef, brown fully.\n4. Stir in canned tomatoes, simmer 15 min.\n5. Serve sauce over spaghetti.',
  },
  {
    name: 'Chicken Stir Fry',
    ingredients: [
      { qty: '1.5', unit: 'lb', name: 'chicken breast' },
      { qty: '2', unit: 'cup', name: 'broccoli' },
      { qty: '3', unit: 'clove', name: 'garlic' },
      { qty: '3', unit: 'tbsp', name: 'soy sauce' },
      { qty: '2', unit: 'cup', name: 'rice' },
      { qty: '1', unit: '', name: 'onion' },
    ],
    instructions: '1. Cook rice.\n2. Slice chicken and stir-fry until browned.\n3. Add onion, garlic, and broccoli, cook until tender-crisp.\n4. Stir in soy sauce.\n5. Serve over rice.',
  },
  {
    name: 'Veggie Tacos',
    ingredients: [
      { qty: '1', unit: 'can', name: 'black beans' },
      { qty: '8', unit: '', name: 'corn tortillas' },
      { qty: '1', unit: '', name: 'onion' },
      { qty: '2', unit: '', name: 'bell pepper' },
      { qty: '1', unit: 'cup', name: 'cheese' },
      { qty: '1', unit: 'tsp', name: 'cumin' },
    ],
    instructions: '1. Saute diced onion and bell pepper.\n2. Add drained black beans and cumin, warm through.\n3. Warm tortillas.\n4. Fill tortillas with the mixture and top with cheese.',
  },
  {
    name: 'Baked Salmon',
    ingredients: [
      { qty: '4', unit: '', name: 'salmon fillet' },
      { qty: '1', unit: '', name: 'lemon' },
      { qty: '2', unit: 'tbsp', name: 'olive oil' },
      { qty: '1', unit: 'bunch', name: 'asparagus' },
      { qty: '2', unit: 'clove', name: 'garlic' },
    ],
    instructions: '1. Preheat oven to 400F (200C).\n2. Place salmon and asparagus on a sheet pan.\n3. Drizzle with olive oil, minced garlic, and lemon juice.\n4. Bake 12-15 min until salmon flakes easily.',
  },
  {
    name: 'Margherita Pizza',
    ingredients: [
      { qty: '1', unit: '', name: 'pizza dough' },
      { qty: '8', unit: 'oz', name: 'mozzarella' },
      { qty: '3', unit: '', name: 'tomato' },
      { qty: '1', unit: 'handful', name: 'basil' },
      { qty: '1', unit: 'tbsp', name: 'olive oil' },
    ],
    instructions: '1. Preheat oven as hot as it goes.\n2. Stretch dough onto a pan.\n3. Top with sliced tomato and mozzarella.\n4. Bake until crust is golden.\n5. Finish with basil and a drizzle of olive oil.',
  },
  {
    name: 'Lentil Soup',
    ingredients: [
      { qty: '2', unit: 'cup', name: 'lentils' },
      { qty: '1', unit: '', name: 'onion' },
      { qty: '2', unit: '', name: 'carrot' },
      { qty: '2', unit: 'stalk', name: 'celery' },
      { qty: '2', unit: 'clove', name: 'garlic' },
      { qty: '6', unit: 'cup', name: 'vegetable broth' },
    ],
    instructions: '1. Saute onion, carrot, celery, and garlic until soft.\n2. Add lentils and broth.\n3. Simmer 25-30 min until lentils are tender.\n4. Season to taste.',
  },
  {
    name: 'Beef Tacos',
    ingredients: [
      { qty: '1', unit: 'lb', name: 'ground beef' },
      { qty: '8', unit: '', name: 'taco shells' },
      { qty: '1', unit: '', name: 'onion' },
      { qty: '1', unit: 'cup', name: 'cheese' },
      { qty: '1', unit: '', name: 'lettuce' },
      { qty: '2', unit: '', name: 'tomato' },
    ],
    instructions: '1. Brown ground beef with diced onion.\n2. Season to taste.\n3. Warm taco shells.\n4. Fill with beef and toppings.',
  },
  {
    name: 'Shrimp Pasta',
    ingredients: [
      { qty: '1', unit: 'lb', name: 'shrimp' },
      { qty: '1', unit: 'lb', name: 'pasta' },
      { qty: '4', unit: 'clove', name: 'garlic' },
      { qty: '3', unit: 'tbsp', name: 'olive oil' },
      { qty: '1', unit: 'handful', name: 'parsley' },
      { qty: '1', unit: '', name: 'lemon' },
    ],
    instructions: '1. Cook pasta according to package directions.\n2. Saute garlic in olive oil, add shrimp and cook until pink.\n3. Toss with pasta, parsley, and a squeeze of lemon.',
  },
];

async function seedIfEmpty() {
  await authReady;
  const snap = await getDocs(householdCollection('recipes'));
  if (!snap.empty) return;
  const batch = writeBatch(firestore);
  for (const r of SAMPLE_RECIPES) {
    const id = uuid();
    batch.set(householdDoc('recipes', id), {
      id,
      name: r.name,
      photo: null,
      ingredients: r.ingredients,
      instructions: r.instructions,
      createdAt: Date.now(),
    });
  }
  await batch.commit();
}

export { DB, uuid, seedIfEmpty };
