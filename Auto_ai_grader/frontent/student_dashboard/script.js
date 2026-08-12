const API_BASE = 'https://ai-grader-backend-02cv.onrender.com/api';

// ---------- Avatar helper ----------
// Uses a locally-saved custom photo (per user, stored in this browser) if one
// exists, otherwise generates a colored initials avatar from the user's name.
function getAvatarUrl(user) {
  const displayName = user.name || user.email;
  const saved = localStorage.getItem(`avatar_${user.email}`);
  if (saved) return saved;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6a5cf5&color=fff&bold=true&size=128`;
}

let currentUser = null;

// ---------- Auth check: kick out anyone not logged in ----------
(async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!res.ok) {
      window.location.href = '../login/index.html';
      return;
    }
    const data = await res.json();

    if (data.user.role !== 'STUDENT') {
      window.location.href = '../login/index.html';
      return;
    }

    currentUser = data.user;
    document.getElementById('userName').textContent = data.user.name || data.user.email;
    document.getElementById('profileAvatar').src = getAvatarUrl(data.user);

    loadDashboardData(); // fetch real exams + results once we know we're logged in
    loadNotificationBadge(); // show the real unread notification count

    // If we just came back from taking an exam, show that result automatically
    const params = new URLSearchParams(window.location.search);
    const submissionId = params.get('submissionId');
    if (submissionId) {
      openResultDetail(submissionId);
      window.history.replaceState({}, '', 'index.html'); // clean the URL so refresh doesn't reopen it
    }
  } catch (err) {
    window.location.href = '../login/index.html';
  }
})();

// ---------- Toast helper ----------
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---------- Sidebar navigation ----------
const navItems = document.querySelectorAll('.nav-item');

navItems.forEach(item => {
  item.addEventListener('click', async (e) => {
    e.preventDefault();
    const page = item.dataset.page;

    if (page === 'Logout') {
      showToast('Logging out...');
      try {
        await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
      } catch (err) {}
      window.location.href = '../login/index.html';
      return;
    }

    navItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');

    if (page === 'Notifications') {
      openNotificationsModal();
    }

    if (page === 'My Exams') {
      loadDashboardData(); // just re-fetch and let the person scroll to the Upcoming Exams panel
      showToast('Showing your available exams below');
    } else if (page === 'My Results') {
      openMyResultsModal();
    } else if (page === 'Materials') {
      openMaterialsExamPicker();
    } else if (page === 'Profile') {
      openSettingsModal();
    } else if (page === 'AI Feedback') {
      openAiFeedbackModal();
    } else if (page === 'Performance') {
      openPerformanceModal();
    } else if (page !== 'Dashboard') {
      showToast(`"${page}" page — coming soon`);
    }
  });
});

// ================= MODAL HELPERS =================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.getElementById('closeExamResultModal').addEventListener('click', () => closeModal('examResultModal'));
document.getElementById('closeMyResultsModal').addEventListener('click', () => closeModal('myResultsModal'));
document.getElementById('closeSettingsModal').addEventListener('click', () => closeModal('settingsModal'));
document.getElementById('closeNotificationsModal').addEventListener('click', () => closeModal('notificationsModal'));
document.getElementById('closeAiFeedbackModal').addEventListener('click', () => closeModal('aiFeedbackModal'));
document.getElementById('closePerformanceModal').addEventListener('click', () => closeModal('performanceModal'));
document.getElementById('closeMaterialsExamPickerModal').addEventListener('click', () => closeModal('materialsExamPickerModal'));
document.getElementById('closeMaterialsListModal').addEventListener('click', () => closeModal('materialsListModal'));
document.getElementById('closeResultBtn').addEventListener('click', () => {
  closeModal('examResultModal');
  loadDashboardData();
});

// ================= LOAD DASHBOARD DATA (available exams + recent results + stats) =================
async function loadDashboardData() {
  try {
    const [examsRes, submissionsRes] = await Promise.all([
      fetch(`${API_BASE}/exams/available`, { credentials: 'include' }),
      fetch(`${API_BASE}/exams/submissions/mine`, { credentials: 'include' }),
    ]);
    const examsData = await examsRes.json();
    const submissionsData = await submissionsRes.json();

    // An exam shows in "Upcoming Exams" if this student still has unanswered
    // questions on it - either they never started it, or the teacher added
    // new questions since their last submission (exam.hasPending covers both).
    const availableExams = (examsData.exams || []).filter(e => e.hasPending);
    const submissions = submissionsData.submissions || [];

    // ---- Stat cards (real numbers) ----
    document.getElementById('statUpcomingExams').textContent = availableExams.length;
    document.getElementById('statCompletedExams').textContent = submissions.length;

    if (submissions.length > 0) {
      const scores = submissions.map(s => s.totalScore || 0);
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      document.getElementById('statAverageScore').textContent = avg;
      // submissions are returned newest-first by the API, so index 0 is the last exam taken
      document.getElementById('statLastScore').textContent = submissions[0].totalScore ?? '-';
    } else {
      document.getElementById('statAverageScore').textContent = '0';
      document.getElementById('statLastScore').textContent = '-';
    }

    // ---- Render "Upcoming Exams" panel ----
    const upcomingList = document.getElementById('upcomingExams');
    upcomingList.innerHTML = '';

    if (availableExams.length === 0) {
      upcomingList.innerHTML = '<li style="color:var(--text-muted);font-size:13px;padding:12px 0;">No new exams available right now.</li>';
    } else {
      availableExams.forEach(exam => {
        const li = document.createElement('li');
        li.className = 'exam-item';
        const pendingCount = exam._count.questions - exam.answeredCount;
        const reopenedBadge = exam.alreadyStarted
          ? `<span style="color:var(--orange);font-weight:700;">• ${pendingCount} new question${pendingCount !== 1 ? 's' : ''} added</span>`
          : '';
        li.innerHTML = `
          <span class="exam-icon">📝</span>
          <span class="exam-info">
            <strong>${exam.title}</strong>
            <small>${exam.subject} &nbsp;•&nbsp; ${exam.duration} min &nbsp;•&nbsp; ${exam._count.questions} question(s) ${reopenedBadge}</small>
          </span>
          <button class="btn-start" data-exam-id="${exam.id}" data-exam-title="${exam.title}">${exam.alreadyStarted ? 'Continue Exam' : 'Start Exam'}</button>
        `;
        upcomingList.appendChild(li);
      });
    }

    document.querySelectorAll('.btn-start').forEach(btn => {
      btn.addEventListener('click', () => goToTakeExam(btn.dataset.examId, btn.dataset.examTitle));
    });

    // ---- Render "Recent Results" panel ----
    const resultsList = document.getElementById('recentResults');
    resultsList.innerHTML = '';
    const recentFive = submissions.slice(0, 5);

    if (recentFive.length === 0) {
      resultsList.innerHTML = '<li style="color:var(--text-muted);font-size:13px;padding:12px 0;">No results yet — take an exam to see your score here.</li>';
    } else {
      recentFive.forEach(sub => {
        const li = document.createElement('li');
        li.className = 'result-item';
        const tagClass = sub.totalScore >= 8 ? 'tag-excellent' : sub.totalScore >= 5 ? 'tag-good' : 'tag-average';
        const tagLabel = sub.totalScore >= 8 ? 'Excellent' : sub.totalScore >= 5 ? 'Good' : 'Needs Work';
        li.innerHTML = `
          <span class="result-info">
            <strong>${sub.exam.title}</strong>
            <small>Score: ${sub.totalScore ?? '-'}</small>
          </span>
          <span class="tag ${tagClass}">${tagLabel}</span>
        `;
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => openResultDetail(sub.id));
        resultsList.appendChild(li);
      });
    }
  } catch (err) {
    showToast('Could not load dashboard data. Is the backend running?');
  }
}

// ================= TAKE EXAM =================
// Exam-taking now happens on its own page (take_exam.html) instead of a modal,
// so students get a distraction-free, anti-copy-paste exam screen.
function goToTakeExam(examId, examTitle) {
  window.location.href = `take_exam.html?examId=${encodeURIComponent(examId)}&examTitle=${encodeURIComponent(examTitle)}`;
}

// ================= SHOW RESULT (from history, or redirected back after submitting) =================
function renderResult(submission) {
  document.getElementById('resultTotalScore').textContent = submission.totalScore ?? '-';

  const breakdown = document.getElementById('examResultBreakdown');
  breakdown.innerHTML = '';

  submission.answers.forEach((ans, i) => {
    const card = document.createElement('div');
    card.className = 'result-question-card';
    card.innerHTML = `
      <div class="rq-title">Q${i + 1}. ${ans.question.questionText}</div>
      <div class="rq-answer">Your answer: "${ans.studentAnswer}"</div>
      <div class="rq-score">${ans.score ?? 0} / ${ans.question.maxMarks} marks</div>
      <div class="rq-feedback">${ans.feedback || 'No feedback available.'}</div>
    `;
    breakdown.appendChild(card);
  });
}

async function openResultDetail(submissionId) {
  try {
    const res = await fetch(`${API_BASE}/exams/submissions/${submissionId}`, { credentials: 'include' });
    const data = await res.json();
    renderResult(data.submission);
    openModal('examResultModal');
  } catch (err) {
    showToast('Could not load result details.');
  }
}

// ================= MY RESULTS (full history list) =================
async function openMyResultsModal() {
  try {
    const res = await fetch(`${API_BASE}/exams/submissions/mine`, { credentials: 'include' });
    const data = await res.json();

    const list = document.getElementById('myResultsList');
    list.innerHTML = '';

    if (!data.submissions || data.submissions.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">You haven\'t taken any exams yet.</p>';
    } else {
      data.submissions.forEach(sub => {
        const card = document.createElement('div');
        card.className = 'available-exam-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
          <span>
            <strong>${sub.exam.title}</strong>
            <small>${sub.exam.subject} &nbsp;•&nbsp; Submitted ${new Date(sub.submittedAt).toLocaleDateString()}</small>
          </span>
          <span class="badge-submitted">${sub.totalScore ?? '-'} pts</span>
        `;
        card.addEventListener('click', () => {
          closeModal('myResultsModal');
          openResultDetail(sub.id);
        });
        list.appendChild(card);
      });
    }

    openModal('myResultsModal');
  } catch (err) {
    showToast('Could not load results.');
  }
}

