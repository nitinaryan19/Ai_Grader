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

    if (data.user.role !== 'TEACHER') {
      window.location.href = '../login/index.html';
      return;
    }

    currentUser = data.user;
    const displayName = data.user.name || data.user.email;
    document.getElementById('userName').textContent = displayName;
    document.getElementById('profileName').textContent = displayName;
    document.getElementById('profileAvatar').src = getAvatarUrl(data.user);

    loadMyExams();
    loadDashboardStats();
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
const pageTitle = document.getElementById('pageTitle');

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
    pageTitle.textContent = page;

    if (page === 'Exams') {
      pageTitle.textContent = 'Dashboard';
      navItems.forEach(i => i.classList.remove('active'));
      document.querySelector('.nav-item[data-page="Dashboard"]').classList.add('active');
      document.querySelector('#examsTable').scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast('Here are all your exams');
    } else if (page === 'Questions') {
      openExamPicker('questions');
    } else if (page === 'Rubrics') {
      openExamPicker('rubric');
    } else if (page === 'Submissions') {
      openExamPicker('submissions');
    } else if (page === 'Evaluation') {
      openExamPicker('submissions');
    } else if (page === 'Reports') {
      openReportsModal();
    } else if (page === 'Students') {
      openStudentsModal();
    } else if (page === 'Analytics') {
      openAnalyticsModal();
    } else if (page === 'Reports') {
      openReportsModal();
    } else if (page === 'Settings') {
      openSettingsModal();
    } else if (page !== 'Dashboard') {
      showToast(`"${page}" page — coming soon`);
    }
    if (window.innerWidth <= 900) {
      document.querySelector('.sidebar').classList.remove('open');
    }
  });
});

// ---------- Sidebar collapse / mobile toggle ----------
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');

menuToggle.addEventListener('click', () => {
  if (window.innerWidth <= 900) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
});

// ---------- Notification bell ----------
const bellBtn = document.getElementById('bellBtn');
const notifBadge = document.getElementById('notifBadge');

bellBtn.addEventListener('click', () => {
  notifBadge.classList.add('hidden');
  openNotificationsModal();
});

// ---------- Profile menu ----------
const profileBtn = document.getElementById('profileBtn');
profileBtn.addEventListener('click', () => {
  openSettingsModal();
});

// ---------- Search (client-side filter over the loaded exams) ----------
const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  document.querySelectorAll('#examsTable tbody tr').forEach(row => {
    if (!row.children[1]) return;
    const title = row.children[0].textContent.toLowerCase();
    const subject = row.children[1].textContent.toLowerCase();
    row.style.display = (title.includes(q) || subject.includes(q)) ? '' : 'none';
  });
});

// ---------- Quick actions ----------
document.querySelectorAll('.quick-card').forEach(card => {
  card.addEventListener('click', () => {
    const action = card.dataset.action;
    if (action === 'Create Exam') {
      openModal('createExamModal');
    } else if (action === 'Upload Questions' || action === 'Upload Answer Key') {
      openExamPicker('addquestions');
    } else if (action === 'Upload Materials') {
      openExamPicker('materials');
    } else if (action === 'View Submissions') {
      openExamPicker('submissions');
    } else {
      showToast(`${action} clicked`);
    }
  });
});

// ---------- "View All" link(s) ----------
document.querySelectorAll('.view-all').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    loadMyExams();
    loadDashboardStats();
    document.querySelector('#examsTable').scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast('Showing all your exams');
  });
});

// ================= MODAL HELPERS =================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.getElementById('closeCreateExamModal').addEventListener('click', () => closeModal('createExamModal'));
document.getElementById('closeAddQuestionsModal').addEventListener('click', () => closeModal('addQuestionsModal'));
document.getElementById('closeViewSubmissionsModal').addEventListener('click', () => closeModal('viewSubmissionsModal'));
document.getElementById('closeSubmissionDetailModal').addEventListener('click', () => closeModal('submissionDetailModal'));
document.getElementById('closeStudentsModal').addEventListener('click', () => closeModal('studentsModal'));
document.getElementById('closeAnalyticsModal').addEventListener('click', () => closeModal('analyticsModal'));
document.getElementById('closeReportsModal').addEventListener('click', () => closeModal('reportsModal'));
document.getElementById('closeExamPickerModal').addEventListener('click', () => closeModal('examPickerModal'));
document.getElementById('closeQuestionsViewModal').addEventListener('click', () => closeModal('questionsViewModal'));
document.getElementById('closeSettingsModal').addEventListener('click', () => closeModal('settingsModal'));
document.getElementById('closeNotificationsModal').addEventListener('click', () => closeModal('notificationsModal'));
document.getElementById('closeReportsModal').addEventListener('click', () => closeModal('reportsModal'));
document.getElementById('closeMaterialsModal').addEventListener('click', () => closeModal('materialsModal'));

