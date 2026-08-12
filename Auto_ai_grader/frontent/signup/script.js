const API_BASE = 'http://localhost:5000/api';

// ---------- Role toggle (Teacher / Student) ----------
const roleTeacher = document.getElementById('roleTeacher');
const roleStudent = document.getElementById('roleStudent');
let selectedRole = 'TEACHER';

roleTeacher.addEventListener('click', () => {
  roleTeacher.classList.add('active');
  roleStudent.classList.remove('active');
  selectedRole = 'TEACHER';
});

roleStudent.addEventListener('click', () => {
  roleStudent.classList.add('active');
  roleTeacher.classList.remove('active');
  selectedRole = 'STUDENT';
});

// ---------- Password show/hide toggles ----------
const pwd = document.getElementById('passwordInput');
const confirmPwd = document.getElementById('confirmPasswordInput');

document.getElementById('toggleEye').addEventListener('click', () => {
  pwd.type = pwd.type === 'password' ? 'text' : 'password';
});
document.getElementById('toggleEyeConfirm').addEventListener('click', () => {
  confirmPwd.type = confirmPwd.type === 'password' ? 'text' : 'password';
});

// ---------- Sign up submit ----------
const signupBtn = document.getElementById('signupBtn');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');

signupBtn.addEventListener('click', async () => {
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = pwd.value;
  const confirmPassword = confirmPwd.value;

  // ---- Basic client-side validation (backend re-validates too, this is just for a fast response) ----
  if (!name || !email || !password || !confirmPassword) {
    errorMsg.textContent = 'Please fill in all fields.';
    errorMsg.style.display = 'block';
    return;
  }

  if (password.length < 6) {
    errorMsg.textContent = 'Password must be at least 6 characters.';
    errorMsg.style.display = 'block';
    return;
  }

  if (password !== confirmPassword) {
    errorMsg.textContent = 'Passwords do not match.';
    errorMsg.style.display = 'block';
    return;
  }

  signupBtn.disabled = true;
  signupBtn.textContent = 'Creating account...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password, role: selectedRole }),
    });

    const data = await res.json();

    if (!res.ok) {
      // express-validator errors come as an array; register conflicts come as a plain message
      errorMsg.textContent = data.message || (data.errors && data.errors[0]?.msg) || 'Could not create account.';
      errorMsg.style.display = 'block';
      return;
    }

    successMsg.textContent = 'Account created! Redirecting to login...';
    successMsg.style.display = 'block';

    setTimeout(() => {
      window.location.href = '../login/index.html';
    }, 1200);
  } catch (err) {
    errorMsg.textContent = 'Could not reach the server. Is the backend running?';
    errorMsg.style.display = 'block';
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = 'Create Account →';
  }
});