// ---------- View All links ----------
document.querySelectorAll('.view-all').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const panelTitle = link.closest('.panel-header').querySelector('h3').textContent;
    if (panelTitle === 'Recent Results') {
      openMyResultsModal();
    } else {
      showToast(`Opening full "${panelTitle}" list...`);
    }
  });
});


// ================= SETTINGS / PROFILE =================
async function openSettingsModal() {
  document.getElementById('profileError').style.display = 'none';
  document.getElementById('profileSuccess').style.display = 'none';
  document.getElementById('passwordError').style.display = 'none';
  document.getElementById('passwordSuccess').style.display = 'none';
  document.getElementById('currentPasswordInput').value = '';
  document.getElementById('newPasswordInput').value = '';

  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    const data = await res.json();
    currentUser = data.user;
    document.getElementById('settingsNameInput').value = data.user.name || '';
    document.getElementById('settingsEmailInput').value = data.user.email;
    document.getElementById('settingsAvatarPreview').src = getAvatarUrl(data.user);
  } catch (err) {
    showToast('Could not load your profile.');
  }

  openModal('settingsModal');
}

// Preview + save a custom profile picture (stored in this browser per user email)
document.getElementById('settingsAvatarInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please choose an image file.');
    return;
  }
  if (file.size > 1.5 * 1024 * 1024) {
    showToast('Please choose an image smaller than 1.5MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result;
    document.getElementById('settingsAvatarPreview').src = base64;
    document.getElementById('profileAvatar').src = base64;
    if (currentUser) {
      localStorage.setItem(`avatar_${currentUser.email}`, base64);
    }
    showToast('Profile picture updated!');
  };
  reader.readAsDataURL(file);
});