// ================= DASHBOARD STATS =================
async function loadDashboardStats() {
  try {
    const [analyticsRes, studentsRes] = await Promise.all([
      fetch(`${API_BASE}/exams/analytics`, { credentials: 'include' }),
      fetch(`${API_BASE}/exams/students`, { credentials: 'include' }),
    ]);
    const analytics = await analyticsRes.json();
    const students = await studentsRes.json();

    document.getElementById('statTotalExams').textContent = analytics.totalExams ?? 0;
    document.getElementById('statTotalSubmissions').textContent = analytics.totalSubmissions ?? 0;
    document.getElementById('statAvgScore').textContent =
      analytics.overallAverage != null ? `${analytics.overallAverage}%` : '0%';
    document.getElementById('statTotalStudents').textContent = (students.students || []).length;
  } catch (err) {
    showToast('Could not load dashboard stats. Is the backend running?');
  }
}

// ================= LOAD EXAMS TABLE =================
async function loadMyExams() {
  try {
    const res = await fetch(`${API_BASE}/exams/mine`, { credentials: 'include' });
    const data = await res.json();
    const tbody = document.querySelector('#examsTable tbody');
    tbody.innerHTML = '';

    if (!data.exams || data.exams.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:24px;">No exams yet — click "Create Exam" to add your first one.</td></tr>';
      return;
    }

    data.exams.forEach(exam => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${exam.title}</td>
        <td>${exam.subject}</td>
        <td>${exam._count.questions}</td>
        <td><span class="submissions-link" data-exam-id="${exam.id}" data-exam-title="${exam.title}">${exam._count.submissions}</span></td>
        <td>-</td>
        <td class="score">-</td>
        <td>
          <button class="menu-btn" data-exam-id="${exam.id}" title="Add questions">⋮</button>
          <button class="menu-btn delete-exam-btn" data-exam-id="${exam.id}" data-exam-title="${exam.title}" title="Delete exam">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // ⋮ menu opens Add Questions for that exam
    document.querySelectorAll('.menu-btn:not(.delete-exam-btn)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentExamId = btn.dataset.examId;
        document.getElementById('questionsAddedList').innerHTML = '';
        openModal('addQuestionsModal');
      });
    });

    // 🗑️ deletes the exam after confirmation
    document.querySelectorAll('.delete-exam-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const examId = btn.dataset.examId;
        const examTitle = btn.dataset.examTitle;

        const confirmed = window.confirm(`Delete "${examTitle}"? This will also delete all its questions and student submissions. This cannot be undone.`);
        if (!confirmed) return;

        try {
          const res = await fetch(`${API_BASE}/exams/${examId}`, {
            method: 'DELETE',
            credentials: 'include',
          });
          const data = await res.json();

          if (!res.ok) {
            showToast(data.message || 'Could not delete exam.');
            return;
          }

          showToast('Exam deleted');
          loadMyExams();
          loadDashboardStats();
        } catch (err) {
          showToast('Could not reach the server.');
        }
      });
    });

    // Clicking the submission count opens the submissions list for that exam
    document.querySelectorAll('.submissions-link').forEach(el => {
      el.addEventListener('click', () => {
        openSubmissionsModal(el.dataset.examId, el.dataset.examTitle);
      });
    });
  } catch (err) {
    showToast('Could not load exams. Is the backend running?');
  }
}

// ================= CREATE EXAM =================
let currentExamId = null;

