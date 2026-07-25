
// Simple PWA Baby Feed Tracker
// Data model: days[isoDate] = { note: string, entries: [entry] }

const STORAGE_KEY = 'babyFeedDaysV1';

let days = {}; // object keyed by ISO date
let currentDate = startOfDay(new Date());

const dom = {
  currentDate: document.getElementById('currentDate'),
  prevDay: document.getElementById('prevDay'),
  nextDay: document.getElementById('nextDay'),
  notes: document.getElementById('dayNotes'),
  entriesContainer: document.getElementById('entriesContainer'),
  addEntryBtn: document.getElementById('addEntryBtn'),
};

init();

function init() {
  loadFromStorage();
  ensureDayExists(currentDate);
  wireEvents();
  renderDay(currentDate);
}

function wireEvents() {
  dom.prevDay.addEventListener('click', () => changeDay(-1));
  dom.nextDay.addEventListener('click', () => changeDay(1));

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

  // Basic swipe support on mobile
  let touchStartX = null;
  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });
  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const threshold = 50; // px
    if (dx > threshold) {
      changeDay(-1); // swipe right -> previous day
    } else if (dx < -threshold) {
      changeDay(1); // swipe left -> next day
    }
    touchStartX = null;
  });
}

function changeDay(delta) {
  currentDate = addDays(currentDate, delta);
  ensureDayExists(currentDate);
  renderDay(currentDate);
}

function renderDay(date) {
  const iso = toIsoDate(date);
  const day = getDay(date);

  dom.currentDate.textContent = formatHumanDate(date);
  dom.notes.value = day.note || '';

  dom.entriesContainer.innerHTML = '';
  day.entries.forEach((entry, index) => {
    const card = renderEntryCard(entry, index);
    dom.entriesContainer.appendChild(card);
  });
}

function renderEntryCard(entry, index) {
  const card = document.createElement('div');
  card.className = 'entry-card';

  // Time + quantity row
  const row1 = document.createElement('div');
  row1.className = 'entry-row';

  const timeLabel = document.createElement('label');
  timeLabel.textContent = 'Time';
  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.value = toTimeString(new Date(entry.time));
  timeInput.addEventListener('change', () => {
    const day = getDay(currentDate);
    const e = day.entries[index];
    e.time = fromTimeString(timeInput.value, currentDate).toISOString();
    saveToStorage();
  });

  const qtyLabel = document.createElement('label');
  qtyLabel.textContent = 'Quantity (ml)';
  const qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.min = '0';
  qtyInput.max = '500';
  qtyInput.step = '10';
  qtyInput.value = entry.amountMl ?? 0;
  qtyInput.addEventListener('change', () => {
    const day = getDay(currentDate);
    const e = day.entries[index];
    e.amountMl = parseInt(qtyInput.value || '0', 10);
    saveToStorage();
  });

  const leftCol = document.createElement('div');
  leftCol.style.flex = '1';
  leftCol.appendChild(timeLabel);
  leftCol.appendChild(timeInput);

  const rightCol = document.createElement('div');
  rightCol.style.flex = '1';
  rightCol.appendChild(qtyLabel);
  rightCol.appendChild(qtyInput);

  row1.appendChild(leftCol);
  row1.appendChild(rightCol);

  // Type row
  const row2 = document.createElement('div');
  row2.className = 'entry-row';

  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Type';
  const typeSelect = document.createElement('select');
  ['breast', 'formula'].forEach((type) => {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type === 'breast' ? 'Breast' : 'Formula';
    typeSelect.appendChild(opt);
  });
  typeSelect.value = entry.type || 'breast';
  typeSelect.addEventListener('change', () => {
    const day = getDay(currentDate);
    const e = day.entries[index];
    e.type = typeSelect.value;
    saveToStorage();
  });

  const typeCol = document.createElement('div');
  typeCol.style.flex = '1';
  typeCol.appendChild(typeLabel);
  typeCol.appendChild(typeSelect);

  row2.appendChild(typeCol);

  // Checkboxes row
  const row3 = document.createElement('div');
  row3.className = 'checkbox-row';

  const checks = [
    { key: 'puked', label: 'Puked' },
    { key: 'peed', label: 'Peed' },
    { key: 'pooped', label: 'Pooped' },
  ];

  checks.forEach(({ key, label }) => {
    const wrapper = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!entry[key];
    cb.addEventListener('change', () => {
      const day = getDay(currentDate);
      const e = day.entries[index];
      e[key] = cb.checked;
      saveToStorage();
    });
    wrapper.appendChild(cb);
    wrapper.appendChild(document.createTextNode(label));
    row3.appendChild(wrapper);
  });

  card.appendChild(row1);
  card.appendChild(row2);
  card.appendChild(row3);

  return card;
}

// Data helpers

function createEmptyEntry() {
  const now = new Date();
  return {
    time: now.toISOString(),
    amountMl: 0,
    type: 'breast',
    puked: false,
    peed: false,
    pooped: false,
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
    days = parsed || {};
  } catch (err) {
    console.error('Failed to load storage', err);
    days = {};
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
  } catch (err) {
    console.error('Failed to save storage', err);
  }
}

// Date helpers

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
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
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
  d.setHours(h, m, 0, 0);
  return d;
}

// PWA basics
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .catch((err) => console.error('SW registration failed', err));
  });
}
