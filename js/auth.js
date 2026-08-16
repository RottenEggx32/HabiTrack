/**
 * auth.js
 * ---------------------------------------------------------
 * Controla quién puede ver la app: muestra la pantalla de
 * login (#authView) o el contenido real (#appShell) según si
 * hay una sesión activa en Supabase.
 *
 * Se carga ANTES que mockData.js y app.js (revisa el orden en
 * index.html) porque decide si esos archivos llegan a mostrarse
 * siquiera.
 * ---------------------------------------------------------
 */

const authView = document.getElementById('authView');
const appShell = document.getElementById('appShell');

const authEmailInput = document.getElementById('authEmail');
const authPasswordInput = document.getElementById('authPassword');
const authMessageEl = document.getElementById('authMessage');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');

function showAuthView() {
  authView.hidden = false;
  appShell.hidden = true;
}

function showAppShell() {
  authView.hidden = true;
  appShell.hidden = false;
}

function showAuthMessage(text, isError) {
  authMessageEl.textContent = text;
  authMessageEl.hidden = false;
  authMessageEl.classList.toggle('auth-card__message--error', isError);
}

function clearAuthMessage() {
  authMessageEl.hidden = true;
  authMessageEl.textContent = '';
}

/**
 * Antes de llamar a Supabase, revisamos que el correo tenga
 * formato válido y la contraseña cumpla el mínimo — usando la
 * validación nativa del navegador (la misma que ya usa el
 * formulario de hábitos), para no gastar una llamada a la red
 * en algo que se puede detectar localmente.
 */
function fieldsAreValid() {
  if (!authEmailInput.reportValidity()) return false;
  if (!authPasswordInput.reportValidity()) return false;
  return true;
}

/**
 * Traduce los mensajes de error más comunes de Supabase Auth
 * (vienen en inglés) a algo que un usuario entienda.
 */
function translateAuthError(message) {
  const known = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'User already registered': 'Ya existe una cuenta con ese correo.',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  };
  return known[message] || message;
}

function setAuthButtonsDisabled(disabled) {
  loginBtn.disabled = disabled;
  signupBtn.disabled = disabled;
}

async function handleLogin() {
  clearAuthMessage();
  if (!fieldsAreValid()) return;

  setAuthButtonsDisabled(true);
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: authEmailInput.value.trim(),
    password: authPasswordInput.value,
  });
  setAuthButtonsDisabled(false);

  if (error) {
    showAuthMessage(translateAuthError(error.message), true);
    return;
  }
  // Si no hay error, onAuthStateChange se encarga de mostrar la app.
}

async function handleSignup() {
  clearAuthMessage();
  if (!fieldsAreValid()) return;

  setAuthButtonsDisabled(true);
  const { data, error } = await supabaseClient.auth.signUp({
    email: authEmailInput.value.trim(),
    password: authPasswordInput.value,
  });
  setAuthButtonsDisabled(false);

  if (error) {
    showAuthMessage(translateAuthError(error.message), true);
    return;
  }

  // Si Supabase pide confirmar el correo, todavía no llega sesión
  // (data.session viene null) aunque la cuenta ya se haya creado.
  if (data.user && !data.session) {
    showAuthMessage('Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión.', false);
  }
  // Si la confirmación de correo está desactivada en el proyecto,
  // Supabase devuelve sesión de una vez y onAuthStateChange
  // muestra la app automáticamente, sin que hagamos nada más aquí.
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  // onAuthStateChange se encarga de mostrar la pantalla de login.
}

loginBtn.addEventListener('click', handleLogin);
signupBtn.addEventListener('click', handleSignup);
logoutBtn.addEventListener('click', handleLogout);

// Revisa si ya había sesión activa (por ejemplo, si recargaste
// la página estando logueado).
supabaseClient.auth.getSession().then(({ data }) => {
  if (data.session) {
    showAppShell();
  } else {
    showAuthView();
  }
});

// Reacciona a cualquier cambio de sesión en tiempo real: login,
// logout, o confirmación de correo en otra pestaña.
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showAppShell();
  } else {
    showAuthView();
  }
});