const viewEl = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const backBtn = document.getElementById('back-btn');
const toastEl = document.getElementById('toast');

const MAX_MEALS = 20;

const UNIT_ALIASES = {
  tsp: ['tsp', 'tsps', 'teaspoon', 'teaspoons'],
  tbsp: ['tbsp', 'tbsps', 'tablespoon', 'tablespoons'],
  cup: ['cup', 'cups'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  g: ['g', 'gram', 'grams'],
  kg: ['kg', 'kilogram', 'kilograms'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans'],
  pinch: ['pinch', 'pinches'],
  slice: ['slice', 'slices'],
  stalk: ['stalk', 'stalks'],
  bunch: ['bunch', 'bunches'],
  head: ['head', 'heads'],
  handful: ['handful', 'handfuls'],
};
const UNIT_LOOKUP = (() => {
  const map = {};
  for (const [canon, aliases] of Object.entries(UNIT_ALIASES)) {
    for (const a of aliases) map[a] = canon;
  }
  return map;
})();
const COMMON_UNITS = Object.keys(UNIT_ALIASES);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  toastEl.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => { toastEl.hidden = true; }, 200);
  }, 2200);
}

function setHeader(title, backHash) {
  titleEl.textContent = title;
  if (backHash) {
    backBtn.hidden = false;
    backBtn.onclick = () => { location.hash = backHash; };
  } else {
    backBtn.hidden = true;
    backBtn.onclick = null;
  }
}

// ---------- Routing ----------
function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'home' };
  if (parts[0] === 'recipes' && parts[1] === 'new') return { view: 'recipe-form' };
  if (parts[0] === 'recipes' && parts[1]) return { view: 'recipe-form', id: parts[1] };
  if (parts[0] === 'plan') return { view: 'plan' };
  if (parts[0] === 'shopping') return { view: 'shopping' };
  return { view: 'home' };
}

const bottomBar = document.getElementById('bottom-bar');

