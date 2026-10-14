/* ============================================================
   FSIT 2026 Quiz — vanilla JS, no dependencies
   ============================================================ */

// ---- Configuration -----------------------------------------
const QUESTIONS_PER_ATTEMPT = 20;   // change this to show more/fewer questions per attempt
const DATA_FILES = [
  'data/leadership.json',
  'data/itpm.json',
  'data/digital-marketing.json',
  'data/dwdm.json'
];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ---- State -------------------------------------------------
let subjects = [];          // loaded subject objects
let current = null;         // current attempt state
let timerId = null;

// ---- Elements ----------------------------------------------
const views = {
  home: document.getElementById('view-home'),
  quiz: document.getElementById('view-quiz'),
  result: document.getElementById('view-result')
};
const el = id => document.getElementById(id);

// ---- Helpers -----------------------------------------------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function show(viewName) {
  Object.values(views).forEach(v => (v.hidden = true));
  views[viewName].hidden = false;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function bestKey(id) { return 'fsit_best_' + id; }
function getBest(id) {
  const v = localStorage.getItem(bestKey(id));
  return v === null ? null : Number(v);
}
function setBest(id, pct) {
  const prev = getBest(id);
  if (prev === null || pct > prev) {
    localStorage.setItem(bestKey(id), String(pct));
    return true; // new best
  }
  return false;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---- Load subjects -----------------------------------------
async function loadSubjects() {
  try {
    subjects = await Promise.all(DATA_FILES.map(async f => {
      const res = await fetch(f);
      if (!res.ok) throw new Error(`${f}: ${res.status}`);
      return res.json();
    }));
    renderHome();
  } catch (err) {
    el('cards').innerHTML =
      `<p style="color:var(--wrong);grid-column:1/-1">Could not load question data (${err.message}).<br>
       If you opened this file directly, run a local web server instead — see the README /
       deploy instructions. On GitHub Pages it will work automatically.</p>`;
  }
}

// ---- Home --------------------------------------------------
function renderHome() {
  el('qCountLabel').textContent = QUESTIONS_PER_ATTEMPT;
  const wrap = el('cards');
  wrap.innerHTML = '';
  subjects.forEach(subj => {
    const best = getBest(subj.id);
    const bestTxt = best === null ? 'Not attempted' : `Best: ${best}%`;
    const btn = document.createElement('button');
    btn.className = 'card';
    btn.innerHTML = `
      <span class="icon">${subj.icon || '📘'}</span>
      <h2>${subj.name}</h2>
      <p class="blurb">${subj.blurb || ''}</p>
      <span class="meta">
        <span class="count-badge">${subj.questions.length} questions</span>
        <span class="best">${bestTxt}</span>
      </span>`;
    btn.addEventListener('click', () => startAttempt(subj));
    wrap.appendChild(btn);
  });
}

// ---- Start an attempt --------------------------------------
function startAttempt(subj) {
  const take = Math.min(QUESTIONS_PER_ATTEMPT, subj.questions.length);
  const picked = shuffle(subj.questions).slice(0, take).map(q => {
    // Build options with correctness flag, then shuffle their order
    const opts = shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })));
    return { q: q.q, explanation: q.explanation, options: opts };
  });

  current = {
    subject: subj,
    questions: picked,
    index: 0,
    score: 0,
    answered: false,
    wrong: [],          // {q, your, correct, explanation}
    startTime: Date.now()
  };

  el('quizSubject').textContent = subj.name;
  startTimer();
  show('quiz');
  renderQuestion();
}

function startTimer() {
  stopTimer();
  el('timer').textContent = '00:00';
  timerId = setInterval(() => {
    const sec = Math.floor((Date.now() - current.startTime) / 1000);
    el('timer').textContent = fmtTime(sec);
  }, 1000);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

// ---- Render a question -------------------------------------
function renderQuestion() {
  const total = current.questions.length;
  const item = current.questions[current.index];
  current.answered = false;

  el('progressText').textContent = `Question ${current.index + 1} / ${total}`;
  el('scoreText').textContent = `Score: ${current.score}`;
  el('progressFill').style.width = `${(current.index / total) * 100}%`;

  el('questionText').textContent = item.q;

  const list = el('options');
  list.innerHTML = '';
  item.options.forEach((opt, i) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.innerHTML = `<span class="key">${LETTERS[i]}</span><span class="label">${opt.text}</span>`;
    btn.addEventListener('click', () => chooseAnswer(i, btn));
    li.appendChild(btn);
    list.appendChild(li);
  });

  // reset explanation + next
  el('explain').hidden = true;
  el('nextBtn').hidden = true;
  el('nextBtn').textContent =
    current.index === total - 1 ? 'See results →' : 'Next →';
}

