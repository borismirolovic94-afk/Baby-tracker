const STORAGE_KEY = 'babyFeedDaysV2';
const THEME_KEY = 'babyFeedThemeV1';
const HUE_KEY = 'babyFeedThemeHueV1';

let days = {};
let currentDate = startOfDay(new Date());

const dom = {
  currentDate: document.getElementById('currentDate'),
  dayTotal: document.getElementById('dayTotal'),
  prevDay: document.getElementById('prevDay'),
  nextDay: document.getElementById('nextDay'),
  notes: document.getElementById('dayNotes'),
  entriesContainer: document.getElementById('entriesContainer'),
  addEntryBtn: document.getElementById('addEntryBtn'),
  themeToggle: document.getElementById('themeToggle'),
  themeSelect: document.getElementById('themeSelect'),
};

init();

function init() {
  applyInitialTheme();
  applyInitialHue();
  loadFromStorage();
  ensureDayExists(currentDate);
  wireEvents();
  renderDay(currentDate);
}

function wireEvents() {
  dom.prevDay.addEventListener('click', () => changeDay(-1));
  dom.nextDay.addEventListener('click', () => changeDay(1));

  dom.themeToggle.addEventListener('click', toggleTheme);
  dom.themeSelect.addEventListener('change', (e) => setHue(e.target.value));

  dom.notes.addEventListener('input', () => {
    const day = getDay(currentDate);
    day.note = dom.notes.value;
    saveToStorage();
  });

  dom.addEntryBtn.addEventListener('click', () => {
    const day = getDay(currentDate);
    day.entries.push(createEmptyEntry());
    saveToStorage();
    renderDay(currentDate);
  });

  let touchStartX = null;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });
  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const threshold = 50;
    if (dx > threshold) changeDay(-1);
    else if (dx < -threshold) changeDay(1);
    touchStartX = null;
  });
}

function applyInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  setTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  dom.themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  dom.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}

function applyInitialHue() {
  const savedHue = localStorage.getItem(HUE_KEY) || 'rose';
  setHue(savedHue);
  dom.themeSelect.value = savedHue;
}

function setHue(hue) {
  document.documentElement.setAttribute('data-theme-hue', hue);
  localStorage.setItem(HUE_KEY, hue);
}

function changeDay(delta) {
  currentDate = addDays(currentDate, delta);
  ensureDayExists(currentDate);
  renderDay(currentDate);
}

function renderDay(date) {
  const day = getDay(date);
  dom.currentDate.textContent = formatHumanDate(date);
  dom.dayTotal.textContent = `Total today: ${calculateDayTotal(day)} ml`;
  dom.notes.value = day.note || '';
  dom.entriesContainer.innerHTML = '';
  day.entries.forEach((entry, index) => {
    dom.entriesContainer.appendChild(renderEntryCard(entry, index));
  });
}

function renderEntryCard(entry, index) {
  const card = document.createElement('div');
  card.className = 'entry-card';

  const row1 = document.createElement('div');
  row1.className = 'entry-grid-row1';

  row1.appendChild(createInputField('Time', 'time', toTimeString(new Date(entry.time)), (value) => {
    getDay(currentDate).entries[index].time = fromTimeString(value, currentDate).toISOString();
    saveToStorage();
  }));

  row1.appendChild(createInputField('Quantity (ml)', 'number', entry.amountMl ?? 0, (value) => {
    getDay(currentDate).entries[index].amountMl = clamp(parseInt(value || '0', 10), 0, 500);
    saveToStorage();
    renderDay(currentDate);
  }, { min: 0, max: 500, step: 10 }));

  row1.appendChild(createSelectField('Type', ['breast', 'formula'], entry.type || 'breast', (value) => {
    getDay(currentDate).entries[index].type = value;
    saveToStorage();
  }));

  const row2 = document.createElement('div');
  row2.className = 'entry-grid-row2';

  row2.appendChild(createCheckboxField('Pee', !!entry.pee, (checked) => {
    getDay(currentDate).entries[index].pee = checked;
    saveToStorage();
  }));

  row2.appendChild(createCheckboxField('Poo', !!entry.poo, (checked) => {
    getDay(currentDate).entries[index].poo = checked;
    saveToStorage();
  }));

  row2.appendChild(createCheckboxField('Puke', !!entry.puke, (checked) => {
    getDay(currentDate).entries[index].puke = checked;
    saveToStorage();
  }));

  const row3 = document.createElement('div');
  row3.className = 'entry-grid-row3';

  row3.appendChild(createInputField('Temp (°C)', 'number', entry.temperature ?? '', (value) => {
    const parsed = value === '' ? '' : parseFloat(value);
    getDay(currentDate).entries[index].temperature = Number.isNaN(parsed) ? '' : parsed;
    saveToStorage();
  }, { min: 34, max: 43, step: 0.1 }));

  card.appendChild(row1);
  card.appendChild(row2);
  card.appendChild(row3);
  return card;
}

function createInputField(labelText, type, value, onChange, attrs = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('label');
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  Object.entries(attrs).forEach(([k, v]) => input.setAttribute(k, v));
  input.addEventListener('change', () => onChange(input.value));

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  return wrapper;
}

function createSelectField(labelText, options, selected, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('label');
  label.textContent = labelText;

  const select = document.createElement('select');
  options.forEach((optionValue) => {
    const opt = document.createElement('option');
    opt.value = optionValue;
    opt.textContent = optionValue.charAt(0).toUpperCase() + optionValue.slice(1);
    if (optionValue === selected) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => onChange(select.value));

  wrapper.appendChild(label);
  wrapper.appendChild(select);
  return wrapper;
}

function createCheckboxField(labelText, checked, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'check-field';

  const row = document.createElement('label');
  row.className = 'check-box';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));

  row.appendChild(input);
  row.appendChild(document.createTextNode(labelText));

  wrapper.appendChild(row);
  return wrapper;
}

function calculateDayTotal(day) {
  return (day.entries || []).reduce((sum, entry) => sum + (parseInt(entry.amountMl || 0, 10) || 0), 0);
}

function createEmptyEntry() {
  const now = new Date();
  return {
    time: now.toISOString(),
    amountMl: 0,
    type: 'breast',
    pee: false,
    poo: false,
    puke: false,
    temperature: ''
  };
}

function ensureDayExists(date) {
  const iso = toIsoDate(date);
  if (!days[iso]) {
    days[iso] = { note: '', entries: [] };
    saveToStorage();
  }
}

function getDay(date) {
  const iso = toIsoDate(date);
  ensureDayExists(date);
  return days[iso];
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    days = migrateData(parsed || {});
  } catch (err) {
    console.error('Failed to load storage', err);
    days = {};
  }
}

function migrateData(data) {
  Object.keys(data).forEach((dayKey) => {
    const day = data[dayKey];
    day.entries = (day.entries || []).map((entry) => ({
      time: entry.time || new Date().toISOString(),
      amountMl: entry.amountMl ?? 0,
      type: entry.type || 'breast',
      pee: entry.pee ?? entry.peed ?? false,
      poo: entry.poo ?? entry.pooped ?? false,
      puke: entry.puke ?? entry.puked ?? false,
      temperature: entry.temperature ?? ''
    }));
  });
  return data;
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  } catch (err) {
    console.error('Failed to save storage', err);
  }
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return startOfDay(d);
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatHumanDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function toTimeString(date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
}

function fromTimeString(timeStr, baseDate) {
  const [h, m] = timeStr.split(':').map((n) => parseInt(n, 10));
  const d = new Date(baseDate);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch((err) => console.error('SW registration failed', err));
  });
}