async function render() {
  const route = parseHash();
  viewEl.focus();
  bottomBar.hidden = true;
  try {
    if (route.view === 'home') return renderHome();
    if (route.view === 'recipe-form') return renderRecipeForm(route.id);
    if (route.view === 'plan') return renderPlan();
    if (route.view === 'shopping') return renderShopping();
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="empty-state"><p>Something went wrong loading this screen.</p></div>`;
  }
}

window.addEventListener('hashchange', render);

// ---------- Home (browse recipes) ----------
async function renderHome() {
  setHeader('Meal Planner', null);
  const [recipes, list] = await Promise.all([DB.getAllRecipes(), DB.getShoppingList()]);

  const heroHtml = `
    <div class="home-hero">
      <img class="hero-logo" src="icons/hero.jpg" alt="Meal Planner">
    </div>
  `;

  const bannerHtml = (list && list.items.length)
    ? `<a href="#/shopping" class="list-banner">
         <span class="list-banner-icon" aria-hidden="true">🛒</span>
         <span class="list-banner-text">Shopping list <strong>${list.items.filter((i) => i.checked).length}/${list.items.length}</strong> checked</span>
         <span class="chev" aria-hidden="true">›</span>
       </a>`
    : '';

  if (recipes.length === 0) {
    viewEl.innerHTML = `
      ${heroHtml}
      <h2 class="section-heading">Recipes</h2>
      ${bannerHtml}
      <div class="empty-state">
        <p>No recipes yet.</p>
        <p class="muted">Add your first recipe to get started.</p>
      </div>
      <button class="fab" id="add-recipe-fab" aria-label="Add recipe">+</button>
    `;
  } else {
    viewEl.innerHTML = `
      ${heroHtml}
      <h2 class="section-heading">Recipes</h2>
      ${bannerHtml}
      <button id="start-planning-btn" class="btn primary start-planning-btn">Start planning!</button>
      <div class="recipe-grid">
        ${recipes.map(recipeCardHtml).join('')}
      </div>
      <button class="fab" id="add-recipe-fab" aria-label="Add recipe">+</button>
    `;
    document.getElementById('start-planning-btn').addEventListener('click', () => {
      location.hash = '#/plan';
    });
  }

  document.getElementById('add-recipe-fab').addEventListener('click', () => {
    location.hash = '#/recipes/new';
  });
  viewEl.querySelectorAll('.recipe-card').forEach((card) => {
    card.addEventListener('click', () => {
      location.hash = '#/recipes/' + card.dataset.id;
    });
  });
}

function recipeCardHtml(r) {
  const thumb = r.photo
    ? `<img class="recipe-thumb" src="${r.photo}" alt="">`
    : `<div class="recipe-thumb placeholder" aria-hidden="true">🍽️</div>`;
  const count = r.ingredients.length;
  return `
    <button class="recipe-card" data-id="${r.id}">
      ${thumb}
      <div class="recipe-card-body">
        <div class="recipe-card-name">${escapeHtml(r.name)}</div>
        <div class="recipe-card-meta">${count} ingredient${count === 1 ? '' : 's'}</div>
      </div>
    </button>
  `;
}

// ---------- Recipe form ----------
async function renderRecipeForm(id) {
  const editing = Boolean(id);
  const recipe = editing ? await DB.getRecipe(id) : null;
  if (editing && !recipe) {
    setHeader('Recipe', '#/');
    viewEl.innerHTML = `<div class="empty-state"><p>Recipe not found.</p></div>`;
    return;
  }
  setHeader(editing ? 'Edit Recipe' : 'New Recipe', '#/');

  viewEl.innerHTML = `
    <form id="recipe-form" class="form">
      <label class="field">
        <span>Name</span>
        <input type="text" id="f-name" required value="${recipe ? escapeHtml(recipe.name) : ''}" placeholder="e.g. Spaghetti Bolognese">
      </label>

      <div class="field">
        <span>Photo</span>
        <div class="photo-picker">
          <img id="photo-preview" src="${recipe && recipe.photo ? recipe.photo : ''}" alt="" ${recipe && recipe.photo ? '' : 'hidden'}>
          <div id="photo-placeholder" class="photo-placeholder" ${recipe && recipe.photo ? 'hidden' : ''}>No photo</div>
          <div class="photo-actions">
            <label class="btn secondary" for="f-photo">Choose Photo</label>
            <input type="file" id="f-photo" accept="image/*" hidden>
            <button type="button" id="remove-photo" class="btn text" ${recipe && recipe.photo ? '' : 'hidden'}>Remove</button>
          </div>
        </div>
      </div>

      <div class="field">
        <span>Ingredients</span>
        <div id="ingredients" class="ingredients"></div>
        <button type="button" id="add-ingredient" class="btn secondary small">+ Add ingredient</button>
        <p class="hint">Tip: use the same name and unit across recipes (e.g. always "onion", not sometimes "onions") so quantities combine on the shopping list.</p>
      </div>

      <label class="field">
        <span>Instructions</span>
        <textarea id="f-instructions" rows="6" placeholder="Step-by-step instructions">${recipe ? escapeHtml(recipe.instructions || '') : ''}</textarea>
      </label>

      <div class="form-actions">
        <button type="submit" class="btn primary">Save Recipe</button>
        <button type="button" id="cancel-btn" class="btn secondary">Cancel</button>
        ${editing ? `<button type="button" id="delete-btn" class="btn danger">Delete Recipe</button>` : ''}
      </div>
    </form>
    <datalist id="unit-options">
      ${COMMON_UNITS.map((u) => `<option value="${u}">`).join('')}
    </datalist>
  `;

  const ingredientsEl = document.getElementById('ingredients');
  const initialIngredients = recipe && recipe.ingredients.length ? recipe.ingredients : [{ qty: '', unit: '', name: '' }];
  initialIngredients.forEach((ing) => addIngredientRow(ingredientsEl, ing));

  document.getElementById('add-ingredient').addEventListener('click', () => {
    addIngredientRow(ingredientsEl, { qty: '', unit: '', name: '' });
  });

  ingredientsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.remove-ingredient');
    if (!btn) return;
    const row = btn.closest('.ingredient-row');
    if (ingredientsEl.children.length > 1) {
      row.remove();
    } else {
      row.querySelectorAll('input').forEach((i) => (i.value = ''));
    }
  });

  let photoDataUrl = recipe ? recipe.photo || null : null;
  const photoInput = document.getElementById('f-photo');
  const photoPreview = document.getElementById('photo-preview');
  const photoPlaceholder = document.getElementById('photo-placeholder');
  const removePhotoBtn = document.getElementById('remove-photo');

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files[0];
    if (!file) return;
    try {
      photoDataUrl = await compressImage(file);
      photoPreview.src = photoDataUrl;
      photoPreview.hidden = false;
      photoPlaceholder.hidden = true;
      removePhotoBtn.hidden = false;
    } catch (err) {
      console.error(err);
      showToast('Could not load that photo');
    }
  });

  removePhotoBtn.addEventListener('click', () => {
    photoDataUrl = null;
    photoInput.value = '';
    photoPreview.hidden = true;
    photoPlaceholder.hidden = false;
    removePhotoBtn.hidden = true;
  });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    location.hash = '#/';
  });

  if (editing) {
    document.getElementById('delete-btn').addEventListener('click', async () => {
      if (!confirm(`Delete "${recipe.name}"? This can't be undone.`)) return;
      await DB.deleteRecipe(id);
      const plan = await DB.getWeekPlan();
      if (plan.selectedIds.includes(id)) {
        plan.selectedIds = plan.selectedIds.filter((x) => x !== id);
        await DB.putWeekPlan(plan);
      }
      showToast('Recipe deleted');
      location.hash = '#/';
    });
  }

  document.getElementById('recipe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('f-name').value.trim();
    if (!name) return;

    const ingredients = Array.from(ingredientsEl.querySelectorAll('.ingredient-row'))
      .map((row) => ({
        qty: row.querySelector('.ing-qty').value.trim(),
        unit: row.querySelector('.ing-unit').value.trim(),
        name: row.querySelector('.ing-name').value.trim(),
      }))
      .filter((ing) => ing.name !== '');

    const instructions = document.getElementById('f-instructions').value.trim();

    const saved = {
      id: editing ? id : uuid(),
      name,
      photo: photoDataUrl,
      ingredients,
      instructions,
      createdAt: recipe ? recipe.createdAt : Date.now(),
    };
    await DB.putRecipe(saved);
    showToast(editing ? 'Recipe updated' : 'Recipe added');
    if (location.hash === '#/' || location.hash === '') render();
    else location.hash = '#/';
  });
}

