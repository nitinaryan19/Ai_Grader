const API_BASE = 'https://ai-grader-backend-02cv.onrender.com/api';

// ---------- Read examId from the URL (?examId=...&examTitle=...) ----------
const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('examId');
const examTitleFromUrl = urlParams.get('examTitle');

if (!examId) {
  window.location.href = 'index.html';
}

// ---------- Toast helper ----------
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ---------- Auth check ----------
(async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!res.ok) { window.location.href = '../login/index.html'; return; }
    const data = await res.json();
    if (data.user.role !== 'STUDENT') { window.location.href = '../login/index.html'; return; }
    loadExam();
  } catch (err) {
    window.location.href = '../login/index.html';
  }
})();

// ---------- Per-question state ----------
// questionModes[questionId] = 'text' | 'file'
// questionFiles[questionId] = File object (when mode is 'file')
const questionModes = {};
const questionFiles = {};
let questionsData = [];

async function loadExam() {
  if (examTitleFromUrl) {
    document.getElementById('examTitle').textContent = examTitleFromUrl;
  }

  try {
    const res = await fetch(`${API_BASE}/exams/${examId}/take`, { credentials: 'include' });
    const data = await res.json();

    document.getElementById('examTitle').textContent = data.exam.title;

    const alreadyAnswered = new Set(data.alreadyAnsweredQuestionIds || []);
    // Only show questions this student hasn't answered yet - covers both a
    // first-time attempt (nothing answered) and a re-opened exam where the
    // teacher added new questions after their last submission.
    const questionsToAnswer = data.exam.questions.filter(q => !alreadyAnswered.has(q.id));

    if (data.hasPriorSubmission) {
      document.getElementById('examSubtitle').textContent =
        `${data.exam.subject} • ${questionsToAnswer.length} new question(s) to answer • ${data.exam.duration} min`;
    } else {
      document.getElementById('examSubtitle').textContent =
        `${data.exam.subject} • ${questionsToAnswer.length} question(s) • ${data.exam.duration} min`;
    }

    if (questionsToAnswer.length === 0) {
      document.getElementById('examQuestionsWrap').innerHTML =
        '<p class="exam-loading">You\'ve already answered every question on this exam. Nothing new to do here right now.</p>';
      document.querySelector('.exam-submit-bar').style.display = 'none';
      document.querySelector('.exam-integrity-notice').style.display = 'none';
      document.getElementById('examTimer').style.display = 'none';
      return;
    }

    questionsData = questionsToAnswer;
    renderQuestions(questionsData);

    const durationMinutes = data.exam.duration || 30;
    examEndTime = Date.now() + durationMinutes * 60 * 1000;
    startExamTimer();
  } catch (err) {
    document.getElementById('examQuestionsWrap').innerHTML =
      '<p class="exam-loading" style="color:#e11d48;">Could not load this exam. Please go back and try again.</p>';
  }
}

function renderQuestions(questions) {
  const wrap = document.getElementById('examQuestionsWrap');
  wrap.innerHTML = '';

  questions.forEach((q, i) => {
    questionModes[q.id] = 'text';

    const card = document.createElement('div');
    card.className = 'exam-question-card';
    card.innerHTML = `
      <div class="q-title">Q${i + 1}. <span class="no-copy">${q.questionText}</span></div>
      <div class="q-marks">${q.maxMarks} marks — answer in enough detail for the marks available</div>

      <div class="answer-mode-toggle" data-question-id="${q.id}">
        <button type="button" class="mode-btn mode-btn-active" data-mode="text">⌨️ Type Answer</button>
        <button type="button" class="mode-btn" data-mode="file">📎 Upload File</button>
      </div>

      <div class="answer-mode-panel" data-mode-panel="text" data-question-id="${q.id}">
        <textarea
          rows="4"
          class="no-paste-textarea"
          data-question-id="${q.id}"
          placeholder="Type your answer here — copy/paste is disabled."
          autocomplete="off"
          spellcheck="false"
        ></textarea>
      </div>

      <div class="answer-mode-panel" data-mode-panel="file" data-question-id="${q.id}" style="display:none;">
        <input type="file" accept="image/*,application/pdf,.pdf,.docx,.txt" capture="environment" class="answer-file-input" data-question-id="${q.id}">
        <p class="answer-image-hint">Upload a photo of your written answer, a scanned PDF, a Word (.docx) file, or a plain text (.txt) file. Our AI will read it and grade it.</p>
        <div class="answer-image-preview-wrap" data-question-id="${q.id}"></div>
      </div>
    `;
    wrap.appendChild(card);
  });

  attachModeToggleHandlers();
  attachAntiCopyPasteHandlers();
  attachFileInputHandlers();
}

