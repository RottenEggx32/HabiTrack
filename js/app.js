/**
 * app.js
 * ---------------------------------------------------------
 * Toda la lógica de la pantalla principal. Trabaja sobre los
 * arrays `habits` y `habit_logs` de mockData.js como si fueran
 * la base de datos. En Fase 2, este archivo casi no cambia:
 * solo cambiará CÓMO llegan `habits`/`habit_logs` (fetch a
 * Supabase en vez de un array ya cargado en memoria).
 * ---------------------------------------------------------
 */

const habitListEl = document.getElementById('habitList');
const emptyStateEl = document.getElementById('emptyState');
const todayLabelEl = document.getElementById('todayLabel');
const newHabitBtn = document.getElementById('newHabitBtn');

// --- Elementos de la franja de resumen ---
const overviewGridEl = document.getElementById('overviewGrid');
const overviewFractionEl = document.getElementById('overviewFraction');
const overviewMonthLabelEl = document.getElementById('overviewMonthLabel');
const prevMonthBtn = document.getElementById('prevMonthBtn');
const nextMonthBtn = document.getElementById('nextMonthBtn');

// --- Elementos del modal crear/editar ---
const habitModal = document.getElementById('habitModal');
const habitForm = document.getElementById('habitForm');
const habitModalTitle = document.getElementById('habitModalTitle');
const habitNameInput = document.getElementById('habitName');
const submitHabitBtn = document.getElementById('submitHabitBtn');
const deleteHabitBtn = document.getElementById('deleteHabitBtn');
const cancelHabitBtn = document.getElementById('cancelHabitBtn');

// --- Toast de refuerzo ---
const toastEl = document.getElementById('toast');
let toastTimer = null;
const STREAK_MILESTONES = [7, 30, 100];

const TODAY = isoDateOffset(0);

// Mes que se está mostrando actualmente en el calendario.
// Empieza en el mes de hoy; navegar con las flechas lo cambia.
let overviewYear = new Date().getFullYear();
let overviewMonth = new Date().getMonth(); // 0 = enero

// Metadatos de cada nivel de prioridad: orden de las secciones,
// etiqueta visible y color semántico (no decorativo — el color
// aquí SÍ significa algo: urgencia).
const PRIORITY_GROUPS = [
  { value: 'high', label: 'Alta prioridad' },
  { value: 'medium', label: 'Media prioridad' },
  { value: 'low', label: 'Baja prioridad' },
];

// Guarda el id del hábito que se está editando; null = modo "crear".
let editingHabitId = null;

/**
 * Devuelve true si el hábito tiene un registro completado
 * en la fecha indicada.
 */
function isCompletedOn(habitId, dateStr) {
  return habit_logs.some(
    (log) => log.habit_id === habitId && log.completed_date === dateStr
  );
}

/**
 * ¿Se usó el comodín exactamente en esta fecha para este hábito?
 */
function hasWildcardOn(habitId, dateStr) {
  return habit_wildcards.some(
    (w) => w.habit_id === habitId && w.used_date === dateStr
  );
}

/**
 * ¿Ya se gastó el comodín de ESTA semana para este hábito
 * (en cualquier día de la semana, no solo hoy)?
 * Solo se permite uno por semana.
 */
function isWeekWildcardUsed(habitId, dateStr) {
  const weekKey = getIsoWeekKey(dateStr);
  return habit_wildcards.some(
    (w) => w.habit_id === habitId && w.week_key === weekKey
  );
}

/**
 * Un día "cuenta" para la racha si el hábito se cumplió de
 * verdad, O si ese día específico fue cubierto con el comodín.
 */
function dayCountsForStreak(habitId, dateStr) {
  return isCompletedOn(habitId, dateStr) || hasWildcardOn(habitId, dateStr);
}

/**
 * Calcula la racha ACTUAL de un hábito diario. Un día cuenta
 * si se cumplió de verdad, O si ese día se cubrió con el
 * comodín (guardado explícitamente por el usuario en
 * habit_wildcards — no se detecta solo, hay que haberlo usado).
 */
function calculateDailyStreak(habitId) {
  let streak = 0;
  let offset = dayCountsForStreak(habitId, TODAY) ? 0 : -1;

  while (dayCountsForStreak(habitId, isoDateOffset(offset))) {
    streak++;
    offset--;
  }

  return streak;
}

/**
 * Para hábitos semanales: cuenta semanas ISO consecutivas con
 * al menos un registro. Simplificado por ahora; lo afinamos en
 * Fase 3 junto con el "día comodín".
 */
