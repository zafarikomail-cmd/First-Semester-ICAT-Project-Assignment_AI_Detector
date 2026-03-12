// Multi-file assignment analysis (client-side)
// Supports TXT (FileReader), DOCX (mammoth), and PDF (pdf.js) in-browser

// Utility: normalize into words
function normalizeToWords(text) {
  const cleaned = (text || '')
    .toLowerCase()
    .replace(/[\.,\/#!$%\^&\*;:{}=\-_`~()\[\]\"'<>?@+]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned.split(' ').filter(Boolean);
}

function splitToSentences(text) {
  const parts = (text || '').replace(/\n+/g, ' ').split(/(?<=[.!?])\s+/);
  return parts.map(s => s.trim()).filter(Boolean);
}

function computeSimilarityPercentage(inputWords, referenceWords) {
  if (!inputWords || inputWords.length === 0) return 0;
  const refSet = new Set(referenceWords || []);
  let common = 0;
  for (const w of inputWords) if (refSet.has(w)) common++;
  return (common / inputWords.length) * 100;
}

function mean(values){ if (!values||values.length===0) return 0; return values.reduce((a,b)=>a+b,0)/values.length; }
function stddev(values){ if (!values||values.length<=1) return 0; const m=mean(values); const variance=values.reduce((s,x)=>s+(x-m)*(x-m),0)/(values.length-1); return Math.sqrt(variance); }

function computeAiLikelihood(text, sentences, words) {
  if (!words || words.length === 0) return 0;
  const sentenceLengths = (sentences||[]).map(s=>normalizeToWords(s).length).filter(n=>n>0);
  const avg = mean(sentenceLengths) || 0;
  const sd = stddev(sentenceLengths);
  let consistency = 0; if (avg>0) consistency = 1 - Math.min(1, sd / (avg + 1));

  const formalWords = ['moreover','furthermore','therefore','however','hence','thus','consequently','in conclusion','whereas','additionally'];
  const lowered = (text||'').toLowerCase();
  let formalCount = 0;
  for (const fw of formalWords){
    const re = new RegExp('\\b' + fw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\b','g');
    const m = lowered.match(re); if (m) formalCount += m.length;
  }
  const formalScore = Math.min(1, formalCount / Math.max(1, sentenceLengths.length * 0.3));

  const uniqueCount = new Set(words).size;
  const vocabRatio = uniqueCount / Math.max(1, words.length);
  const repetitionScore = Math.min(1, (1 - vocabRatio) * 1.5);

  // small heuristic for punctuation / short words indicating human writing
  const punctuationScore = ((text||'').match(/[!?\.]/g)||[]).length / Math.max(1, (text||'').split(' ').length);

  const aiScore = (consistency * 0.45) + (formalScore * 0.3) + (repetitionScore * 0.2) + (punctuationScore * 0.05);
  return Math.round(Math.max(0, Math.min(1, aiScore)) * 100);
}

// Compute a lightweight per-sentence AI-likelihood (0-100)
function computeSentenceAiScore(sentence, docWords){
  const text = (sentence || '').trim();
  const words = normalizeToWords(text);
  if (!words || words.length === 0) return 0;

  const formalWords = ['moreover','furthermore','therefore','however','hence','thus','consequently','in conclusion','whereas','additionally'];
  const lowered = text.toLowerCase();
  let formalCount = 0; for (const fw of formalWords){ try{ const re=new RegExp('\\b'+fw.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'\\b','g'); const m = lowered.match(re); if (m) formalCount += m.length;}catch(e){}
  }
  const formalScore = Math.min(1, formalCount/2);

  const uniqueCount = new Set(words).size;
  const vocabRatio = uniqueCount / Math.max(1, words.length);
  const repetitionScore = Math.min(1, (1 - vocabRatio) * 1.8);

  const punctuationCount = (text.match(/[!?\.]/g) || []).length;
  const punctuationScore = 1 - Math.min(1, punctuationCount / Math.max(1, Math.ceil(words.length/8)));

  const score = (formalScore * 0.35) + (repetitionScore * 0.35) + (punctuationScore * 0.3);
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

function labelAiScore(pct){ if (pct<=30) return 'Human-written'; if (pct<=60) return 'Mixed'; return 'Likely AI-generated'; }

// Universal Assignment Quality Score (0-100) - Independent of subject/content type
function computeAiContentScore(fileData) {
  if (!fileData) return 0;
  
  const text = fileData.text || '';
  const words = normalizeToWords(text);
  const sentences = fileData.sentencesWithDelimiters || [];
  
  if (words.length === 0) return 0;
  
  // 1. Structure & Organization (20%) - paragraph breaks, sentence variety, logical flow
  const structureScore = computeStructureScore(fileData);
  
  // 2. Clarity & Coherence (20%) - sentence length variation, topic consistency
  const clarityScore = computeClarityScore(fileData);
  
  // 3. Language Quality (15%) - vocabulary diversity, sentence complexity, grammar signals
  const languageScore = computeLanguageQuality(fileData);
  
  // 4. Depth of Content (15%) - word count, sentence count, content richness signals
  const depthScore = computeContentDepth(fileData);
  
  // 5. Originality (10%) - vocabulary uniqueness, sentence variation, low repetition
  const originalityScore = computeOriginality(fileData);
  
  // 6. Relevance to Topic (10%) - proper noun usage, specific terminology, contextual markers
  const relevanceScore = computeRelevance(fileData);
  
  // 7. Consistency & Flow (10%) - transition words, paragraph coherence, semantic continuity
  const consistencyScore = computeConsistency(fileData);
  
  // Weighted final score
  const finalScore = (
    structureScore * 0.20 +
    clarityScore * 0.20 +
    languageScore * 0.15 +
    depthScore * 0.15 +
    originalityScore * 0.10 +
    relevanceScore * 0.10 +
    consistencyScore * 0.10
  );
  
  return Math.round(Math.max(0, Math.min(100, finalScore)));
}

function computeStructureScore(fileData) {
  const sentences = fileData.sentencesWithDelimiters || [];
  const text = fileData.text || '';
  
  // Paragraph breaks
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const paragraphCount = Math.max(1, paragraphs.length);
  const avgSentencesPerPara = sentences.length / paragraphCount;
  
  // Ideal: 3-5 sentences per paragraph
  const paraStructureScore = avgSentencesPerPara >= 2 && avgSentencesPerPara <= 6 ? 80 : (avgSentencesPerPara > 0 ? 50 : 20);
  
  // Sentence variety (length variation)
  const sentenceLengths = sentences.map(s => normalizeToWords(s).length);
  const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length || 0;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLen, 2), 0) / sentenceLengths.length;
  const stdDev = Math.sqrt(variance);
  
  // Low variance = repetitive structure (bad), high variance = good variation
  const varietyScore = stdDev > 3 ? 90 : (stdDev > 1.5 ? 70 : 40);
  
  return (paraStructureScore * 0.4 + varietyScore * 0.6);
}

function computeClarityScore(fileData) {
  const sentences = fileData.sentencesWithDelimiters || [];
  const sentenceScores = fileData.sentenceScores || [];
  
  // Short sentences = clarity (average 10-25 words is ideal)
  const words = normalizeToWords(fileData.text || '');
  const avgWordPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
  
  // Ideal range: 12-20 words per sentence
  const lengthScore = (avgWordPerSentence > 8 && avgWordPerSentence < 30) ? 80 : (avgWordPerSentence > 5 ? 60 : 30);
  
  // Consistency in sentence quality across document
  if (sentenceScores.length > 1) {
    const scoresAvg = sentenceScores.reduce((a, b) => a + b, 0) / sentenceScores.length;
    const scoresVariance = sentenceScores.reduce((sum, score) => sum + Math.pow(score - scoresAvg, 2), 0) / sentenceScores.length;
    const scoresStdDev = Math.sqrt(scoresVariance);
    
    // Consistent quality (low variance) = better coherence
    const coherenceScore = scoresStdDev < 20 ? 85 : (scoresStdDev < 40 ? 70 : 50);
    return (lengthScore * 0.4 + coherenceScore * 0.6);
  }
  
  return lengthScore;
}

function computeLanguageQuality(fileData) {
  const text = fileData.text || '';
  const words = normalizeToWords(text);
  
  // Vocabulary diversity (unique words / total words)
  const uniqueWords = new Set(words).size;
  const vocabDiversity = (uniqueWords / Math.max(1, words.length)) * 100;
  
  // Good: 40-70% unique words
  const diversityScore = (vocabDiversity > 35 && vocabDiversity < 75) ? 90 : (vocabDiversity > 20 ? 70 : 40);
  
  // Formal language markers (transition words, conjunctions)
  const formalWords = ['moreover', 'furthermore', 'therefore', 'however', 'thus', 'consequently', 'additionally', 'nevertheless', 'indeed', 'meanwhile'];
  const lowered = text.toLowerCase();
  let formalCount = 0;
  for (const fw of formalWords) {
    const re = new RegExp(`\\b${fw}\\b`, 'g');
    const m = lowered.match(re);
    if (m) formalCount += m.length;
  }
  
  const formalScore = Math.min(100, (formalCount / Math.max(1, fileData.sentenceCount || 1)) * 30 * 100 / 30);
  
  // Punctuation variety (indicates expression nuance)
  const punctuation = (text.match(/[!?;:—-]/g) || []).length;
  const punctScore = Math.min(100, (punctuation / Math.max(1, words.length)) * 300);
  
  return (diversityScore * 0.4 + formalScore * 0.3 + punctScore * 0.3);
}

function computeContentDepth(fileData) {
  const words = fileData.wordCount || 0;
  const sentences = fileData.sentenceCount || 0;
  const charCount = fileData.charCount || 0;
  
  // Depth based on document length (word count)
  // Shallow: <100 words, Medium: 100-500, Good: 500-2000, Excellent: 2000+
  let lengthScore = 0;
  if (words < 50) lengthScore = 20;
  else if (words < 150) lengthScore = 40;
  else if (words < 300) lengthScore = 60;
  else if (words < 1000) lengthScore = 80;
  else lengthScore = 95;
  
  // Content density (average word length indicator of complexity)
  const avgCharPerWord = words > 0 ? charCount / words : 0;
  // Ideal: 4-6 characters per word (balanced)
  const densityScore = (avgCharPerWord > 3.5 && avgCharPerWord < 7) ? 85 : (avgCharPerWord > 3 ? 70 : 50);
  
  // Sentence count consistency (more sentences = more exploration)
  const sentenceDepth = Math.min(100, (sentences / Math.max(1, words)) * 20 * 100);
  
  return (lengthScore * 0.5 + densityScore * 0.3 + sentenceDepth * 0.2);
}

function computeOriginality(fileData) {
  const words = normalizeToWords(fileData.text || '');
  const topRepeatedWords = fileData.topRepeatedWords || '';
  
  // Low repetition = high originality
  // Parse top repeated words to count overall repetition
  const matches = topRepeatedWords.match(/\((\d+)\)/g) || [];
  let totalRepetition = 0;
  for (const match of matches) {
    totalRepetition += parseInt(match.slice(1, -1), 10);
  }
  
  // Repetition score: high repetition = low originality
  const repetitionRate = (totalRepetition / Math.max(1, words.length)) * 100;
  const repetitionScore = Math.max(20, 100 - repetitionRate * 2);
  
  // Unique word ratio
  const uniqueCount = new Set(words).size;
  const uniqueRatio = (uniqueCount / Math.max(1, words.length)) * 100;
  
  // Good: 40%+ unique words
  const uniquenessScore = uniqueRatio > 40 ? 90 : (uniqueRatio > 25 ? 70 : 40);
  
  return (repetitionScore * 0.5 + uniquenessScore * 0.5);
}

function computeRelevance(fileData) {
  const text = fileData.text || '';
  const lowered = text.toLowerCase();
  
  // Proper noun usage (capital letters at word start, excluding sentence start)
  const sentences = (text.match(/[^.!?]+[.!?]/g) || []);
  let properNouns = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentenceWords = (sentences[i].trim().match(/\b[A-Z][a-z]+\b/g) || []);
    // Subtract first word (typically sentence start)
    properNouns += Math.max(0, sentenceWords.length - 1);
  }
  
  // More proper nouns = specific references = higher relevance
  const properNounScore = Math.min(90, Math.max(40, properNouns * 3));
  
  // Specific terminology (numbers, years, technical patterns)
  const numbers = (text.match(/\d+/g) || []).length;
  const numberScore = Math.min(85, numbers * 2);
  
  // Context words (question marks show engagement, periods show assertions)
  const questions = (text.match(/\?/g) || []).length;
  const questionScore = questions > 0 ? 70 : 50;
  
  return (properNounScore * 0.4 + numberScore * 0.3 + questionScore * 0.3);
}

function computeConsistency(fileData) {
  const sentences = fileData.sentencesWithDelimiters || [];
  const text = fileData.text || '';
  
  // Transition words (moreover, however, therefore, etc.)
  const transitionWords = ['moreover', 'however', 'therefore', 'meanwhile', 'furthermore', 'additionally', 'however', 'thus', 'hence', 'consequently', 'nevertheless'];
  const lowered = text.toLowerCase();
  let transitionCount = 0;
  for (const tw of transitionWords) {
    const re = new RegExp(`\\b${tw}\\b`, 'g');
    const m = lowered.match(re);
    if (m) transitionCount += m.length;
  }
  
  // Good: 1-3 transitions per 100 words
  const transitionScore = transitionCount > 0 ? Math.min(90, 50 + transitionCount * 10) : 50;
  
  // Semantic flow: check if sentences get progressively longer or shorter (indicates buildup/conclusion)
  let flowScore = 50;
  if (sentences.length > 3) {
    const lengths = sentences.map(s => normalizeToWords(s).length);
    let patternChanges = 0;
    for (let i = 1; i < lengths.length; i++) {
      if ((lengths[i] > lengths[i-1] && lengths[i-1] > lengths[i-2]) || 
          (lengths[i] < lengths[i-1] && lengths[i-1] < lengths[i-2])) {
        patternChanges++;
      }
    }
    flowScore = Math.min(95, 50 + patternChanges * 8);
  }
  
  // Paragraph coherence (sentences within paragraphs relate to each other)
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  let coherenceScore = 50;
  if (paragraphs.length > 1) {
    coherenceScore = Math.min(90, 60 + paragraphs.length * 3);
  }
  
  return (transitionScore * 0.4 + flowScore * 0.3 + coherenceScore * 0.3);
}

function computeSentenceUniformity(sentenceScores) {
  if (!sentenceScores || sentenceScores.length < 2) return 0;
  const avg = sentenceScores.reduce((a, b) => a + b, 0) / sentenceScores.length;
  const variance = sentenceScores.reduce((sum, score) => sum + Math.pow(score - avg, 2), 0) / sentenceScores.length;
  const stdDev = Math.sqrt(variance);
  // Low standard deviation = uniform AI scores = AI-like
  // Normalize to 0-100: uniformity = 100 - (stdDev / 50 * 100), capped at 100
  return Math.min(100, Math.max(0, 100 - (stdDev / 50 * 100)));
}

function computeRepetitionDensity(topRepeatedWords, wordCount) {
  if (!topRepeatedWords || topRepeatedWords.length === 0 || wordCount === 0) return 0;
  // topRepeatedWords is formatted like "word (count), word (count), ..."
  let repetitionCount = 0;
  const matches = topRepeatedWords.match(/\((\d+)\)/g) || [];
  for (const match of matches) {
    const count = parseInt(match.slice(1, -1), 10);
    repetitionCount += count;
  }
  // Repetition density as percentage
  const density = (repetitionCount / wordCount) * 100;
  return Math.min(100, density);
}

function computeStructuralPredictability(sentencesWithDelimiters) {
  if (!sentencesWithDelimiters || sentencesWithDelimiters.length < 2) return 0;
  const sentenceLengths = sentencesWithDelimiters.map(s => (s || '').length);
  const avg = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  if (avg === 0) return 0;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) / sentenceLengths.length;
  const stdDev = Math.sqrt(variance);
  // Low std dev = predictable lengths = AI-like
  const deviation = (stdDev / avg) * 100;
  return Math.max(0, 100 - Math.min(100, deviation));
}

