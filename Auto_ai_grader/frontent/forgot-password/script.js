const API_BASE = 'http://localhost:5000/api';

const emailInput = document.getElementById('emailInput');
const sendResetBtn = document.getElementById('sendResetBtn');
const errorMsg = document.getElementById('errorMsg');
const successMsg = document.getElementById('successMsg');
const devLinkBox = document.getElementById('devLinkBox');
const devLinkAnchor = document.getElementById('devLinkAnchor');

sendResetBtn.addEventListener('click', async () => {
  errorMsg.style.display = 'none';
  successMsg.style.display = 'none';
  devLinkBox.style.display = 'none';

  const email = emailInput.value.trim();
  if (!email) {
    errorMsg.textContent = 'Please enter your email address.';
    errorMsg.style.display = 'block';
    return;
  }

  sendResetBtn.disabled = true;
  sendResetBtn.textContent = 'Sending...';

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorMsg.textContent = data.message || (data.errors && data.errors[0]?.msg) || 'Something went wrong.';
      errorMsg.style.display = 'block';
      return;
    }

    successMsg.textContent = data.message;
    successMsg.style.display = 'block';

    // In production this box would not exist - the link would only go out via email.
    if (data.devResetLink) {
      devLinkAnchor.href = data.devResetLink;
      devLinkAnchor.textContent = data.devResetLink;
      devLinkBox.style.display = 'block';
    }
  } catch (err) {
    errorMsg.textContent = 'Could not reach the server. Is the backend running?';
    errorMsg.style.display = 'block';
  } finally {
    sendResetBtn.disabled = false;
    sendResetBtn.textContent = 'Send Reset Link →';
  }
});