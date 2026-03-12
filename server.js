const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* ---------------- UTILITIES ---------------- */

function normalizeToWords(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[\.,\\/#!$%\^&\*;:{}=\-_`~()\[\]\"'<>?@+]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1));
}

/* ---------------- REFERENCE TEXT ---------------- */
const referencePath = path.join(__dirname, 'reference.txt');
let referenceText = '';
try {
  referenceText = fs.readFileSync(referencePath, 'utf8');
} catch {
  referenceText = '';
}

/* ---------------- AI DETECTION ---------------- */

function computeAiLikelihood(text, sentences, words) {
  if (!words.length) return 0;

  const lower = text.toLowerCase();
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const lengths = sentences.map(s => normalizeToWords(s).length).filter(n => n > 0);
  const avgLen = mean(lengths);
  const sdLen = stddev(lengths);

  let score = 0;

  if (avgLen >= 12 && avgLen <= 20 && sdLen < 6) score += 20;
  const variation = Math.max(...lengths) - Math.min(...lengths);
  if (variation < 8) score += 15;
  const uniqueRatio = new Set(words).size / words.length;
  if (uniqueRatio < 0.6) score += 15;

  const starters = sentences.map(s => s.split(" ")[0]?.toLowerCase());
  const starterRatio = new Set(starters).size / starters.length;
  if (starterRatio < 0.5) score += 10;

  const phrases = [
    "in conclusion","overall","furthermore","moreover",
    "it is important to note","this highlights that",
    "on the other hand","as a result","in summary",
    "this demonstrates","it can be observed","in addition"
  ];
  let hits = 0;
  phrases.forEach(p => { if (lower.includes(p)) hits++; });
  score += Math.min(hits * 6, 20);

  const errors = (text.match(/,,|!!|\?\?| {2,}/g) || []).length;
  if (errors === 0) score += 10;

  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  const repeated = Object.values(freq).filter(v => v > 4).length;
  if (repeated > words.length * 0.05) score += 10;

  if (referenceText) {
    const refWords = normalizeToWords(referenceText);
    const matches = words.filter(w => refWords.includes(w));
    const refRatio = matches.length / words.length;
    if (refRatio > 0.05) score += refRatio * 30;
  }

  if (sentenceCount > 8 && avgLen > 14) score += 5;

  return Math.min(Math.round(score), 100);
}

function labelAiScore(pct) {
  if (pct < 35) return 'Human-written';
  if (pct < 70) return 'Mixed (AI + Human)';
  return 'Likely AI-generated';
}

/* ---------------- SENTENCE HIGHLIGHT ---------------- */

// Accurate sentence splitting with positions
function splitSentencesWithPosition(text) {
  const sentenceEndRegex = /[.!?]+/g;
  const sentences = [];
  let lastIndex = 0;
  let match;

  while ((match = sentenceEndRegex.exec(text)) !== null) {
    const endIndex = match.index + match[0].length;
    const sentence = text.slice(lastIndex, endIndex).trim();
    if (sentence) {
      sentences.push({ text: sentence, start: lastIndex, end: endIndex });
    }
    lastIndex = endIndex;
  }

  // catch any remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) sentences.push({ text: remaining, start: lastIndex, end: text.length });
  }

  return sentences;
}

function analyzeSentences(text) {
  const rawSentences = splitSentencesWithPosition(text);
  return rawSentences.map(s => {
    const words = normalizeToWords(s.text);
    const score = computeAiLikelihood(s.text, [s.text], words);
    return {
      ...s,
      score,
      label: labelAiScore(score)
    };
  });
}

/* ---------------- FILE EXTRACTION ---------------- */

async function extractTextFromFile(filePath, name) {
  const ext = path.extname(name).toLowerCase();
  try {
    if (ext === '.txt') return fs.readFileSync(filePath, 'utf8');
    if (ext === '.pdf') {
      const data = fs.readFileSync(filePath);
      const parsed = await pdf(data);
      return parsed.text || '';
    }
    if (ext === '.docx') {
      const data = fs.readFileSync(filePath);
      const res = await mammoth.extractRawText({ buffer: data });
      return res.value || '';
    }
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function deleteFile(filePath) {
  fs.unlink(filePath, () => {});
}

/* ---------------- API ---------------- */

app.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    let text = '';
    let fileName = '';

    if (req.file) {
      fileName = req.file.originalname;
      text = await extractTextFromFile(req.file.path, fileName);
      deleteFile(req.file.path);
    } else if (req.body.text) {
      text = req.body.text;
    }

    const words = normalizeToWords(text);
    const aiScore = computeAiLikelihood(text, splitSentencesWithPosition(text).map(s => s.text), words);
    const highlights = analyzeSentences(text);

    res.json({
      fileName,
      wordCount: words.length,
      sentenceCount: highlights.length,
      aiLikelihood: aiScore,
      aiLabel: labelAiScore(aiScore),
      preview: text.slice(0, 300),
      highlights
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

/* ---------------- SERVER ---------------- */

app.listen(3000, () => {
  console.log("Server running on port 3000");
});