document.getElementById('saveProfileBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('profileError');
  const successEl = document.getElementById('profileSuccess');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const name = document.getElementById('settingsNameInput').value.trim();
  if (!name) {
    errorEl.textContent = 'Name cannot be empty.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || (data.errors && data.errors[0]?.msg) || 'Could not update profile.';
      errorEl.style.display = 'block';
      return;
    }

    successEl.textContent = 'Profile updated!';
    successEl.style.display = 'block';
    document.getElementById('userName').textContent = name;
  } catch (err) {
    errorEl.textContent = 'Could not reach the server.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('changePasswordBtn').addEventListener('click', async () => {
  const errorEl = document.getElementById('passwordError');
  const successEl = document.getElementById('passwordSuccess');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  const currentPassword = document.getElementById('currentPasswordInput').value;
  const newPassword = document.getElementById('newPasswordInput').value;

  if (!currentPassword || !newPassword) {
    errorEl.textContent = 'Please fill in both password fields.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || (data.errors && data.errors[0]?.msg) || 'Could not change password.';
      errorEl.style.display = 'block';
      return;
    }

    successEl.textContent = 'Password changed successfully!';
    successEl.style.display = 'block';
    document.getElementById('currentPasswordInput').value = '';
    document.getElementById('newPasswordInput').value = '';
  } catch (err) {
    errorEl.textContent = 'Could not reach the server.';
    errorEl.style.display = 'block';
  }
});