function computeLexicalDiversity(text, wordCount) {
  if (wordCount === 0) return 0;
  const words = normalizeToWords(text || '');
  const uniqueWords = new Set(words).size;
  // High diversity = 100, low diversity = 0
  const diversity = (uniqueWords / Math.max(1, words.length)) * 100;
  return Math.min(100, diversity);
}

// reference.txt loading removed — application no longer uses a static reference file

// Detect subjects from content using keyword matching (simple heuristic)
function detectSubjects(text){
  const map = {
    'Programming': ['\bfunction\b','\bdef\b','\bclass\b','\bconsole\.log\b','\bSystem\.out\b','#include','\bimport\b','\bpublic\b','\bprivate\b','\bvar\b','\blet\b','\bconst\b'],
    'Data Structures': ['\bstack\b','\bqueue\b','\blinked list\b','\bbinary tree\b','\bhash table\b','\bgraph\b','\bdfs\b','\bbfs\b'],
    'Algorithms': ['\bsort\b','\bsearch\b','\bdynamic programming\b','\bgreedy\b','\bbinary search\b','\bmerge sort\b','\bquick sort\b'],
    'Databases': ['\bselect\b','\binsert\b','\bupdate\b','\bdelete\b','\bfrom\b','\bwhere\b','\bjoin\b','\bsql\b','\bnosql\b'],
    'Operating Systems': ['\bprocess\b','\bthread\b','\bscheduler\b','\bkernel\b','\bmutex\b','\bdeadlock\b'],
    'Networks': ['\bprotocol\b','\btcp\b','\budp\b','\bip\b','\brouting\b','\blayer\b'],
    'Software Engineering': ['\buml\b','\brequirements\b','\btesting\b','\bversion control\b','\bagile\b','\bwaterfall\b'],
    'Web Development': ['<html','<body','<script','css','\bhttp\b','\bhtml\b','\bcss\b','\bjavascript\b'],
    'AI/ML': ['\bmachine learning\b','\bneural network\b','\bdeep learning\b','\bclassification\b','\bregression\b','\bsvm\b','\bpython\b\s+import\s+tensorflow'],
    'Cybersecurity': ['\bencryption\b','\bssl\b','\btls\b','\battack\b','\bvulnerability\b','\bcrypt\b'],
    'Computer Architecture': ['\bcache\b','\binstruction\b','\bpipeline\b','\bregister\b','\balu\b']
  };
  const lowered = (text||'').toLowerCase();
  const scores = {};
  for (const [subject, patterns] of Object.entries(map)){
    let count = 0;
    for (const p of patterns){
      try{ const re = new RegExp(p,'g'); const m = lowered.match(re); if (m) count += m.length; }catch(e){}
    }
    if (count>0) scores[subject] = count;
  }
  // Sort by matches
  const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]).map(s=>s[0]);
  return sorted.length?sorted.slice(0,3):['General'];
}