document.getElementById('submitCreateExam').addEventListener('click', async () => {
  const title = document.getElementById('examTitleInput').value.trim();
  const subject = document.getElementById('examSubjectInput').value.trim();
  const duration = document.getElementById('examDurationInput').value;
  const errorEl = document.getElementById('createExamError');
  errorEl.style.display = 'none';

  if (!title || !subject || !duration) {
    errorEl.textContent = 'Please fill in all fields.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/exams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title, subject, duration: Number(duration) }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || (data.errors && data.errors[0]?.msg) || 'Could not create exam.';
      errorEl.style.display = 'block';
      return;
    }

    currentExamId = data.exam.id;

    document.getElementById('examTitleInput').value = '';
    document.getElementById('examSubjectInput').value = '';
    document.getElementById('examDurationInput').value = '';

    closeModal('createExamModal');
    document.getElementById('questionsAddedList').innerHTML = '';
    openModal('addQuestionsModal');

    loadMyExams();
    loadDashboardStats();
    showToast('Exam created! Now add some questions.');
  } catch (err) {
    errorEl.textContent = 'Could not reach the server. Is the backend running?';
    errorEl.style.display = 'block';
  }
});

// ================= ADD QUESTIONS =================
document.getElementById('submitAddQuestion').addEventListener('click', async () => {
  const questionText = document.getElementById('questionTextInput').value.trim();
  const modelAnswer = document.getElementById('modelAnswerInput').value.trim();
  const maxMarks = document.getElementById('maxMarksInput').value;
  const errorEl = document.getElementById('addQuestionError');
  const successEl = document.getElementById('addQuestionSuccess');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  if (!questionText || !modelAnswer) {
    errorEl.textContent = 'Please fill in the question text and model answer.';
    errorEl.style.display = 'block';
    return;
  }

  if (!currentExamId) {
    errorEl.textContent = 'No exam selected. Please create or select an exam first.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/exams/${currentExamId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ questionText, modelAnswer, maxMarks: Number(maxMarks) || 10 }),
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || (data.errors && data.errors[0]?.msg) || 'Could not add question.';
      errorEl.style.display = 'block';
      return;
    }

    successEl.textContent = 'Question added!';
    successEl.style.display = 'block';

    const chip = document.createElement('div');
    chip.className = 'question-added-chip';
    chip.textContent = `✓ ${questionText.slice(0, 60)}${questionText.length > 60 ? '...' : ''} (${maxMarks || 10} marks)`;
    document.getElementById('questionsAddedList').appendChild(chip);

    document.getElementById('questionTextInput').value = '';
    document.getElementById('modelAnswerInput').value = '';
    document.getElementById('maxMarksInput').value = '10';
  } catch (err) {
    errorEl.textContent = 'Could not reach the server.';
    errorEl.style.display = 'block';
  }
});

document.getElementById('doneAddingQuestions').addEventListener('click', () => {
  closeModal('addQuestionsModal');
  currentExamId = null;
  loadMyExams();
  loadDashboardStats();
  showToast('Exam is ready for students!');
});

