// Role toggle (Teacher / Student)
const roleTeacher = document.getElementById('roleTeacher');
const roleStudent = document.getElementById('roleStudent');
let selectedRole = 'TEACHER'; // matches the default "active" button in your HTML

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

// Password show/hide toggle
const toggleEye = document.getElementById('toggleEye');
const pwd = document.getElementById('passwordInput');

toggleEye.addEventListener('click', () => {
  pwd.type = pwd.type === 'password' ? 'text' : 'password';
});

// --- Login submit ---
const loginBtn = document.getElementById('loginBtn');
const emailInput = document.getElementById('emailInput');
const rememberMe = document.getElementById('rememberMe');
const errorMsg = document.getElementById('errorMsg');

const API_BASE = 'http://localhost:5000/api';

loginBtn.addEventListener('click', async () => {
  errorMsg.style.display = 'none';

  const email = emailInput.value.trim();
  const password = pwd.value;

  if (!email || !password) {
    errorMsg.textContent = 'Please enter both email and password.';
    errorMsg.style.display = 'block';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        email,
        password,
        role: selectedRole,
        rememberMe: rememberMe.checked,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.message || 'Login failed. Please try again.';
      errorMsg.style.display = 'block';
      return;
    }

    if (data.user.role === 'TEACHER') {
      window.location.href = '../teacher_dashboard/index.html';
    } else {
      window.location.href = '../student_dashboard/index.html';
    }
  } catch (err) {
    errorMsg.textContent = 'Could not reach the server. Is the backend running?';
    errorMsg.style.display = 'block';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login →';
  }
});