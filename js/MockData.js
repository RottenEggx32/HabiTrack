/**
 * mockData.js
 * ---------------------------------------------------------
 * Simula las tablas "habits" y "habit_logs" de Supabase.
 * Misma forma de los campos que en el modelo real, para que
 * en Fase 2 solo cambiemos DE DÓNDE vienen estos datos
 * (fetch a Supabase) sin tocar nada de app.js.
 * ---------------------------------------------------------
 */

// Pequeño helper: devuelve una fecha en formato 'YYYY-MM-DD',
// desplazada `offsetDays` días desde hoy (negativo = pasado).
function isoDateOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// ---- Tabla: habits ----
const habits = [
  {
    id: 'h1',
    user_id: 'demo-user',
    name: 'Leer 20 minutos',
    frequency: 'daily',
    priority: 'medium',
    created_at: isoDateOffset(-15),
  },
  {
    id: 'h2',
    user_id: 'demo-user',
    name: 'Hacer ejercicio',
    frequency: 'daily',
    priority: 'high',
    created_at: isoDateOffset(-30),
  },
  {
    id: 'h3',
    user_id: 'demo-user',
    name: 'Meditar',
    frequency: 'daily',
    priority: 'low',
    created_at: isoDateOffset(-5),
  },
  {
    id: 'h4',
    user_id: 'demo-user',
    name: 'Repasar finanzas personales',
    frequency: 'weekly',
    priority: 'medium',
    created_at: isoDateOffset(-40),
  },
];

// ---- Tabla: habit_logs ----
// Un registro por cada día que el hábito SÍ se cumplió.
const habit_logs = [
  // h1 "Leer 20 minutos": racha activa de 5 días (hoy incluido)
  { id: 'l1', habit_id: 'h1', completed_date: isoDateOffset(0), created_at: isoDateOffset(0) },
  { id: 'l2', habit_id: 'h1', completed_date: isoDateOffset(-1), created_at: isoDateOffset(-1) },
  { id: 'l3', habit_id: 'h1', completed_date: isoDateOffset(-2), created_at: isoDateOffset(-2) },
  { id: 'l4', habit_id: 'h1', completed_date: isoDateOffset(-3), created_at: isoDateOffset(-3) },
  { id: 'l5', habit_id: 'h1', completed_date: isoDateOffset(-4), created_at: isoDateOffset(-4) },

  // h2 "Hacer ejercicio": racha larga de 12 días, todavía no marcado hoy
  { id: 'l6', habit_id: 'h2', completed_date: isoDateOffset(-1), created_at: isoDateOffset(-1) },
  { id: 'l7', habit_id: 'h2', completed_date: isoDateOffset(-2), created_at: isoDateOffset(-2) },
  { id: 'l8', habit_id: 'h2', completed_date: isoDateOffset(-3), created_at: isoDateOffset(-3) },
  { id: 'l9', habit_id: 'h2', completed_date: isoDateOffset(-4), created_at: isoDateOffset(-4) },
  { id: 'l10', habit_id: 'h2', completed_date: isoDateOffset(-5), created_at: isoDateOffset(-5) },
  { id: 'l11', habit_id: 'h2', completed_date: isoDateOffset(-6), created_at: isoDateOffset(-6) },
  { id: 'l12', habit_id: 'h2', completed_date: isoDateOffset(-7), created_at: isoDateOffset(-7) },
  { id: 'l13', habit_id: 'h2', completed_date: isoDateOffset(-8), created_at: isoDateOffset(-8) },
  { id: 'l14', habit_id: 'h2', completed_date: isoDateOffset(-9), created_at: isoDateOffset(-9) },
  { id: 'l15', habit_id: 'h2', completed_date: isoDateOffset(-10), created_at: isoDateOffset(-10) },
  { id: 'l16', habit_id: 'h2', completed_date: isoDateOffset(-11), created_at: isoDateOffset(-11) },
  { id: 'l17', habit_id: 'h2', completed_date: isoDateOffset(-12), created_at: isoDateOffset(-12) },

  // h3 "Meditar": cadena rota hace 2 días -> racha actual = 0
  { id: 'l18', habit_id: 'h3', completed_date: isoDateOffset(-3), created_at: isoDateOffset(-3) },
  { id: 'l19', habit_id: 'h3', completed_date: isoDateOffset(-4), created_at: isoDateOffset(-4) },

  // h4 "Repasar finanzas" (semanal): sin registros todavía
];

// ---- Tabla: habit_wildcards ----
// El "día comodín": un registro por semana ISO en el que el
// usuario decidió perdonar una falla sin romper la racha.
// Separado de habit_logs a propósito: NO es un cumplimiento
// real, es un permiso especial para ese día.
const habit_wildcards = [];