function calculateWeeklyStreak(habitId) {
  const completedWeeks = new Set(
    habit_logs
      .filter((log) => log.habit_id === habitId)
      .map((log) => getIsoWeekKey(log.completed_date))
  );

  let streak = 0;
  let weekOffset = 0;

  while (completedWeeks.has(getIsoWeekKey(isoDateOffset(weekOffset * 7)))) {
    streak++;
    weekOffset--;
  }

  return streak;
}

function getIsoWeekKey(dateStr) {
  const d = new Date(dateStr);
  const year = d.getUTCFullYear();
  const firstJan = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(((d - firstJan) / 86400000 + firstJan.getUTCDay() + 1) / 7);
  return `${year}-W${week}`;
}

function calculateStreak(habit) {
  return habit.frequency === 'daily'
    ? calculateDailyStreak(habit.id)
    : calculateWeeklyStreak(habit.id);
}

/**
 * Muestra un mensaje flotante breve (3 segundos) y se oculta solo.
 * role="status" + aria-live ya están en el HTML, así que un
 * lector de pantalla también lo anuncia sin que hagamos nada más.
 */
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('toast--visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('toast--visible');
  }, 3000);
}

/**
 * Revisa si la racha actual de un hábito cayó justo en un hito
 * (7, 30, 100...) y si es así, celebra con el toast. Solo aplica
 * a hábitos diarios, que es donde tienen sentido esos números.
 */
function checkStreakMilestone(habitId) {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit || habit.frequency !== 'daily') return;

  const streak = calculateDailyStreak(habit.id);
  if (STREAK_MILESTONES.includes(streak)) {
    showToast(`🔥 ¡${streak} días seguidos con "${habit.name}"!`);
  }
}

/**
 * Marca o desmarca un hábito como cumplido HOY.
 * Si ya estaba marcado, quita el log (permite corregir un error).
 */
function toggleHabitToday(habitId) {
  const existingIndex = habit_logs.findIndex(
    (log) => log.habit_id === habitId && log.completed_date === TODAY
  );

  if (existingIndex >= 0) {
    habit_logs.splice(existingIndex, 1);
  } else {
    habit_logs.push({
      id: `l-${Date.now()}`,
      habit_id: habitId,
      completed_date: TODAY,
      created_at: TODAY,
    });
    checkStreakMilestone(habitId);
  }

  renderHabits();
}

/**
 * Usa (o deshace) el comodín de HOY para un hábito.
 * Solo tiene efecto si el hábito es diario, no está cumplido
 * hoy, y no se ha usado ya el comodín de esta semana.
 */
function toggleWildcardToday(habitId) {
  const existingIndex = habit_wildcards.findIndex(
    (w) => w.habit_id === habitId && w.used_date === TODAY
  );

  if (existingIndex >= 0) {
    habit_wildcards.splice(existingIndex, 1);
  } else {
    habit_wildcards.push({
      id: `w-${Date.now()}`,
      habit_id: habitId,
      week_key: getIsoWeekKey(TODAY),
      used_date: TODAY,
      created_at: TODAY,
    });
    checkStreakMilestone(habitId);
  }

  renderHabits();
}

