const API_BASE = 'https://ai-grader-backend-02cv.onrender.com/api';

// Read the token from the URL, e.g. reset-password/index.html?token=abc123
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

const newPasswordInput = document.getElementById('newPasswordInput');
const confirmPasswordInput = document.getElementById('confirmPasswordInput');
const resetBtn = document.getElementById('resetBtn');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');

if (!token) {
  errorMsg.textContent = 'This reset link is missing or invalid. Please request a new one from the login page.';
  errorMsg.style.display = 'block';
  resetBtn.disabled = true;
}

resetBtn.addEventListener('click', async () => {
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';

  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!newPassword || !confirmPassword) {
    errorMsg.textContent = 'Please fill in both fields.';
    errorMsg.style.display = 'block';
    return;
  }
  if (newPassword.length < 6) {
    errorMsg.textContent = 'Password must be at least 6 characters.';
    errorMsg.style.display = 'block';
    return;
  }
  if (newPassword !== confirmPassword) {
    errorMsg.textContent = 'Passwords do not match.';
    errorMsg.style.display = 'block';
    return;
  }

  resetBtn.disabled = true;
  resetBtn.textContent = 'Resetting...';

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.message || (data.errors && data.errors[0]?.msg) || 'Could not reset password.';
      errorMsg.style.display = 'block';
      return;
    }

    successMsg.textContent = 'Password reset! Redirecting to login...';
    successMsg.style.display = 'block';

    setTimeout(() => {
      window.location.href = '../login/index.html';
    }, 1500);
  } catch (err) {
    errorMsg.textContent = 'Could not reach the server. Is the backend running?';
    errorMsg.style.display = 'block';
  } finally {
    resetBtn.disabled = false;
    resetBtn.textContent = 'Reset Password →';
  }
});