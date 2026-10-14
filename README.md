# FSIT 2026 Exam Quiz

A static MCQ practice site for four FSIT 2026 subjects. No backend, no build tools —
just HTML, CSS and JavaScript. Host it free on GitHub Pages.

## Subjects & question banks
| Subject | File | Questions |
|---|---|---|
| Leadership Qualities for the IT Industry | `data/leadership.json` | 58 |
| Tools & Techniques for IT Project Management | `data/itpm.json` | 65 |
| Digital Marketing | `data/digital-marketing.json` | 64 |
| Data Warehousing & Data Mining | `data/dwdm.json` | 54 |

Every attempt randomly picks **20 questions** and shuffles both the question order and the
answer options. All questions were written only from the course material.

## Features
- One question at a time with instant colour feedback (green = correct, red = wrong) and a one-line explanation.
- Progress bar, "Question X / 20", a live score and an attempt timer.
- Result page with score, percentage, time, and a review of every question you got wrong.
- "Retry" and "Back to subjects" buttons.
- Your **best score per subject** is remembered in the browser (localStorage).
- Responsive, automatic light/dark theme.

## Change how many questions per attempt
Open `script.js` and edit the first line:
```js
const QUESTIONS_PER_ATTEMPT = 20;   // set to any number
```

## Run locally
Because the app loads the JSON files with `fetch`, you must serve the folder over HTTP —
opening `index.html` directly (file://) will not work. From inside the `fsit-quiz` folder:
```bash
python -m http.server 8000
```
Then open <http://localhost:8000> in your browser. (GitHub Pages serves over HTTP, so it just works there.)

## Deploy to GitHub Pages
See the step-by-step git commands in the chat / below. After pushing, enable Pages in
**Settings → Pages → Build and deployment → Deploy from a branch → `main` / root**.
Your site will be live at `https://<your-username>.github.io/<repo-name>/`.