// ================= MODE TOGGLE (type vs photo) =================
function attachModeToggleHandlers() {
  document.querySelectorAll('.answer-mode-toggle').forEach(toggle => {
    const questionId = toggle.dataset.questionId;
    toggle.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        questionModes[questionId] = mode;

        toggle.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-btn-active'));
        btn.classList.add('mode-btn-active');

        document.querySelectorAll(`.answer-mode-panel[data-question-id="${questionId}"]`).forEach(panel => {
          panel.style.display = panel.dataset.modePanel === mode ? 'block' : 'none';
        });
      });
    });
  });
}

// ================= ANTI COPY/PASTE =================
function attachAntiCopyPasteHandlers() {
  document.querySelectorAll('.no-paste-textarea').forEach(ta => {
    ['paste', 'copy', 'cut', 'contextmenu'].forEach(evt => {
      ta.addEventListener(evt, (e) => {
        e.preventDefault();
        showToast('Copy & paste is disabled during the exam. Please type your own answer.');
      });
    });
    ta.addEventListener('keydown', (e) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (isModifier && ['c', 'v', 'x', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        showToast('Copy & paste is disabled during the exam.');
      }
    });
  });

  // Also prevent copying the question text itself
  document.querySelectorAll('.no-copy').forEach(el => {
    el.addEventListener('copy', (e) => e.preventDefault());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

// ================= FILE UPLOAD PER QUESTION (image, PDF, docx, or txt) =================
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

function isAllowedFile(file) {
  if (file.type.startsWith('image/')) return true;
  const lowerName = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
}

function attachFileInputHandlers() {
  document.querySelectorAll('.answer-file-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const questionId = input.dataset.questionId;
      const file = e.target.files[0];
      if (!file) return;

      if (!isAllowedFile(file)) {
        showToast('Please choose an image, PDF, Word (.docx), or text (.txt) file.');
        input.value = '';
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        showToast('Please choose a file smaller than 8MB.');
        input.value = '';
        return;
      }

      questionFiles[questionId] = file;

      const previewWrap = document.querySelector(`.answer-image-preview-wrap[data-question-id="${questionId}"]`);

      if (file.type.startsWith('image/')) {
        // Show an actual image thumbnail
        const reader = new FileReader();
        reader.onload = () => {
          previewWrap.innerHTML = `
            <div class="answer-image-preview">
              <img src="${reader.result}" alt="Answer preview">
              <button type="button" class="answer-image-remove" data-question-id="${questionId}">✕ Remove</button>
            </div>
          `;
          previewWrap.querySelector('.answer-image-remove').addEventListener('click', () => {
            delete questionFiles[questionId];
            input.value = '';
            previewWrap.innerHTML = '';
          });
        };
        reader.readAsDataURL(file);
      } else {
        // Non-image files (PDF/docx/txt) get a simple filename chip instead of a thumbnail
        previewWrap.innerHTML = `
          <div class="answer-file-chip">
            📄 ${file.name}
            <button type="button" class="answer-image-remove" data-question-id="${questionId}">✕ Remove</button>
          </div>
        `;
        previewWrap.querySelector('.answer-image-remove').addEventListener('click', () => {
          delete questionFiles[questionId];
          input.value = '';
          previewWrap.innerHTML = '';
        });
      }
    });
  });
}

// ================= EXIT CONFIRMATION =================
document.getElementById('exitExamBtn').addEventListener('click', () => {
  const confirmed = window.confirm('Leave this exam? Your progress will be lost and this attempt will not be saved.');
  if (confirmed) {
    stopExamTimer();
    window.location.href = 'index.html';
  }
});