// ================= VIEW SUBMISSIONS =================
async function openSubmissionsModal(examId, examTitle) {
  document.getElementById('submissionsExamTitle').textContent = `Submissions — ${examTitle}`;
  const list = document.getElementById('submissionsList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('viewSubmissionsModal');

  try {
    const res = await fetch(`${API_BASE}/exams/${examId}/submissions`, { credentials: 'include' });
    const data = await res.json();

    list.innerHTML = '';

    if (!data.submissions || data.submissions.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No students have submitted this exam yet.</p>';
      return;
    }

    data.submissions.forEach(sub => {
      const row = document.createElement('div');
      row.className = 'submission-row';
      row.innerHTML = `
        <span>
          <strong>${sub.student.name || sub.student.email}</strong>
          <small>Submitted ${new Date(sub.submittedAt).toLocaleString()}</small>
        </span>
        <span class="score-pill">${sub.totalScore ?? '-'} pts</span>
      `;
      row.addEventListener('click', () => showSubmissionDetail(sub));
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load submissions.</p>';
  }
}

function showSubmissionDetail(submission) {
  document.getElementById('submissionDetailStudentName').textContent =
    submission.student.name || submission.student.email;
  document.getElementById('submissionDetailScore').textContent = submission.totalScore ?? '-';

  const breakdown = document.getElementById('submissionDetailBreakdown');
  breakdown.innerHTML = '';

  submission.answers.forEach((ans, i) => {
    const card = document.createElement('div');
    card.className = 'result-question-card';
    card.innerHTML = `
      <div class="rq-title">Q${i + 1}. ${ans.question.questionText}</div>
      <div class="rq-answer">Student's answer: "${ans.studentAnswer}"</div>
      <div class="rq-score">${ans.score ?? 0} / ${ans.question.maxMarks} marks</div>
      <div class="rq-feedback">${ans.feedback || 'No feedback available.'}</div>
    `;
    breakdown.appendChild(card);
  });

  closeModal('viewSubmissionsModal');
  openModal('submissionDetailModal');
}


// ================= STUDENTS =================
async function openStudentsModal() {
  const list = document.getElementById('studentsList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('studentsModal');

  try {
    const res = await fetch(`${API_BASE}/exams/students`, { credentials: 'include' });
    const data = await res.json();

    list.innerHTML = '';

    if (!data.students || data.students.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No students have submitted any of your exams yet.</p>';
      return;
    }

    // Sort by average score, highest first
    const sorted = [...data.students].sort((a, b) => b.averageScore - a.averageScore);

    sorted.forEach(student => {
      const row = document.createElement('div');
      row.className = 'student-row';
      row.innerHTML = `
        <span>
          <strong>${student.name || student.email}</strong>
          <small>${student.email}</small>
        </span>
        <span>
          <span class="stat-pill">${student.examsTaken} exam${student.examsTaken !== 1 ? 's' : ''}</span>
          <span class="stat-pill">${student.averageScore} avg</span>
        </span>
      `;
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load students.</p>';
  }
}

// ================= ANALYTICS =================
let analyticsChartInstance = null;

async function openAnalyticsModal() {
  const summaryEl = document.getElementById('analyticsSummary');
  const canvas = document.getElementById('analyticsChart');
  const emptyState = document.getElementById('analyticsEmptyState');
  summaryEl.innerHTML = '';
  emptyState.style.display = 'none';
  canvas.style.display = 'block';

  openModal('analyticsModal');

  try {
    const res = await fetch(`${API_BASE}/exams/analytics`, { credentials: 'include' });
    const data = await res.json();

    summaryEl.innerHTML = `
      <div class="analytics-stat-card"><div class="value">${data.totalExams}</div><div class="label">Total Exams</div></div>
      <div class="analytics-stat-card"><div class="value">${data.totalSubmissions}</div><div class="label">Total Submissions</div></div>
      <div class="analytics-stat-card"><div class="value">${data.overallAverage}</div><div class="label">Overall Avg. Score</div></div>
    `;

    const examsWithSubmissions = data.examStats.filter(e => e.submissionCount > 0);

    if (examsWithSubmissions.length === 0) {
      canvas.style.display = 'none';
      emptyState.textContent = 'No graded submissions yet - the chart will appear once students start submitting exams.';
      emptyState.style.display = 'block';
      return;
    }

    if (analyticsChartInstance) {
      analyticsChartInstance.destroy(); // avoid stacking multiple charts on reopen
    }

    analyticsChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: examsWithSubmissions.map(e => e.title),
        datasets: [{
          label: 'Average Score',
          data: examsWithSubmissions.map(e => e.averageScore),
          backgroundColor: '#6a5cf5',
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
  } catch (err) {
    emptyState.textContent = 'Could not load analytics.';
    emptyState.style.display = 'block';
    canvas.style.display = 'none';
  }
}

// ================= REPORTS =================
let lastReportData = [];

async function openReportsModal() {
  const list = document.getElementById('reportsList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('reportsModal');

  try {
    const res = await fetch(`${API_BASE}/exams/analytics`, { credentials: 'include' });
    const data = await res.json();

    if (!data.examStats || data.examStats.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No exam data yet to report on.</p>';
      lastReportData = [];
      return;
    }

    lastReportData = data.examStats;

    list.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted);">Exam</th>
          <th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted);">Submissions</th>
          <th style="text-align:left;padding:8px;font-size:12px;color:var(--text-muted);">Avg Score</th>
        </tr></thead>
        <tbody>
          ${data.examStats.map(e => `
            <tr>
              <td style="padding:8px;font-size:13.5px;border-top:1px solid var(--border);">${e.title}</td>
              <td style="padding:8px;font-size:13.5px;border-top:1px solid var(--border);">${e.submissionCount}</td>
              <td style="padding:8px;font-size:13.5px;border-top:1px solid var(--border);" class="score">${e.averageScore}%</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load report data.</p>';
    lastReportData = [];
  }
}

document.getElementById('downloadReportBtn').addEventListener('click', () => {
  if (!lastReportData.length) {
    showToast('No data to download yet.');
    return;
  }
  let csv = 'Exam Title,Submissions,Average Score\n';
  lastReportData.forEach(e => { csv += `"${e.title}",${e.submissionCount},${e.averageScore}\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'exam_report.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Report downloaded!');
});

// ================= EXAM PICKER (reused by nav links + quick actions) =================
async function openExamPicker(purpose) {
  const titles = {
    questions: 'Select an exam to view its Questions',
    rubric: 'Select an exam to view its Rubric',
    submissions: 'Select an exam to view Submissions',
    addquestions: 'Select an exam to add Questions / Answer Key to',
    materials: 'Select an exam to upload Materials for',
  };
  document.getElementById('examPickerTitle').textContent = titles[purpose] || 'Select an Exam';

  const list = document.getElementById('examPickerList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('examPickerModal');

  try {
    const res = await fetch(`${API_BASE}/exams/mine`, { credentials: 'include' });
    const data = await res.json();

    list.innerHTML = '';

    if (!data.exams || data.exams.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">You haven\'t created any exams yet. Create one first from Quick Actions.</p>';
      return;
    }

    data.exams.forEach(exam => {
      const row = document.createElement('div');
      row.className = 'exam-picker-row';
      row.innerHTML = `
        <span>
          <strong>${exam.title}</strong>
          <small>${exam.subject} &nbsp;•&nbsp; ${exam._count.questions} question(s) &nbsp;•&nbsp; ${exam._count.submissions} submission(s)</small>
        </span>
        <span>→</span>
      `;
      row.addEventListener('click', () => {
        closeModal('examPickerModal');
        if (purpose === 'submissions') {
          openSubmissionsModal(exam.id, exam.title);
        } else if (purpose === 'addquestions') {
          currentExamId = exam.id;
          document.getElementById('questionsAddedList').innerHTML = '';
          openModal('addQuestionsModal');
        } else if (purpose === 'materials') {
          openMaterialsModal(exam.id, exam.title);
        } else {
          openQuestionsView(exam.id, exam.title, purpose);
        }
      });
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load exams.</p>';
  }
}

// ================= QUESTIONS / RUBRIC VIEWER (read-only) =================
async function openQuestionsView(examId, examTitle, purpose) {
  const heading = purpose === 'rubric' ? `Rubric — ${examTitle}` : `Questions — ${examTitle}`;
  document.getElementById('questionsViewTitle').textContent = heading;

  const list = document.getElementById('questionsViewList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('questionsViewModal');

  try {
    const res = await fetch(`${API_BASE}/exams/${examId}/detail`, { credentials: 'include' });
    const data = await res.json();

    list.innerHTML = '';

    if (!data.exam.questions || data.exam.questions.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No questions added to this exam yet.</p>';
      return;
    }

    data.exam.questions.forEach((q, i) => {
      const card = document.createElement('div');
      card.className = 'question-view-card';
      card.innerHTML = `
        <div class="qv-title">Q${i + 1}. ${q.questionText}</div>
        <div class="qv-answer-label">Model Answer / Rubric</div>
        <div class="qv-answer">${q.modelAnswer}</div>
        <span class="qv-marks">${q.maxMarks} marks</span>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load questions.</p>';
  }
}

// ================= UPLOAD MATERIALS =================
let currentMaterialsExamId = null;

function openMaterialsModal(examId, examTitle) {
  currentMaterialsExamId = examId;
  document.getElementById('materialsModalTitle').textContent = `Upload Materials — ${examTitle}`;
  document.getElementById('materialsError').style.display = 'none';
  document.getElementById('materialsSuccess').style.display = 'none';
  document.getElementById('materialFileInput').value = '';
  document.getElementById('materialsUploadedList').innerHTML = '';
  openModal('materialsModal');
}

document.getElementById('submitMaterialUpload').addEventListener('click', async () => {
  const fileInput = document.getElementById('materialFileInput');
  const errorEl = document.getElementById('materialsError');
  const successEl = document.getElementById('materialsSuccess');
  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  if (!fileInput.files.length) {
    errorEl.textContent = 'Please choose a file first.';
    errorEl.style.display = 'block';
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);

  try {
    const res = await fetch(`${API_BASE}/exams/${currentMaterialsExamId}/materials`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      errorEl.textContent = data.message || 'Could not upload material. (Backend route may not exist yet.)';
      errorEl.style.display = 'block';
      return;
    }
    successEl.textContent = 'Material uploaded!';
    successEl.style.display = 'block';
    const chip = document.createElement('div');
    chip.className = 'question-added-chip';
    chip.textContent = `✓ ${fileInput.files[0].name}`;
    document.getElementById('materialsUploadedList').appendChild(chip);
    fileInput.value = '';
  } catch (err) {
    errorEl.textContent = 'Could not reach the server.';
    errorEl.style.display = 'block';
  }
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
    document.getElementById('profileName').textContent = name;
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


// ================= NOTIFICATIONS =================
async function openNotificationsModal() {
  const list = document.getElementById('notificationsList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('notificationsModal');

  try {
    const res = await fetch(`${API_BASE}/exams/notifications`, { credentials: 'include' });
    const data = await res.json();

    list.innerHTML = '';

    if (!data.submissions || data.submissions.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No recent activity yet. You\'ll see student submissions here.</p>';
      return;
    }

    data.submissions.forEach(sub => {
      const item = document.createElement('div');
      item.className = 'notification-item';
      const studentName = sub.student.name || sub.student.email;
      item.innerHTML = `
        <span class="notif-icon">📝</span>
        <span class="notif-text">
          <strong>${studentName}</strong> submitted <strong>${sub.exam.title}</strong> and scored ${sub.totalScore ?? '-'}
          <span class="notif-time">${new Date(sub.submittedAt).toLocaleString()}</span>
        </span>
      `;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        closeModal('notificationsModal');
        showSubmissionDetail(sub);
      });
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load notifications.</p>';
  }
}

// ================= REPORTS =================
let currentReportsData = [];

async function openReportsModal() {
  const list = document.getElementById('reportsList');
  list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Loading...</p>';
  openModal('reportsModal');

  try {
    const res = await fetch(`${API_BASE}/exams/reports`, { credentials: 'include' });
    const data = await res.json();
    currentReportsData = data.students || [];

    list.innerHTML = '';

    if (currentReportsData.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No student data yet - reports will appear once students submit exams.</p>';
      return;
    }

    currentReportsData.forEach(student => {
      const card = document.createElement('div');
      card.className = 'report-student-card';

      let subjectsHtml = '';
      Object.keys(student.subjects).forEach(subject => {
        const rows = student.subjects[subject].map(entry => `
          <tr>
            <td>${entry.examTitle}</td>
            <td>${entry.score} / ${entry.maxPossible} (${entry.percentage}%)</td>
          </tr>
        `).join('');
        subjectsHtml += `
          <div class="report-subject-block">
            <div class="report-subject-name">${subject}</div>
            <table class="report-subject-table"><tbody>${rows}</tbody></table>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="report-student-header">
          <span>
            <strong>${student.name || student.email}</strong>
            <small>${student.email}</small>
          </span>
          <span style="display:flex;align-items:center;gap:8px;">
            <span class="report-overall-badge">${student.overallAverage}% overall</span>
            <button class="report-download-one" data-student-id="${student.studentId}" title="Download this student's report" style="border:1px solid var(--border);background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px;">⬇</button>
          </span>
        </div>
        ${subjectsHtml}
      `;
      list.appendChild(card);
    });

    document.querySelectorAll('.report-download-one').forEach(btn => {
      btn.addEventListener('click', () => {
        const student = currentReportsData.find(s => s.studentId === btn.dataset.studentId);
        if (student) downloadReportCsv([student], `${(student.name || student.email).replace(/[^a-z0-9]/gi, '_')}-report`);
      });
    });
  } catch (err) {
    list.innerHTML = '<p style="color:#e11d48;font-size:13px;">Could not load reports.</p>';
  }
}

document.getElementById('downloadReportsCsvBtn').addEventListener('click', () => {
  if (currentReportsData.length === 0) {
    showToast('No report data to download yet.');
    return;
  }
  downloadReportCsv(currentReportsData, 'student-report-all');
});

// Shared CSV export - used for both "download all students" and
// "download this one student" buttons.
function downloadReportCsv(students, filenamePrefix) {
  const rows = [['Student Name', 'Email', 'Subject', 'Exam', 'Score', 'Max Marks', 'Percentage']];
  students.forEach(student => {
    Object.keys(student.subjects).forEach(subject => {
      student.subjects[subject].forEach(entry => {
        rows.push([
          student.name || '',
          student.email,
          subject,
          entry.examTitle,
          entry.score,
          entry.maxPossible,
          `${entry.percentage}%`,
        ]);
      });
    });
  });

  const csvContent = rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast('Report downloaded!');
}