// IndexedDB wrapper. Photos are stored as data URLs directly on the recipe
// record — IndexedDB's quota is far larger than localStorage's, so this is
// fine for a personal recipe collection.
const DB_NAME = 'mealplanner';
const DB_VERSION = 1;
const WEEKPLAN_ID = 'current';
const SHOPPING_LIST_ID = 'current';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('recipes')) {
        db.createObjectStore('recipes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('weekPlan')) {
        db.createObjectStore('weekPlan', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('shoppingList')) {
        db.createObjectStore('shoppingList', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const DB = {
  async getAllRecipes() {
    const store = await tx('recipes', 'readonly');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => a.name.localeCompare(b.name));
  },

  async getRecipe(id) {
    const store = await tx('recipes', 'readonly');
    return reqToPromise(store.get(id));
  },

  async putRecipe(recipe) {
    const store = await tx('recipes', 'readwrite');
    await reqToPromise(store.put(recipe));
    return recipe;
  },

  async deleteRecipe(id) {
    const store = await tx('recipes', 'readwrite');
    await reqToPromise(store.delete(id));
  },

  async getWeekPlan() {
    const store = await tx('weekPlan', 'readonly');
    const rec = await reqToPromise(store.get(WEEKPLAN_ID));
    return rec || { id: WEEKPLAN_ID, selectedIds: [] };
  },

  async putWeekPlan(plan) {
    const store = await tx('weekPlan', 'readwrite');
    await reqToPromise(store.put({ ...plan, id: WEEKPLAN_ID }));
  },

  async getShoppingList() {
    const store = await tx('shoppingList', 'readonly');
    const rec = await reqToPromise(store.get(SHOPPING_LIST_ID));
    return rec || null;
  },

  async putShoppingList(list) {
    const store = await tx('shoppingList', 'readwrite');
    await reqToPromise(store.put({ ...list, id: SHOPPING_LIST_ID }));
  },

  async getMeta(id) {
    const store = await tx('meta', 'readonly');
    return reqToPromise(store.get(id));
  },

  async putMeta(rec) {
    const store = await tx('meta', 'readwrite');
    await reqToPromise(store.put(rec));
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
  const seeded = await DB.getMeta('seeded');
  if (seeded) return;
  const existing = await DB.getAllRecipes();
  if (existing.length === 0) {
    for (const r of SAMPLE_RECIPES) {
      await DB.putRecipe({
        id: uuid(),
        name: r.name,
        photo: null,
        ingredients: r.ingredients,
        instructions: r.instructions,
        createdAt: Date.now(),
      });
    }
  }
  await DB.putMeta({ id: 'seeded', value: true });
}