// ---- Answer a question -------------------------------------
function chooseAnswer(chosenIdx, btnEl) {
  if (current.answered) return;
  current.answered = true;

  const item = current.questions[current.index];
  const optionButtons = Array.from(el('options').querySelectorAll('.option'));
  const correctIdx = item.options.findIndex(o => o.correct);
  const isRight = item.options[chosenIdx].correct;

  optionButtons.forEach((b, i) => {
    b.disabled = true;
    if (i === correctIdx) {
      b.classList.add('correct');
      b.insertAdjacentHTML('beforeend', '<span class="mark">✓</span>');
    }
    if (i === chosenIdx && !isRight) {
      b.classList.add('wrong');
      b.insertAdjacentHTML('beforeend', '<span class="mark">✗</span>');
    }
  });

  if (isRight) {
    current.score++;
    el('scoreText').textContent = `Score: ${current.score}`;
  } else {
    current.wrong.push({
      q: item.q,
      your: item.options[chosenIdx].text,
      correct: item.options[correctIdx].text,
      explanation: item.explanation
    });
  }

  // explanation
  const verdict = el('explainVerdict');
  verdict.textContent = isRight ? 'Correct' : 'Not quite';
  verdict.className = 'explain-label ' + (isRight ? 'ok' : 'no');
  el('explainText').textContent = item.explanation;
  el('explain').hidden = false;

  el('nextBtn').hidden = false;
  el('nextBtn').focus();
}

// ---- Next / finish -----------------------------------------
function nextQuestion() {
  if (!current.answered) return;
  if (current.index < current.questions.length - 1) {
    current.index++;
    renderQuestion();
  } else {
    finishAttempt();
  }
}

// ---- Result ------------------------------------------------
function finishAttempt() {
  stopTimer();
  const total = current.questions.length;
  const score = current.score;
  const pct = Math.round((score / total) * 100);
  const elapsed = Math.floor((Date.now() - current.startTime) / 1000);
  const isNewBest = setBest(current.subject.id, pct);

  el('resultScore').textContent = `${score} / ${total}`;
  el('resultPct').textContent = `${pct}%`;
  el('resultSubject').textContent = `📘 ${current.subject.name}`;
  el('resultTime').textContent = `⏱ ${fmtTime(elapsed)}`;

  const best = getBest(current.subject.id);
  el('resultBest').textContent = isNewBest ? `🏆 New best!` : `🏆 Best: ${best}%`;

  // emoji + title by band
  let emoji = '💪', title = 'Keep practising!';
  if (pct === 100) { emoji = '🏆'; title = 'Perfect score!'; }
  else if (pct >= 80) { emoji = '🎉'; title = 'Excellent work!'; }
  else if (pct >= 60) { emoji = '👍'; title = 'Good effort!'; }
  else if (pct >= 40) { emoji = '📚'; title = 'Getting there…'; }
  el('resultEmoji').textContent = emoji;
  el('resultTitle').textContent = title;

  // review of wrong answers
  const list = el('reviewList');
  const heading = el('reviewHeading');
  list.innerHTML = '';
  if (current.wrong.length === 0) {
    heading.hidden = true;
    list.innerHTML = '<p class="all-correct">✅ You answered every question correctly — nothing to review!</p>';
  } else {
    heading.hidden = false;
    heading.textContent = `Review — ${current.wrong.length} to revisit`;
    current.wrong.forEach(w => {
      const div = document.createElement('div');
      div.className = 'review-item';
      div.innerHTML = `
        <p class="rq">${w.q}</p>
        <p class="ra you">Your answer: ${w.your}</p>
        <p class="ra right">Correct answer: ${w.correct}</p>
        <p class="rex">${w.explanation}</p>`;
      list.appendChild(div);
    });
  }

  show('result');
}

// ---- Navigation --------------------------------------------
function goHome() {
  stopTimer();
  renderHome();      // refresh best-score badges
  show('home');
}

// ---- Wire up -----------------------------------------------
el('nextBtn').addEventListener('click', nextQuestion);
el('retryBtn').addEventListener('click', () => startAttempt(current.subject));
el('backBtn').addEventListener('click', goHome);
el('quitBtn').addEventListener('click', goHome);
el('brandLink').addEventListener('click', e => { e.preventDefault(); goHome(); });

// Keyboard: 1-4 to answer, Enter/→ for next
document.addEventListener('keydown', e => {
  if (views.quiz.hidden) return;
  if (!current.answered && /^[1-6]$/.test(e.key)) {
    const idx = Number(e.key) - 1;
    const btns = el('options').querySelectorAll('.option');
    if (btns[idx]) btns[idx].click();
  } else if (current.answered && (e.key === 'Enter' || e.key === 'ArrowRight')) {
    nextQuestion();
  }
});

loadSubjects();