// ================= NOTIFICATIONS (real backend notifications) =================
async function loadNotificationBadge() {
  try {
    const res = await fetch(`${API_BASE}/notifications`, { credentials: 'include' });
    const data = await res.json();
    const badge = document.getElementById('notifCount');
    if (data.unreadCount > 0) {
      badge.textContent = data.unreadCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (err) {
    // fail silently - the badge just won't show
  }
}

async function openNotificationsModal() {
  const list = document.getElementById('notificationsList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('notificationsModal');

  try {
    const res = await fetch(`${API_BASE}/notifications`, { credentials: 'include' });
    const data = await res.json();

    list.innerHTML = '';

    if (!data.notifications || data.notifications.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No notifications yet.</p>';
    } else {
      data.notifications.forEach(notif => {
        const item = document.createElement('div');
        item.className = 'notification-item';
        const icon = notif.message.includes('new question') ? '❓' : '✅';
        item.innerHTML = `
          <span class="notif-icon">${icon}</span>
          <span class="notif-text">
            ${notif.message}
            <span class="notif-time">${new Date(notif.createdAt).toLocaleString()}</span>
          </span>
        `;
        if (notif.examId) {
          item.style.cursor = 'pointer';
          item.addEventListener('click', () => {
            closeModal('notificationsModal');
            loadDashboardData(); // refresh so a re-opened exam shows up right away
          });
        }
        list.appendChild(item);
      });
    }

    // Mark everything read now that the person has seen the list
    await fetch(`${API_BASE}/notifications/mark-read`, { method: 'PUT', credentials: 'include' });
    document.getElementById('notifCount').style.display = 'none';
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load notifications.</p>';
  }
}


// ================= AI FEEDBACK =================
async function openAiFeedbackModal() {
  const list = document.getElementById('aiFeedbackList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('aiFeedbackModal');

  try {
    const res = await fetch(`${API_BASE}/exams/submissions/mine`, { credentials: 'include' });
    const data = await res.json();
    const submissionsSummary = data.submissions || [];

    if (submissionsSummary.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No feedback yet — complete an exam to see AI feedback here.</p>';
      return;
    }

    // The "mine" list only returns summary fields (score, exam title, etc).
    // Per-question feedback only comes from the single-submission detail endpoint,
    // so fetch the full detail for each submission in parallel.
    const detailResults = await Promise.all(
      submissionsSummary.map(sub =>
        fetch(`${API_BASE}/exams/submissions/${sub.id}`, { credentials: 'include' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    );

    const allFeedback = [];
    detailResults.forEach(result => {
      const sub = result && result.submission;
      if (!sub) return;
      (sub.answers || []).forEach(ans => {
        allFeedback.push({
          examTitle: sub.exam.title,
          questionText: ans.question.questionText,
          score: ans.score,
          maxMarks: ans.question.maxMarks,
          feedback: ans.feedback,
          submittedAt: sub.submittedAt,
        });
      });
    });

    list.innerHTML = '';

    if (allFeedback.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No feedback yet — complete an exam to see AI feedback here.</p>';
      return;
    }

    allFeedback.forEach(fb => {
      const card = document.createElement('div');
      card.className = 'feedback-card';
      card.innerHTML = `
        <div class="fc-exam">${fb.examTitle}</div>
        <div class="fc-question">${fb.questionText}</div>
        <div class="fc-score">${fb.score ?? 0} / ${fb.maxMarks} marks</div>
        <div class="fc-feedback">${fb.feedback || 'No feedback available.'}</div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load feedback.</p>';
  }
}

// ================= PERFORMANCE =================
let performanceChartInstance = null;

async function openPerformanceModal() {
  const summaryEl = document.getElementById('performanceSummary');
  const canvas = document.getElementById('performanceChart');
  const emptyState = document.getElementById('performanceEmptyState');
  summaryEl.innerHTML = '';
  emptyState.style.display = 'none';
  canvas.style.display = 'block';

  openModal('performanceModal');

  try {
    const res = await fetch(`${API_BASE}/exams/submissions/mine`, { credentials: 'include' });
    const data = await res.json();
    const submissions = (data.submissions || []).slice().reverse(); // oldest first, for a left-to-right trend

    if (submissions.length === 0) {
      canvas.style.display = 'none';
      emptyState.textContent = 'No exams completed yet - your performance trend will appear here.';
      emptyState.style.display = 'block';
      summaryEl.innerHTML = `
        <div class="performance-stat-card"><div class="value">0</div><div class="label">Exams Taken</div></div>
        <div class="performance-stat-card"><div class="value">-</div><div class="label">Average Score</div></div>
        <div class="performance-stat-card"><div class="value">-</div><div class="label">Best Score</div></div>
      `;
      return;
    }

    const scores = submissions.map(s => s.totalScore || 0);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const best = Math.max(...scores);

    summaryEl.innerHTML = `
      <div class="performance-stat-card"><div class="value">${submissions.length}</div><div class="label">Exams Taken</div></div>
      <div class="performance-stat-card"><div class="value">${avg}</div><div class="label">Average Score</div></div>
      <div class="performance-stat-card"><div class="value">${best}</div><div class="label">Best Score</div></div>
    `;

    if (performanceChartInstance) {
      performanceChartInstance.destroy();
    }

    performanceChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: submissions.map(s => s.exam.title),
        datasets: [{
          label: 'Score',
          data: scores,
          borderColor: '#6a5cf5',
          backgroundColor: 'rgba(106, 92, 245, 0.1)',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
  } catch (err) {
    emptyState.textContent = 'Could not load performance data.';
    emptyState.style.display = 'block';
    canvas.style.display = 'none';
  }
}

// ================= MATERIALS (uploaded by teacher, viewed by student) =================
// Step 1: pick which exam's materials to look at
async function openMaterialsExamPicker() {
  const list = document.getElementById('materialsExamPickerList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('materialsExamPickerModal');

  try {
    // "mine" = every exam assigned to this student, regardless of submitted status,
    // so materials stay visible even after the exam is completed
    const res = await fetch(`${API_BASE}/exams/available`, { credentials: 'include' });
    const data = await res.json();

    list.innerHTML = '';

    if (!data.exams || data.exams.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No exams assigned to you yet, so no materials to show.</p>';
      return;
    }

    data.exams.forEach(exam => {
      const row = document.createElement('div');
      row.className = 'exam-picker-row';
      row.innerHTML = `
        <span>
          <strong>${exam.title}</strong>
          <small>${exam.subject}</small>
        </span>
        <span>→</span>
      `;
      row.addEventListener('click', () => {
        closeModal('materialsExamPickerModal');
        openMaterialsList(exam.id, exam.title);
      });
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load exams.</p>';
  }
}

// Step 2: show the materials the teacher uploaded for that exam
async function openMaterialsList(examId, examTitle) {
  document.getElementById('materialsListTitle').textContent = `Materials — ${examTitle}`;
  const content = document.getElementById('materialsListContent');
  content.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('materialsListModal');

  try {
    const res = await fetch(`${API_BASE}/exams/${examId}/materials`, { credentials: 'include' });
    const data = await res.json();

    content.innerHTML = '';

    if (!data.materials || data.materials.length === 0) {
      content.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Your teacher hasn\'t uploaded any materials for this exam yet.</p>';
      return;
    }

    data.materials.forEach(mat => {
      const row = document.createElement('div');
      row.className = 'available-exam-card';
      row.innerHTML = `
        <span>
          <strong>📄 ${mat.filename || mat.name}</strong>
          <small>${mat.uploadedAt ? 'Uploaded ' + new Date(mat.uploadedAt).toLocaleDateString() : ''}</small>
        </span>
        <a href="${mat.url || mat.fileUrl}" target="_blank" rel="noopener" class="badge-submitted" style="text-decoration:none;">Open ↗</a>
      `;
      content.appendChild(row);
    });
  } catch (err) {
    content.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load materials. (This needs a GET /api/exams/:id/materials route on the backend.)</p>';
  }
}