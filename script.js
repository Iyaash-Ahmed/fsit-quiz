/* ============================================================
   FSIT 2026 Quiz — vanilla JS, no dependencies
   Features: length chooser / mock exam, mixed all-subjects exam,
             study mode (flashcards), per-subject stats,
             retry-wrong-only.
   ============================================================ */

// ---- Configuration -----------------------------------------
const DEFAULT_LENGTH = 20;          // default questions per attempt
const DATA_FILES = [
  'data/leadership.json',
  'data/itpm.json',
  'data/digital-marketing.json',
  'data/dwdm.json'
];
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ---- State -------------------------------------------------
let subjects = [];        // loaded subject objects
let mixed = null;         // pseudo-subject pooling all questions
let setupSubject = null;  // subject chosen on the setup screen
let setupLength = DEFAULT_LENGTH;
let current = null;       // current quiz attempt
let study = null;         // current study session
let timerId = null;

// ---- Elements ----------------------------------------------
const views = {
  home: document.getElementById('view-home'),
  setup: document.getElementById('view-setup'),
  quiz: document.getElementById('view-quiz'),
  study: document.getElementById('view-study'),
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
  window.scrollTo({ top: 0 });
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ---- Stats (localStorage) ----------------------------------
function statKey(id) { return 'fsit_stat_' + id; }
function getStat(id) {
  try { return JSON.parse(localStorage.getItem(statKey(id))) || null; }
  catch { return null; }
}
function recordResult(id, pct) {
  const s = getStat(id) || { best: 0, last: 0, attempts: 0 };
  const isNewBest = pct > s.best;
  s.best = Math.max(s.best, pct);
  s.last = pct;
  s.attempts += 1;
  localStorage.setItem(statKey(id), JSON.stringify(s));
  return isNewBest;
}

// ---- Load subjects -----------------------------------------
async function loadSubjects() {
  try {
    subjects = await Promise.all(DATA_FILES.map(async f => {
      const res = await fetch(f);
      if (!res.ok) throw new Error(`${f}: ${res.status}`);
      return res.json();
    }));
    const allQ = subjects.flatMap(s => s.questions);
    mixed = {
      id: 'mixed',
      name: 'Mixed Exam — All Subjects',
      blurb: 'One combined paper drawing random questions from all four subjects.',
      questions: allQ,
      isMixed: true
    };
    renderHome();
  } catch (err) {
    el('cards').innerHTML =
      `<p style="color:var(--wrong);grid-column:1/-1">Could not load question data (${err.message}).<br>
       If you opened this file directly, run a local web server instead. On GitHub Pages it works automatically.</p>`;
  }
}

// ---- Home --------------------------------------------------
function statLine(id) {
  const s = getStat(id);
  if (!s) return 'Not attempted';
  return `Best ${s.best}% · ${s.attempts} attempt${s.attempts === 1 ? '' : 's'}`;
}
function renderHome() {
  const wrap = el('cards');
  wrap.innerHTML = '';
  [...subjects, mixed].forEach(subj => {
    const btn = document.createElement('button');
    btn.className = 'card' + (subj.isMixed ? ' accent' : '');
    btn.innerHTML = `
      <h2>${subj.name}</h2>
      <p class="blurb">${subj.blurb || ''}</p>
      <span class="meta">
        <span class="count-badge">${subj.questions.length} questions</span>
        <span class="best">${statLine(subj.id)}</span>
      </span>`;
    btn.addEventListener('click', () => openSetup(subj));
    wrap.appendChild(btn);
  });
}

// ---- Setup screen ------------------------------------------
function lengthOptions(total) {
  const opts = [10, 20, 50, 100].filter(n => n < total).map(n => ({ label: String(n), value: n }));
  opts.push({ label: `All (${total})`, value: total });
  return opts;
}
function openSetup(subj) {
  setupSubject = subj;
  el('setupTitle').textContent = subj.name;
  el('setupBlurb').textContent = subj.blurb || '';

  const total = subj.questions.length;
  setupLength = Math.min(DEFAULT_LENGTH, total);

  const chips = el('lengthChips');
  chips.innerHTML = '';
  lengthOptions(total).forEach(o => {
    const c = document.createElement('button');
    c.className = 'chip' + (o.value === setupLength ? ' active' : '');
    c.textContent = o.label;
    c.addEventListener('click', () => {
      setupLength = o.value;
      chips.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      updateSetupNote();
    });
    chips.appendChild(c);
  });
  updateSetupNote();
  show('setup');
}
function updateSetupNote() {
  const total = setupSubject.questions.length;
  const isMock = setupLength >= 50 || setupLength === total;
  el('setupNote').textContent = isMock
    ? `Mock-exam length — ${setupLength} questions. Options are shuffled; the timer runs throughout.`
    : `${setupLength} random questions with instant feedback.`;
}

// ---- Build & start an attempt ------------------------------
function buildAttemptQuestions(rawList) {
  return rawList.map(q => ({
    raw: q,
    q: q.q,
    explanation: q.explanation,
    options: shuffle(q.options.map((text, i) => ({ text, correct: i === q.answer })))
  }));
}
function startAttempt(subj, count, opts = {}) {
  const recordStats = opts.recordStats !== false;
  const label = opts.label || subj.name;
  const rawList = opts.rawList || shuffle(subj.questions).slice(0, Math.min(count, subj.questions.length));

  current = {
    subject: { id: subj.id, name: label },
    statId: recordStats ? subj.id : null,
    count: count,
    questions: buildAttemptQuestions(rawList),
    index: 0,
    score: 0,
    answered: false,
    wrong: [],          // raw question objects
    startTime: Date.now()
  };

  el('quizSubject').textContent = label;
  startTimer();
  show('quiz');
  renderQuestion();
}
function retryWrong() {
  if (!current || !current.wrong.length) return;
  startAttempt(current.subject, current.wrong.length, {
    rawList: shuffle(current.wrong.map(w => w.raw)),
    recordStats: false,
    label: current.subject.name + ' — missed only'
  });
}

function startTimer() {
  stopTimer();
  el('timer').textContent = '00:00';
  timerId = setInterval(() => {
    el('timer').textContent = fmtTime(Math.floor((Date.now() - current.startTime) / 1000));
  }, 1000);
}
function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }

// ---- Render a quiz question --------------------------------
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
    btn.addEventListener('click', () => chooseAnswer(i));
    li.appendChild(btn);
    list.appendChild(li);
  });

  el('explain').hidden = true;
  el('nextBtn').hidden = true;
  el('nextBtn').textContent = current.index === total - 1 ? 'See results →' : 'Next →';
}

// ---- Answer a quiz question --------------------------------
function chooseAnswer(chosenIdx) {
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
    current.wrong.push({ raw: item.raw, your: item.options[chosenIdx].text });
  }

  const verdict = el('explainVerdict');
  verdict.textContent = isRight ? 'Correct' : 'Not quite';
  verdict.className = 'explain-label ' + (isRight ? 'ok' : 'no');
  el('explainText').textContent = item.explanation;
  el('explain').hidden = false;

  el('nextBtn').hidden = false;
  el('nextBtn').focus();
}
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

  let isNewBest = false, bestTxt = '';
  if (current.statId) {
    isNewBest = recordResult(current.statId, pct);
    bestTxt = isNewBest ? 'New best!' : `Best: ${getStat(current.statId).best}%`;
  } else {
    bestTxt = 'Practice drill (not scored to your stats)';
  }

  el('resultScore').textContent = `${score} / ${total}`;
  el('resultPct').textContent = `${pct}%`;
  el('resultSubject').textContent = current.subject.name;
  el('resultTime').textContent = `Time: ${fmtTime(elapsed)}`;
  el('resultBest').textContent = bestTxt;

  let title = 'Keep practising!';
  if (pct === 100) title = 'Perfect score!';
  else if (pct >= 80) title = 'Excellent work!';
  else if (pct >= 60) title = 'Good effort!';
  else if (pct >= 40) title = 'Getting there…';
  el('resultTitle').textContent = title;

  // retry-wrong button
  const rw = el('retryWrongBtn');
  if (current.wrong.length > 0) {
    rw.hidden = false;
    rw.textContent = `Retry wrong only (${current.wrong.length})`;
  } else {
    rw.hidden = true;
  }

  // review of wrong answers
  const list = el('reviewList');
  const heading = el('reviewHeading');
  list.innerHTML = '';
  if (current.wrong.length === 0) {
    heading.hidden = true;
    list.innerHTML = '<p class="all-correct">You answered every question correctly — nothing to review!</p>';
  } else {
    heading.hidden = false;
    heading.textContent = `Review — ${current.wrong.length} to revisit`;
    current.wrong.forEach(w => {
      const q = w.raw;
      const div = document.createElement('div');
      div.className = 'review-item';
      div.innerHTML = `
        <p class="rq">${q.q}</p>
        <p class="ra you">Your answer: ${w.your}</p>
        <p class="ra right">Correct answer: ${q.options[q.answer]}</p>
        <p class="rex">${q.explanation}</p>`;
      list.appendChild(div);
    });
  }
  show('result');
}

