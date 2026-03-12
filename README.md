# Web-Based Assignment Plagiarism & AI Content Detection Tool

Simple academic project demonstrating local plagiarism and AI-like content detection without external APIs.

Files:
- `index.html` — main UI
- `style.css` — basic styling
- `script.js` — detection logic and UI wiring
- `reference.txt` — sample reference text used for similarity checks

How to use:
1. Open `index.html` in a browser (double-click or serve from a local server).
2. Upload a `.txt` file or paste text into the textarea.
3. Click "Analyze" to get:
   - Word count
   - Sentence count
   - Average sentence length
   - Plagiarism / similarity percentage (compares words to `reference.txt`)
   - AI-generated likelihood percentage and label (Human-written / Mixed / Likely AI-generated)

Notes & limitations:
- This project uses simple, explainable heuristics suitable for coursework. It is not production-grade.
- AI detection is only an estimation. See the disclaimer in the UI.
- No external APIs or network calls are required except loading `reference.txt` locally.

Server mode (recommended for PDF / DOCX support):

1. Install dependencies (Node.js required):

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open the app at `http://localhost:3000/index.html` and upload `.txt`, `.pdf`, or `.docx` files.

Notes:
- The server uses `pdf-parse` and `mammoth` to extract text from PDF and DOCX files.
- AI detection is an estimation based on simple linguistic heuristics.

Ideas for extension:
- Use multiple reference files or simple n-gram overlap for stronger plagiarism checks.
- Add a settings panel to tune weights used in AI-likelihood computation.

Enjoy and modify for learning!