function createHabitCard(habit) {
  const done = isCompletedOn(habit.id, TODAY);
  const streak = calculateStreak(habit);
  const wildcardToday = hasWildcardOn(habit.id, TODAY);
  const weekWildcardUsed = isWeekWildcardUsed(habit.id, TODAY);

  const card = document.createElement('article');
  card.className = `habit-card${done ? ' habit-card--done' : ''}`;

  const mainRow = document.createElement('div');
  mainRow.className = 'habit-card__main';

  const toggle = document.createElement('button');
  toggle.className = `habit-toggle${done ? ' habit-toggle--done' : ''}`;
  toggle.setAttribute('aria-pressed', String(done));
  toggle.setAttribute('aria-label', `Marcar "${habit.name}" como cumplido hoy`);
  toggle.innerHTML = `
    <svg class="habit-toggle__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
      <path d="M4 12l5 5L20 6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
  toggle.addEventListener('click', () => toggleHabitToday(habit.id));

  const info = document.createElement('div');
  info.className = 'habit-info';
  info.setAttribute('role', 'button');
  info.setAttribute('tabindex', '0');
  info.setAttribute('aria-label', `Editar "${habit.name}"`);
  info.innerHTML = `
    <p class="habit-info__name">
      <span class="habit-info__name-text">${habit.name}</span>
    </p>
    <p class="habit-info__frequency">${habit.frequency === 'daily' ? 'Diario' : 'Semanal'}</p>
  `;
  info.addEventListener('click', () => openEditModal(habit));
  info.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEditModal(habit);
    }
  });

  const streakBadge = document.createElement('div');
  streakBadge.className = `habit-streak${streak === 0 ? ' habit-streak--zero' : ''}`;
  streakBadge.innerHTML = `
    <span aria-hidden="true">${streak > 0 ? '🔥' : ''}</span>
    <span class="habit-streak__count">${streak}</span>
  `;

  mainRow.append(toggle, info, streakBadge);
  card.appendChild(mainRow);

  // --- Fila del comodín: solo aparece cuando tiene sentido ---
  // Diario, y (ya está cubierto hoy) O (falta hoy Y todavía queda
  // el comodín de esta semana sin usar).
  const showWildcardRow =
    habit.frequency === 'daily' && (wildcardToday || (!done && !weekWildcardUsed));

  if (showWildcardRow) {
    const wildcardRow = document.createElement('div');
    wildcardRow.className = 'habit-card__extra';

    const wildcardBtn = document.createElement('button');
    wildcardBtn.type = 'button';
    wildcardBtn.className = `wildcard-btn${wildcardToday ? ' wildcard-btn--active' : ''}`;
    wildcardBtn.textContent = wildcardToday
      ? '🃏 Comodín usado hoy — deshacer'
      : '🃏 Usar comodín de esta semana';
    wildcardBtn.addEventListener('click', () => toggleWildcardToday(habit.id));

    wildcardRow.appendChild(wildcardBtn);
    card.appendChild(wildcardRow);
  }

  return card;
}

/**
 * Renderiza la lista agrupada en 3 secciones ("ventanitas"):
 * Alta, Media y Baja prioridad, en ese orden. Una sección solo
 * aparece si tiene al menos un hábito — así evitamos mostrar
 * encabezados vacíos.
 */
function renderHabits() {
  habitListEl.innerHTML = '';

  if (habits.length === 0) {
    emptyStateEl.hidden = false;
    renderOverview();
    return;
  }

  emptyStateEl.hidden = true;

  PRIORITY_GROUPS.forEach((group) => {
    const habitsInGroup = habits.filter((h) => h.priority === group.value);
    if (habitsInGroup.length === 0) return;

    const section = document.createElement('section');
    section.className = 'priority-group';

    const header = document.createElement('div');
    header.className = 'priority-group__header';
    header.innerHTML = `
      <span class="priority-group__dot" style="background:var(--priority-${group.value})"></span>
      <span class="priority-group__label">${group.label}</span>
      <span class="priority-group__count">${habitsInGroup.length}</span>
    `;

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'priority-group__cards';
    habitsInGroup.forEach((habit) => {
      cardsWrap.appendChild(createHabitCard(habit));
    });

    section.append(header, cardsWrap);
    habitListEl.appendChild(section);
  });

  renderOverview();
}

function renderTodayLabel() {
  const formatted = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  todayLabelEl.textContent = formatted;
}

/**
 * =========================================
 * Calendario de constancia ("Tu constancia")
 * =========================================
 * Un mes a la vez, navegable con flechas, como cualquier app
 * de calendario. Cada casilla es un día real del mes con su
 * número; el relleno verde es AGREGADO (qué % de tus hábitos
 * cumpliste ese día), no por hábito individual — así cabe
 * como una franja compacta en vez de una pantalla aparte.
 */

// Igual que isoDateOffset, pero a partir de un objeto Date
// específico en vez de "hoy + offset". Usa el mismo método
// (toISOString) para que las fechas siempre calcen entre sí.
function formatDateYMD(dateObj) {
  return dateObj.toISOString().split('T')[0];
}

function buildMonthCells(year, month) {
  const totalHabits = habits.length;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // getDay() da 0=domingo..6=sábado; lo convertimos a 0=lunes..6=domingo
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells = [];

  // Casillas vacías antes del día 1, para alinear con la fila de L-D
  for (let i = 0; i < firstWeekday; i++) cells.push(null);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateYMD(new Date(year, month, day));
    const doneCount = habits.filter((h) => isCompletedOn(h.id, dateStr)).length;
    cells.push({
      day,
      dateStr,
      ratio: totalHabits > 0 ? doneCount / totalHabits : 0,
      isFuture: dateStr > TODAY,
      isToday: dateStr === TODAY,
    });
  }

  return cells;
}

function renderCalendarLabel() {
  const label = new Date(overviewYear, overviewMonth, 1).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });
  overviewMonthLabelEl.textContent = label;

  // No tiene sentido navegar a meses futuros: no hay datos que mostrar ahí.
  const today = new Date();
  const isCurrentMonth =
    overviewYear === today.getFullYear() && overviewMonth === today.getMonth();
  nextMonthBtn.disabled = isCurrentMonth;
}

function renderOverview() {
  renderCalendarLabel();

  const total = habits.length;
  const doneToday = habits.filter((h) => isCompletedOn(h.id, TODAY)).length;
  overviewFractionEl.textContent = total > 0 ? `${doneToday}/${total} hoy` : '';

  const cells = buildMonthCells(overviewYear, overviewMonth);

  overviewGridEl.innerHTML = cells
    .map((cell) => {
      if (!cell) return '<div class="overview__cell overview__cell--empty"></div>';

      const classes = ['overview__cell'];
      if (cell.ratio > 0) classes.push('overview__cell--filled');
      if (cell.isFuture) classes.push('overview__cell--future');
      if (cell.isToday) classes.push('overview__cell--today');

      // Opacidad mínima de 35% para que "al menos un hábito cumplido"
      // no se vea igual de tenue que un día totalmente vacío.
      const style = cell.ratio > 0
        ? `background:var(--mint);opacity:${(0.35 + cell.ratio * 0.65).toFixed(2)}`
        : '';

      return `<div class="${classes.join(' ')}" style="${style}" title="${cell.dateStr}">${cell.day}</div>`;
    })
    .join('');
}

prevMonthBtn.addEventListener('click', () => {
  overviewMonth--;
  if (overviewMonth < 0) {
    overviewMonth = 11;
    overviewYear--;
  }
  renderOverview();
});

nextMonthBtn.addEventListener('click', () => {
  overviewMonth++;
  if (overviewMonth > 11) {
    overviewMonth = 0;
    overviewYear++;
  }
  renderOverview();
});

function openCreateModal() {
  editingHabitId = null;
  habitForm.reset();
  habitModalTitle.textContent = 'Nuevo hábito';
  submitHabitBtn.textContent = 'Crear hábito';
  deleteHabitBtn.hidden = true;
  habitModal.showModal();
  habitNameInput.focus();
}

function openEditModal(habit) {
  editingHabitId = habit.id;
  habitNameInput.value = habit.name;
  habitForm.querySelector(`input[name="frequency"][value="${habit.frequency}"]`).checked = true;
  habitForm.querySelector(`input[name="priority"][value="${habit.priority}"]`).checked = true;

  habitModalTitle.textContent = 'Editar hábito';
  submitHabitBtn.textContent = 'Guardar cambios';
  deleteHabitBtn.hidden = false;
  habitModal.showModal();
  habitNameInput.focus();
}

function closeHabitModal() {
  habitModal.close();
}

habitForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = habitNameInput.value.trim();
  const frequency = habitForm.querySelector('input[name="frequency"]:checked').value;
  const priority = habitForm.querySelector('input[name="priority"]:checked').value;

  if (editingHabitId) {
    // --- Actualizar hábito existente ---
    const habit = habits.find((h) => h.id === editingHabitId);
    habit.name = name;
    habit.frequency = frequency;
    habit.priority = priority;
  } else {
    // --- Crear hábito nuevo ---
    habits.push({
      id: `h-${Date.now()}`,
      user_id: 'demo-user',
      name,
      frequency,
      priority,
      created_at: TODAY,
    });
  }

  closeHabitModal();
  renderHabits();
});

deleteHabitBtn.addEventListener('click', () => {
  if (!editingHabitId) return;
  if (!confirm('¿Eliminar este hábito y todo su historial?')) return;

  const habitIndex = habits.findIndex((h) => h.id === editingHabitId);
  habits.splice(habitIndex, 1);

  // También limpiamos sus logs y comodines, para no dejar registros huérfanos.
  for (let i = habit_logs.length - 1; i >= 0; i--) {
    if (habit_logs[i].habit_id === editingHabitId) {
      habit_logs.splice(i, 1);
    }
  }
  for (let i = habit_wildcards.length - 1; i >= 0; i--) {
    if (habit_wildcards[i].habit_id === editingHabitId) {
      habit_wildcards.splice(i, 1);
    }
  }

  closeHabitModal();
  renderHabits();
});

cancelHabitBtn.addEventListener('click', closeHabitModal);
newHabitBtn.addEventListener('click', openCreateModal);

renderTodayLabel();
renderHabits();