// DOM wiring
// Persistent file store - survives page navigation
if (!window.fileStore) window.fileStore = [];
if (!window.fileStoreNames) window.fileStoreNames = [];

// Configuration: allowed extensions and preferred list (edit as needed)
const ALLOWED_EXTENSIONS = ['.txt', '.pdf', '.docx'];
// Preferred list provided by user (can include exact filenames or extensions like '.txt')
const PREFERRED_ALLOWED = ['.text', '.pdf', '.docx'];

function normalizePreferred(p){
  // map common variant .text -> .txt
  if (!p) return p;
  const t = p.trim().toLowerCase();
  if (t === '.text') return '.txt';
  return t;
}

const NORMALIZED_PREFERRED = PREFERRED_ALLOWED.map(normalizePreferred).filter(Boolean);

// Global download handler so it can be reattached reliably after navigation/back
window.handleDownloadReport = function(fileIndex){
  try {
    // If a fileIndex is provided, try to download only that file's report
    if (typeof fileIndex === 'number' && !Number.isNaN(fileIndex)){
      // try to read processed docs from sessionStorage or memory
      let processed = window._lastReport || (()=>{ try{ const s = sessionStorage.getItem('filesAnalysis'); return s?JSON.parse(s):null;}catch(e){return null;} })();
      if (!processed) processed = (()=>{ try{ const s = sessionStorage.getItem('lastReport'); return s?JSON.parse(s):null;}catch(e){return null;} })();
      if (processed && processed[fileIndex]){
        const d = processed[fileIndex];
        const parts = [];
        parts.push('AI Assignment Analysis - Single File');
        parts.push('File: ' + (d.name || 'Unnamed'));
        parts.push('Words: ' + (d.wordCount||0));
        parts.push('Sentences: ' + (d.sentenceCount||0));
        parts.push('AI likelihood: ' + (d.aiLikelihood||0) + '%');
        parts.push('Mark: ' + (d.aiContentScore||0) + ' / 100');
        parts.push('Top repeated words: ' + ((d.repeated||[]).slice(0,5).map(r=>`${r.word}(${r.count})`).join(', ') || 'N/A'));
        parts.push('---');
        parts.push((d.text||'').slice(0,2000));
        const text = parts.join('\n');
        const filename = `analysis-${(d.name||'file').replace(/[^a-z0-9\.\-]/gi,'_')}-${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        return;
      }
    }

    // Prefer text report stored in-memory; fall back to sessionStorage
    let reportText = window._lastReportText || sessionStorage.getItem('lastReportText');
    if (reportText) {
      const filename = `analysis-report-${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`;
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return;
    }

    // Fallback: JSON report
    const jsonReport = window._lastReport || (()=>{ try{ const s = sessionStorage.getItem('lastReport'); return s?JSON.parse(s):null;}catch(e){return null;} })();
    if (!jsonReport) return;
    const blob = new Blob([JSON.stringify(jsonReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-report-${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Download failed', e);
  }
};

// Ensure pageshow reattaches handler even if page was restored from bfcache
window.addEventListener('pageshow', (ev)=>{
  try{
    const downloadBtn = document.getElementById && document.getElementById('downloadBtn');
    if (downloadBtn && sessionStorage.getItem('filesAnalysis')){
      downloadBtn.style.display = 'inline-block';
      downloadBtn.onclick = window.handleDownloadReport;
    }
  }catch(e){}
});

document.addEventListener('DOMContentLoaded', ()=>{
  const fileInput = document.getElementById('fileInput');
  const textInput = document.getElementById('textInput');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const uploadList = document.getElementById('uploadList');
  const resultsGrid = document.getElementById('resultsGrid');

  // Initialize from persistent store on page load
  let selectedFiles = window.fileStore.slice();

  // pdf.js worker
  if (window['pdfjsLib']) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

  function formatBytes(bytes){ if (bytes===0) return '0 B'; const k=1024, sizes=['B','KB','MB','GB']; const i=Math.floor(Math.log(bytes)/Math.log(k)); return (bytes/Math.pow(k,i)).toFixed(2)+' '+sizes[i]; }

  // Restore upload list and results on navigation back
  function restoreUiState() {
    const uploadedFiles = sessionStorage.getItem('uploadedFiles');
    if (uploadedFiles) {
      const filesData = JSON.parse(uploadedFiles);
      uploadList.innerHTML = '';
      for (const f of filesData) {
        const div = document.createElement('div');
        div.className = 'upload-item';
        div.innerHTML = `<div style="flex:1"><div class="file-meta">${escapeHtml(f.name)} <span class="small-muted">(${f.size})</span></div></div><div class="badge">${f.type || 'n/a'}</div>`;
        uploadList.appendChild(div);
      }
    }
    const filesAnalysis = sessionStorage.getItem('filesAnalysis');
    if (filesAnalysis) {
      try {
        const analysisDocs = JSON.parse(filesAnalysis);
        resultsGrid.innerHTML = '';
        for (let i = 0; i < analysisDocs.length; i++) {
          renderFileResult(analysisDocs[i], i);
        }
        downloadBtn.style.display = 'inline-block';
      } catch (e) {}
    }
  }

  // When returning via back/forward cache the page may restore visual state
  // without re-running scripts. Ensure UI is reconstructed on pageshow.
  window.addEventListener('pageshow', (event) => {
    try{
      if (sessionStorage.getItem('uploadedFiles') || sessionStorage.getItem('filesAnalysis')) {
        restoreUiState();
        analyzeBtn.disabled = false;
        // Ensure download button is visible and its handler is attached after navigation
        try{
          if (downloadBtn && sessionStorage.getItem('filesAnalysis')){
            downloadBtn.style.display = 'inline-block';
            // attach handler in case it was lost due to navigation caching
            downloadBtn.onclick = handleDownloadBtnClick;
          }
        }catch(e){}
      }
    }catch(e){}
  });
  
  // Restore UI on page load if files already exist in sessionStorage
  const uploadedFiles = sessionStorage.getItem('uploadedFiles');
    try {
      const filesData = JSON.parse(uploadedFiles);
      if (filesData.length > 0) {
        selectedFiles = filesData.map((f, i) => ({
          name: f.name,
          size: 0,
          type: f.type
        }));
        restoreUiState();
        analyzeBtn.disabled = false;
      }
    } catch (e) {}

  fileInput.addEventListener('change', (e)=>{
    const rawFiles = Array.from(e.target.files || []);
    if (rawFiles.length > 30) { alert('Please select up to 30 files.'); fileInput.value=''; selectedFiles=[]; window.fileStore=[]; uploadList.innerHTML=''; analyzeBtn.disabled=true; return; }

    const allowed = [];
    const rejected = [];

    for (const f of rawFiles){
      const name = (f.name || '').toString();
      const dot = name.lastIndexOf('.');
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';

      // If preferred list contains exact filenames (no leading dot), enforce whitelist
      const exactNames = NORMALIZED_PREFERRED.filter(p=> !p.startsWith('.'));
      if (exactNames.length > 0){
        if (exactNames.includes(name.toLowerCase())) allowed.push(f); else rejected.push(name);
        continue;
      }

      // Normalize preferred extensions and check allowed extensions
      const preferredExts = NORMALIZED_PREFERRED.filter(p=> p.startsWith('.'));
      const extAllowed = ALLOWED_EXTENSIONS.includes(ext) || preferredExts.includes(ext);
      if (extAllowed) allowed.push(f); else rejected.push(name);
    }

    if (rejected.length > 0){
      // show custom warning modal with single Close button
      try{ const modal = document.getElementById('uploadWarningModal'); const body = document.getElementById('uploadWarningBody'); if (body) body.textContent = 'These files were not uploaded because their type is not allowed:\n' + rejected.join('\n'); if (modal) modal.setAttribute('aria-hidden','false'); const closer = document.getElementById('uploadWarningClose'); if (closer) closer.onclick = ()=> modal.setAttribute('aria-hidden','true'); }catch(e){ alert('These files were not uploaded because their type is not allowed:\n' + rejected.join('\n')); }
    }

    // Clear original input and replace internal selection with allowed files
    fileInput.value = null;
    selectedFiles = allowed.slice();
    window.fileStore = selectedFiles.slice();

    const filesData = selectedFiles.map(f => ({name: f.name, size: formatBytes(f.size), sizeBytes: f.size, type: f.type || 'file'}));
    sessionStorage.setItem('uploadedFiles', JSON.stringify(filesData));
    renderUploadList();
    analyzeBtn.disabled = selectedFiles.length === 0 && !textInput.value.trim();
  });

  const subjectSelect = document.getElementById('subjectSelect');
  const analyzingBadge = document.getElementById('analyzingBadge');

  textInput.addEventListener('input', ()=>{ analyzeBtn.disabled = selectedFiles.length === 0 && !textInput.value.trim(); });

  clearBtn.addEventListener('click', ()=>{
    fileInput.value=null; selectedFiles=[]; window.fileStore=[]; window.fileStoreNames=[]; textInput.value=''; uploadList.innerHTML=''; resultsGrid.innerHTML=''; sessionStorage.removeItem('uploadedFiles'); sessionStorage.removeItem('filesContent'); analyzeBtn.disabled=true; downloadBtn.style.display='none';
  });

  function handleDownloadBtnClick(){
    // delegate to the global handler to ensure availability after back/forward
    if (window && typeof window.handleDownloadReport === 'function') return window.handleDownloadReport();
    // fallback: same inline behavior
    if (window._lastReportText) {
      downloadTextFile(window._lastReportText, `analysis-report-${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.txt`);
      return;
    }
    if (!window._lastReport) return;
    const blob = new Blob([JSON.stringify(window._lastReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis-report.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Use single onclick assignment to avoid duplicate handlers
  downloadBtn.onclick = handleDownloadBtnClick;


  // Generate a human-readable plain-text report from processed docs
  // generateTextReport now accepts subject select element
  function generateTextReport(docs, subjectSelectEl){
    const now = new Date();
    const header = [];
    header.push('AI Assignment Analysis System');
    header.push('Report generated: ' + now.toLocaleString());
    // Subject info
    let subject = 'General';
    try{
      if (subjectSelectEl && subjectSelectEl.value) subject = subjectSelectEl.value;
    }catch(e){}
    header.push('Subject (selected): ' + subject);
    // Overall subjects detected across documents
    const allSubjects = Array.from(new Set(docs.flatMap(d=>d.subjects||[])));
    header.push('Subjects detected: ' + (allSubjects.length? allSubjects.join(', ') : 'General'));
    header.push('='.repeat(60));

    const filesLine = docs.map(d=>`- ${d.name} (${d.size ? formatBytes(d.size) : 'n/a'})`).join('\n');
    header.push('Files analyzed:');
    header.push(filesLine);
    header.push('='.repeat(60));

    // Aggregate totals
    const totalWords = docs.reduce((s,d)=>s + (d.wordCount||0),0);
    const totalSentences = docs.reduce((s,d)=>s + (d.sentenceCount||0),0);
    const avgSentenceOverall = totalSentences ? (totalWords / totalSentences).toFixed(2) : '0.00';

    const summary = [];
    summary.push('Basic statistics:');
    summary.push(`Total word count: ${totalWords}`);
    summary.push(`Total sentence count: ${totalSentences}`);
    summary.push(`Average sentence length (overall): ${avgSentenceOverall}`);
    summary.push('='.repeat(60));

    const sections = [];
    for (const d of docs){
      sections.push(`File: ${d.name}`);
      sections.push(`- Selected Subject: ${subjectSelectEl ? subjectSelectEl.value : 'General'}`);
      if (d.subjects && d.subjects.length) sections.push(`- Detected Subjects: ${d.subjects.join(', ')}`);
      else sections.push(`- Detected Subjects: General`);
      sections.push(`- AI likelihood: ${d.aiLikelihood}%`);
      sections.push(`- Word Count: ${d.wordCount}`);
      sections.push(`- Character Count: ${d.charCount}`);
      sections.push(`- Sentences: ${d.sentenceCount}`);
      sections.push(`- Avg. sentence length: ${d.avgSentence}`);
      sections.push('- Top repeated words: ' + (d.repeated && d.repeated.slice(0,5).map(r=>`${r.word}(${r.count})`).join(', ') || 'N/A'));
      sections.push(`- Mark: ${d.aiContentScore || 0} / 100`);
      sections.push(`- Code content: ${d.codeLines} lines (${d.codePercentage}%)`);
      sections.push(`- Image / screenshot likely: ${d.possibleScreenshot ? 'Yes' : 'No'}`);
      sections.push('-'.repeat(60));
    }

    const footer = [];
    footer.push('Disclaimer: AI detection is based on linguistic patterns and provides an estimated likelihood, not a confirmed result.');
    footer.push('End of report');

    return [header.join('\n'), summary.join('\n'), sections.join('\n'), footer.join('\n')].join('\n\n');
  }

  function downloadTextFile(text, filename){ const blob = new Blob([text], {type:'text/plain;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename || 'analysis-report.txt'; a.click(); URL.revokeObjectURL(url); }

  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[c]); }

  function renderUploadList(){ uploadList.innerHTML=''; for(const f of selectedFiles){ const div=document.createElement('div'); div.className='upload-item'; div.innerHTML=`<div style="flex:1"><div class=\"file-meta\">${escapeHtml(f.name)} <span class=\"small-muted\">(${formatBytes(f.size)})</span></div></div><div class=\"badge\">${f.type||'n/a'}</div>`; uploadList.appendChild(div);} }

  analyzeBtn.addEventListener('click', async ()=>{
    analyzeBtn.disabled=true; analyzeBtn.textContent='Analyzing...'; resultsGrid.innerHTML=''; downloadBtn.style.display='none';
    if (analyzingBadge) analyzingBadge.style.display = 'flex';

    const docs = [];
    for (const f of selectedFiles){ const text = await extractTextFromFileClient(f); docs.push({name:f.name,size:f.size,text}); }
    if (textInput.value.trim()) docs.push({name:'Pasted Text', size:textInput.value.length, text:textInput.value});
    if (docs.length===0){ alert('No documents to analyze'); analyzeBtn.disabled=false; analyzeBtn.textContent='Analyze'; return; }

    const processed = docs.map(d=>({ ...d, words: normalizeToWords(d.text), sentences: splitToSentences(d.text) }));

    for (let i=0;i<processed.length;i++){
      const base=processed[i];
      // Character count
      base.charCount = (base.text || '').length;
      // Detect subjects from content
      base.subjects = detectSubjects(base.text);
      // Detect code-like content (simple heuristic)
      const lines = (base.text||'').split(/\r?\n/);
      const codeLike = lines.filter(l=>/\b(function|def|class|console\.|System\.|#include|import |public |private |var |let |const )\b|\{|;\s*$/.test(l)).length;
      base.codeLines = codeLike;
      base.codePercentage = Math.round((codeLike / Math.max(1, lines.length)) * 100);

      // Screenshot / image detection heuristic: low extracted text but file size large or many PDF pages empty
      base.possibleScreenshot = false;
      if (base.size && base.size > 100000 && (base.text||'').trim().length < 200) base.possibleScreenshot = true;
      // Compute best match among other uploaded documents (reference file removed)
      let best = { name: '', pct: 0 };
      for (let j=0;j<processed.length;j++){ if (i===j) continue; const other=processed[j]; const pct = computeSimilarityPercentage(base.words, other.words); if (pct>best.pct){ best={name:other.name,pct}; } }
      base.bestMatch=best;
      base.aiLikelihood=computeAiLikelihood(base.text, base.sentences, base.words);
      base.aiLabel=labelAiScore(base.aiLikelihood);
      base.wordCount=base.words.length;
      base.sentenceCount=base.sentences.length;
      base.avgSentence= base.sentenceCount ? +(base.wordCount/base.sentenceCount).toFixed(2):0;
      const freq={}; for(const w of base.words) freq[w]=(freq[w]||0)+1; base.repeated=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([w,c])=>({word:w,count:c}));
    }

    // postpone report generation until after aiContentScore is computed below

    // Store file contents and conservative per-sentence AI signal analysis for preview in details.html
    function analyzeSentenceSignals(s){
      const t = (s||'').trim();
      const low = t.toLowerCase();
      const signals = {};
      // Generic phrasing
      signals.generic = /\b(in conclusion|overall|this paper|this document|this study|the purpose of)\b/.test(low);
      // Template-like numbering or bullets
      signals.template = /^\s*(first|second|third|finally|in the first|in the second)\b|\b\d+\.|\b(i|ii|iii)\b/i.test(t);
      // Predictable transitions
      signals.transition = /\b(moreover|furthermore|therefore|however|thus|consequently|additionally)\b/.test(low);
      // Repetitive syntax patterns (repeated short words or phrases)
      const words = normalizeToWords(t);
      const freq={}; for(const w of words) freq[w]=(freq[w]||0)+1; signals.repetitive = Object.values(freq).some(c=>c>=3);
      // Semantic vagueness
      signals.vague = /\b(some|many|various|several|often|generally|typically|may|might|could)\b/.test(low);
      // Mechanical tone (few personal pronouns)
      const pronouns = (t.match(/\b(I|we|my|our|us|mine)\b/gi)||[]).length; signals.mechanical = pronouns===0 && words.length>6;
      // Over-neutral language (lots of passive markers like 'is' + past participle)
      signals.passive = /\bis\s+\w+ed\b|\bwas\s+\w+ed\b/.test(low);
      // Lack of contextual specificity (no numbers, no proper nouns - heuristic)
      const hasNumber = /\d/.test(t); const hasProper = /\b[A-Z][a-z]{2,}\b/.test(t); signals.nonspecific = !hasNumber && !hasProper && words.length>6;
      const count = Object.values(signals).filter(Boolean).length;
      return {signals, count};
    }

    const filesContent = processed.map(doc => {
      const text = doc.text || '';
      // preserve original sentence delimiters and trailing spaces so preview matches source
      const sentencesWithDelimiters = (text && text.match(/[^.!?]+[.!?]*\s*/g)) || doc.sentences || [];
      const analysis = sentencesWithDelimiters.map(s => analyzeSentenceSignals(s));
      // Candidate indices: sentences with >=3 signals
      const candidates = analysis.map((a, i) => ({i, count:a.count, len: (sentencesWithDelimiters[i]||'').length})).filter(c=>c.count>=3);
      const totalLen = text.length || Math.max(1, sentencesWithDelimiters.join('').length);
      // sort candidates by count desc, shorter first to respect coverage cap
      candidates.sort((a,b)=> b.count - a.count || a.len - b.len);
      const cap = Math.floor(totalLen * 0.30); // max allowed highlighted characters
      let sum=0; const highlightedIndices = new Set();
      for(const c of candidates){ if (sum + c.len <= cap){ sum += c.len; highlightedIndices.add(c.i); } }

      const highlightedPercent = Math.round((sum / totalLen) * 100);

      // Compute per-sentence AI scores for uniformity analysis
      const sentenceScores = sentencesWithDelimiters.map(s => computeSentenceAiScore(s, doc.words));
      
      // Format top repeated words for display and scoring
      const topRepeatedWords = doc.repeated.slice(0, 5).map(r => `${r.word} (${r.count})`).join(', ');
      
      // Compute comprehensive AI Content Score
      const fileData = {
        text,
        sentencesWithDelimiters,
        sentenceScores,
        highlightedPercent,
        topRepeatedWords,
        wordCount: doc.wordCount
      };
      const aiContentScore = computeAiContentScore(fileData);
      
      return {
        name: doc.name,
        text,
        sentencesWithDelimiters,
        sentenceSignals: analysis.map(a=>a.count),
        highlightedIndices: Array.from(highlightedIndices),
        highlightedCharCount: sum,
        highlightedPercent,
        wordCount: doc.wordCount,
        sentenceCount: sentencesWithDelimiters.length || doc.sentenceCount,
        charCount: text.length || 0,
        aiContentScore,
        topRepeatedWords
      };
    });
    sessionStorage.setItem('filesContent', JSON.stringify(filesContent));
    
    // Add aiContentScore back to processed items for UI rendering on restore
    for (let i = 0; i < processed.length; i++) {
      if (filesContent[i]) {
        processed[i].aiContentScore = filesContent[i].aiContentScore;
      }
    }
    
    // Render results with complete data (including aiContentScore)
    for(let i=0; i<processed.length; i++) renderFileResult(processed[i], i);
    
    // Store full analysis for UI restoration on back navigation - AFTER aiContentScore is added
    sessionStorage.setItem('filesAnalysis', JSON.stringify(processed));
    // Generate and persist the final report (after aiContentScore has been attached)
    try {
      window._lastReport = processed;
      const reportText = generateTextReport(processed, subjectSelect);
      window._lastReportText = reportText;
      downloadBtn.style.display = 'inline-block';
      try {
        sessionStorage.setItem('lastReport', JSON.stringify(processed));
        sessionStorage.setItem('lastReportText', reportText);
      } catch (e) {}
    } catch (e) {
      console.error('Report generation failed', e);
    }
    
    analyzeBtn.disabled=false; analyzeBtn.textContent='Analyze';
    if (analyzingBadge) analyzingBadge.style.display = 'none';
  });

  async function extractTextFromFileClient(file){ const name=(file.name||'').toLowerCase(); if (name.endsWith('.txt')) return await readFileAsText(file); if (name.endsWith('.docx')){ try{ const ab = await file.arrayBuffer(); const res = await mammoth.extractRawText({arrayBuffer:ab}); return res.value||'';}catch(e){return'';} } if (name.endsWith('.pdf')){ try{ const ab = await file.arrayBuffer(); if (!window['pdfjsLib']) return ''; const loadingTask = pdfjsLib.getDocument({data:ab}); const pdfDoc = await loadingTask.promise; let text=''; for(let p=1;p<=pdfDoc.numPages;p++){ const page = await pdfDoc.getPage(p); const content = await page.getTextContent(); const strings = content.items.map(i=>i.str); text += strings.join(' ')+"\n"; } return text; }catch(e){return ''; } } return await readFileAsText(file); }

  function readFileAsText(file){ return new Promise((resolve)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result||''); r.onerror=()=>resolve(''); r.readAsText(file); }); }

  function renderFileResult(doc, fileIndex){
    const card=document.createElement('div');
    card.className='file-card';
    const statusClass = doc.aiLikelihood>=61?'status-ai':(doc.aiLikelihood>=31?'status-mixed':'status-human');
    const subjectsText = (doc.subjects||[]).slice(0,3).map(s=>escapeHtml(s)).join(', ');
    const repeatedText = (doc.repeated||[]).slice(0,5).map(r=>`${escapeHtml(r.word)} (${r.count})`).join(', ');
    const bestPct = doc.bestMatch && doc.bestMatch.pct ? (Math.round(doc.bestMatch.pct*100)/100) : 0;
    const selectedSubject = subjectSelect ? subjectSelect.value : 'General';
    const aiContentScore = doc.aiContentScore || 0;

    card.innerHTML = `
      <div class="row"><div><strong>${escapeHtml(doc.name)}</strong> <span class="small-muted">— ${doc.wordCount} words</span></div><div class="status-badge ${statusClass}">${doc.aiLabel}</div></div>
      <div class="row"><div class="small-muted">Selected Subject</div><div><strong>${selectedSubject}</strong></div></div>
      <div class="row"><div class="small-muted">Detected Subjects</div><div>${subjectsText || 'General'}</div></div>
      <div class="row"><div class="small-muted">AI likelihood</div><div><strong>${doc.aiLikelihood}%</strong></div></div>
      <div class="progress"><div class="progress-fill ${doc.aiLikelihood>=61? 'ai':''}" style="width:${doc.aiLikelihood}%"></div></div>
      <div class="row"><div class="small-muted">Word Count</div><div><strong>${doc.wordCount}</strong></div></div>
      <div class="row"><div class="small-muted">Character Count</div><div><strong>${doc.charCount}</strong></div></div>
      <div class="row"><div class="small-muted">Sentences</div><div><strong>${doc.sentenceCount}</strong></div></div>
      <div class="row"><div class="small-muted">Avg. sentence length</div><div>${doc.avgSentence}</div></div>
      <div class="row"><div class="small-muted">Top repeated words</div><div>${repeatedText || '—'}</div></div>
      <div class="row"><div class="small-muted">Mark</div><div><strong>${aiContentScore} / 100</strong></div></div>
      <div class="row"><div class="small-muted">Code content</div><div>${doc.codeLines} lines (${doc.codePercentage}%)</div></div>
      <div class="row"><div class="small-muted">Image / screenshot likely</div><div>${doc.possibleScreenshot ? 'Yes' : 'No'}</div></div>
      <div class="row" style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.1)"><a href="details.html?fileIndex=${fileIndex}" class="primary" style="padding:8px 16px;text-decoration:none;border-radius:4px;background:#0066cc;color:white;display:inline-block;font-size:13px;font-weight:600">View Preview</a></div>
    `;
    resultsGrid.appendChild(card);
  }

});

// Global handler for instruction modals (pages that include script.js)
document.addEventListener('click', (e)=>{
  const btn = e.target.closest && e.target.closest('.instruction-btn');
  if (btn){
    const target = btn.getAttribute('data-target');
    if (target){
      const modal = document.getElementById(target);
      if (modal) modal.setAttribute('aria-hidden','false');
    }
    return;
  }
  const close = e.target.closest && e.target.closest('.instruction-close');
  if (close){
    const modal = close.closest('.instruction-modal');
    if (modal) modal.setAttribute('aria-hidden','true');
    return;
  }
});

// Close modal on Escape
document.addEventListener('keydown', (ev)=>{
  if (ev.key === 'Escape'){
    document.querySelectorAll('.instruction-modal[aria-hidden="false"]').forEach(m=>m.setAttribute('aria-hidden','true'));
  }
});