function addIngredientRow(container, ing) {
  const row = document.createElement('div');
  row.className = 'ingredient-row';
  row.innerHTML = `
    <input type="text" class="ing-qty" placeholder="Qty" value="${escapeHtml(ing.qty)}" inputmode="decimal">
    <input type="text" class="ing-unit" placeholder="Unit" value="${escapeHtml(ing.unit)}" list="unit-options">
    <input type="text" class="ing-name" placeholder="Ingredient" value="${escapeHtml(ing.name)}">
    <button type="button" class="remove-ingredient" aria-label="Remove ingredient">&times;</button>
  `;
  container.appendChild(row);
}

function compressImage(file, maxDim = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Plan (pick meals) ----------
async function renderPlan() {
  setHeader('Pick Your Meals', '#/');
  const [recipes, plan] = await Promise.all([DB.getAllRecipes(), DB.getWeekPlan()]);
  const validIds = new Set(recipes.map((r) => r.id));
  let selected = plan.selectedIds.filter((id) => validIds.has(id));
  if (selected.length !== plan.selectedIds.length) {
    await DB.putWeekPlan({ selectedIds: selected });
  }

  if (recipes.length === 0) {
    viewEl.innerHTML = `<div class="empty-state"><p>You don't have any recipes yet.</p><p class="muted">Add some recipes first, then come back to plan your meals.</p></div>`;
    return;
  }

  viewEl.innerHTML = `
    <div class="plan-header">
      <div class="plan-count"><span id="count-num">${selected.length}</span> <span id="count-label">${selected.length === 1 ? 'meal' : 'meals'} selected</span></div>
      <p class="hint">Pick as many meals as you want (up to ${MAX_MEALS}) — a couple of nights out, or a full stretch with breakfasts too.</p>
    </div>
    <div class="pick-list">
      ${recipes.map((r) => pickRowHtml(r, selected.includes(r.id))).join('')}
    </div>
  `;

  bottomBar.hidden = false;
  const countNum = document.getElementById('count-num');
  const countLabel = document.getElementById('count-label');
  const decideBtn = document.getElementById('decide-btn');
  decideBtn.disabled = selected.length === 0;
  decideBtn.textContent = selected.length ? `Decided! (${selected.length})` : 'Decided!';

  function updateDecideBtn() {
    decideBtn.disabled = selected.length === 0;
    decideBtn.textContent = selected.length ? `Decided! (${selected.length})` : 'Decided!';
    countNum.textContent = selected.length;
    countLabel.textContent = (selected.length === 1 ? 'meal' : 'meals') + ' selected';
  }

  viewEl.querySelectorAll('.pick-row').forEach((row) => {
    row.addEventListener('click', async (e) => {
      if (e.target.closest('.pick-row-link')) return;
      const id = row.dataset.id;
      const checkbox = row.querySelector('input[type="checkbox"]');
      const isChecked = checkbox.checked;
      if (!isChecked && selected.length >= MAX_MEALS) {
        showToast(`You can plan up to ${MAX_MEALS} meals at a time.`);
        return;
      }
      checkbox.checked = !isChecked;
      row.classList.toggle('selected', checkbox.checked);
      selected = checkbox.checked ? [...selected, id] : selected.filter((x) => x !== id);
      updateDecideBtn();
      await DB.putWeekPlan({ selectedIds: selected });
    });
  });

  decideBtn.onclick = async () => {
    if (selected.length === 0) return;
    await generateShoppingList(selected);
    showToast('Shopping list ready');
    location.hash = '#/shopping';
  };
}

function pickRowHtml(r, isSelected) {
  const thumb = r.photo
    ? `<img class="pick-thumb" src="${r.photo}" alt="">`
    : `<div class="pick-thumb placeholder" aria-hidden="true">🍽️</div>`;
  return `
    <div class="pick-row ${isSelected ? 'selected' : ''}" data-id="${r.id}">
      <input type="checkbox" ${isSelected ? 'checked' : ''} tabindex="-1" aria-hidden="true">
      ${thumb}
      <span class="pick-name">${escapeHtml(r.name)}</span>
      <a class="pick-row-link" href="#/recipes/${r.id}" aria-label="View recipe">›</a>
    </div>
  `;
}

// ---------- Shopping list ----------
function parseQuantity(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  return null;
}

function formatQty(n) {
  const rounded = Math.round(n * 100) / 100;
  return String(rounded);
}

function normalizeUnit(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (!s) return '';
  return UNIT_LOOKUP[s] || s;
}

function normalizeName(raw) {
  return (raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function generateShoppingList(recipeIds) {
  const recipes = await Promise.all(recipeIds.map((id) => DB.getRecipe(id)));
  const groups = new Map();

  for (const recipe of recipes) {
    if (!recipe) continue;
    for (const ing of recipe.ingredients) {
      const nameKey = normalizeName(ing.name);
      const unitKey = normalizeUnit(ing.unit);
      if (!nameKey) continue;
      const key = nameKey + '|' + unitKey;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          displayName: ing.name.trim(),
          unit: unitKey,
          numericTotal: 0,
          hasNumeric: false,
          notes: [],
          sources: new Set(),
        });
      }
      const g = groups.get(key);
      g.sources.add(recipe.name);
      const parsed = parseQuantity(ing.qty);
      if (parsed !== null) {
        g.numericTotal += parsed;
        g.hasNumeric = true;
      } else if (ing.qty && ing.qty.trim()) {
        g.notes.push(ing.qty.trim());
      }
    }
  }

  const previousList = await DB.getShoppingList();
  const previousChecked = new Map();
  if (previousList) {
    for (const item of previousList.items) previousChecked.set(item.key, item.checked);
  }

  const items = Array.from(groups.values())
    .map((g) => {
      const parts = [];
      if (g.hasNumeric) parts.push(formatQty(g.numericTotal) + (g.unit ? ' ' + g.unit : ''));
      const uniqueNotes = [...new Set(g.notes)];
      if (uniqueNotes.length) parts.push(uniqueNotes.join(', '));
      return {
        key: g.key,
        name: g.displayName,
        quantityLabel: parts.join(' + '),
        sources: [...g.sources].sort(),
        checked: previousChecked.get(g.key) || false,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  await DB.putShoppingList({
    items,
    generatedAt: Date.now(),
    sourceRecipeIds: recipeIds,
    sourceRecipeNames: recipes.filter(Boolean).map((r) => r.name),
  });
}

async function renderShopping() {
  setHeader('Shopping List', '#/');
  const list = await DB.getShoppingList();

  if (!list || list.items.length === 0) {
    viewEl.innerHTML = `
      <div class="empty-state">
        <p>No shopping list yet.</p>
        <p class="muted">Pick your meals to generate one.</p>
        <a class="btn primary" href="#/plan">Start Planning</a>
      </div>
    `;
    return;
  }

  const checkedCount = list.items.filter((i) => i.checked).length;

  viewEl.innerHTML = `
    <div class="shopping-header">
      <div class="week-menu">
        <span class="muted">Meals in this list:</span>
        <div class="chip-row">
          ${list.sourceRecipeNames.map((n) => `<span class="chip">${escapeHtml(n)}</span>`).join('')}
        </div>
      </div>
      <div class="shopping-progress">${checkedCount} / ${list.items.length} checked</div>
    </div>
    <ul class="shopping-list">
      ${list.items.map(shoppingItemHtml).join('')}
    </ul>
    <div class="form-actions">
      <button id="regen-btn" class="btn secondary">Regenerate from Selected Meals</button>
      <button id="reset-checks-btn" class="btn text">Uncheck All</button>
    </div>
  `;

  viewEl.querySelectorAll('.shopping-item').forEach((li) => {
    li.addEventListener('click', async () => {
      const key = li.dataset.key;
      const item = list.items.find((i) => i.key === key);
      item.checked = !item.checked;
      li.classList.toggle('checked', item.checked);
      li.querySelector('input[type="checkbox"]').checked = item.checked;
      await DB.putShoppingList(list);
      const nowChecked = list.items.filter((i) => i.checked).length;
      viewEl.querySelector('.shopping-progress').textContent = `${nowChecked} / ${list.items.length} checked`;
    });
  });

  document.getElementById('regen-btn').addEventListener('click', async () => {
    if (!list.sourceRecipeIds || list.sourceRecipeIds.length === 0) return;
    await generateShoppingList(list.sourceRecipeIds);
    showToast('Shopping list refreshed');
    render();
  });

  document.getElementById('reset-checks-btn').addEventListener('click', async () => {
    list.items.forEach((i) => (i.checked = false));
    await DB.putShoppingList(list);
    render();
  });
}

function shoppingItemHtml(item) {
  const sourceNote = item.sources.length > 1 ? `<span class="item-sources">${item.sources.map(escapeHtml).join(', ')}</span>` : '';
  return `
    <li class="shopping-item ${item.checked ? 'checked' : ''}" data-key="${escapeHtml(item.key)}">
      <input type="checkbox" ${item.checked ? 'checked' : ''} tabindex="-1" aria-hidden="true">
      <div class="item-text">
        <span class="item-name">${escapeHtml(item.name)}</span>
        ${item.quantityLabel ? `<span class="item-qty">${escapeHtml(item.quantityLabel)}</span>` : ''}
        ${sourceNote}
      </div>
    </li>
  `;
}

// ---------- PWA install prompt ----------
let deferredInstallPrompt = null;
const installBtn = document.getElementById('install-btn');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  installBtn.hidden = true;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

window.addEventListener('appinstalled', () => {
  installBtn.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch((err) => console.error('SW registration failed', err));
  });
}

// ---------- Init ----------
(async function init() {
  await seedIfEmpty();
  render();
})();