// ---- Study mode (flashcards) -------------------------------
function openStudy(subj) {
  study = { subj, list: subj.questions, index: 0, revealed: false };
  el('studyTitle').textContent = subj.name + ' — Study';
  renderStudy();
  show('study');
}
function renderStudy() {
  const total = study.list.length;
  const q = study.list[study.index];
  study.revealed = false;

  el('studyCounter').textContent = `${study.index + 1} / ${total}`;
  el('studyQuestion').textContent = q.q;

  const list = el('studyOptions');
  list.innerHTML = '';
  q.options.forEach((text, i) => {
    const li = document.createElement('li');
    li.className = 'option static';
    li.innerHTML = `<span class="key">${LETTERS[i]}</span><span class="label">${text}</span>`;
    li.dataset.correct = (i === q.answer) ? '1' : '0';
    list.appendChild(li);
  });

  el('studyReveal').hidden = true;
  el('studyShow').hidden = false;
  el('studyPrev').disabled = study.index === 0;
  el('studyNext').disabled = study.index === total - 1;
}
function studyShowAnswer() {
  if (study.revealed) return;
  study.revealed = true;
  const q = study.list[study.index];
  el('studyOptions').querySelectorAll('.option').forEach(li => {
    if (li.dataset.correct === '1') {
      li.classList.add('correct');
      li.insertAdjacentHTML('beforeend', '<span class="mark">✓</span>');
    }
  });
  el('studyExplain').textContent = q.explanation;
  el('studyReveal').hidden = false;
  el('studyShow').hidden = true;
}
function studyMove(delta) {
  const n = study.index + delta;
  if (n < 0 || n >= study.list.length) return;
  study.index = n;
  renderStudy();
}

// ---- Navigation --------------------------------------------
function goHome() {
  stopTimer();
  renderHome();
  show('home');
}

// ---- Wire up -----------------------------------------------
el('brandLink').addEventListener('click', e => { e.preventDefault(); goHome(); });
el('setupBack').addEventListener('click', goHome);
el('startQuizBtn').addEventListener('click', () => startAttempt(setupSubject, setupLength));
el('studyBtn').addEventListener('click', () => openStudy(setupSubject));

el('nextBtn').addEventListener('click', nextQuestion);
el('quitBtn').addEventListener('click', goHome);

el('retryBtn').addEventListener('click', () => startAttempt(current.subject.id === 'mixed' ? mixed : (subjects.find(s => s.id === current.subject.id) || setupSubject), current.count));
el('retryWrongBtn').addEventListener('click', retryWrong);
el('backBtn').addEventListener('click', goHome);

el('studyBack').addEventListener('click', () => openSetup(study.subj));
el('studyShow').addEventListener('click', studyShowAnswer);
el('studyPrev').addEventListener('click', () => studyMove(-1));
el('studyNext').addEventListener('click', () => studyMove(1));

// Keyboard
document.addEventListener('keydown', e => {
  if (!views.quiz.hidden) {
    if (!current.answered && /^[1-6]$/.test(e.key)) {
      const btns = el('options').querySelectorAll('.option');
      if (btns[Number(e.key) - 1]) btns[Number(e.key) - 1].click();
    } else if (current.answered && (e.key === 'Enter' || e.key === 'ArrowRight')) {
      nextQuestion();
    }
  } else if (!views.study.hidden) {
    if (e.key === 'ArrowRight') studyMove(1);
    else if (e.key === 'ArrowLeft') studyMove(-1);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); studyShowAnswer(); }
  }
});

loadSubjects();