window.addEventListener('beforeunload', (e) => {
  if (document.getElementById('examResultScreen').style.display === 'none') {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ================= TIMER =================
let examTimerInterval = null;
let examEndTime = null;

function startExamTimer() {
  clearInterval(examTimerInterval);
  const timerEl = document.getElementById('examTimer');

  function tick() {
    const remainingMs = examEndTime - Date.now();

    if (remainingMs <= 0) {
      clearInterval(examTimerInterval);
      timerEl.textContent = "Time's up!";
      autoSubmitExam();
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    timerEl.textContent = `⏱ ${minutes}:${seconds.toString().padStart(2, '0')}`;

    timerEl.classList.remove('timer-warning', 'timer-danger');
    if (totalSeconds <= 30) timerEl.classList.add('timer-danger');
    else if (totalSeconds <= 120) timerEl.classList.add('timer-warning');
  }

  tick();
  examTimerInterval = setInterval(tick, 1000);
}

function stopExamTimer() {
  clearInterval(examTimerInterval);
  examTimerInterval = null;
}

async function autoSubmitExam() {
  showToast("Time's up! Submitting your answers automatically...");
  await doSubmitExam(true);
}

// ================= SUBMIT =================
document.getElementById('submitExamBtn').addEventListener('click', () => doSubmitExam(false));

async function doSubmitExam(isAutoSubmit) {
  const errorEl = document.getElementById('examSubmitError');
  errorEl.style.display = 'none';

  // Build the answers list: text or file per question
  const answersMeta = [];
  const missing = [];

  questionsData.forEach(q => {
    const mode = questionModes[q.id];
    if (mode === 'file') {
      if (questionFiles[q.id]) {
        answersMeta.push({ questionId: q.id, type: 'file' });
      } else {
        missing.push(q.id);
        answersMeta.push({ questionId: q.id, type: 'file' }); // still declared, backend will see no file
      }
    } else {
      const ta = document.querySelector(`textarea[data-question-id="${q.id}"]`);
      const val = ta ? ta.value.trim() : '';
      if (!val) missing.push(q.id);
      answersMeta.push({ questionId: q.id, type: 'text', studentAnswer: val || '(No answer provided)' });
    }
  });

  if (!isAutoSubmit && missing.length > 0) {
    errorEl.textContent = 'Please answer all questions (type an answer or upload a file) before submitting.';
    errorEl.style.display = 'block';
    return;
  }

  const submitBtn = document.getElementById('submitExamBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Grading with AI... this may take a few seconds';

  try {
    // Uses multipart/form-data so mixed text + file answers can go in one request.
    // Do NOT set a Content-Type header manually — the browser sets the correct
    // multipart boundary automatically when sending a FormData body.
    const formData = new FormData();
    formData.append('answers', JSON.stringify(answersMeta));
    Object.keys(questionFiles).forEach(qId => {
      formData.append(`answerFile_${qId}`, questionFiles[qId]);
    });

    const res = await fetch(`${API_BASE}/exams/${examId}/submit`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();

    if (!res.ok) {
      errorEl.textContent = data.message || 'Could not submit exam.';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Exam →';
      return;
    }

    stopExamTimer();
    showResultScreen(data.submission);
  } catch (err) {
    errorEl.textContent = 'Could not reach the server.';
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Exam →';
  }
}

function showResultScreen(submission) {
  document.getElementById('examQuestionsWrap').style.display = 'none';
  document.querySelector('.exam-submit-bar').style.display = 'none';
  document.querySelector('.exam-integrity-notice').style.display = 'none';

  document.getElementById('resultTotalScore').textContent = submission.totalScore ?? '-';

  const breakdown = document.getElementById('examResultBreakdown');
  breakdown.innerHTML = '';
  (submission.answers || []).forEach((ans, i) => {
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

  document.getElementById('examResultScreen').style.display = 'block';
}

document.getElementById('backToDashboardBtn').addEventListener('click', () => {
  window.location.href = 'index.html';
});