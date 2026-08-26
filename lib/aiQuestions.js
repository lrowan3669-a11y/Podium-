// Drafts question-mode questions with Claude, for the "Generate with AI"
// wizard in Teacher Admin. Deliberately a thin wrapper over a plain fetch
// call rather than the Anthropic SDK — one less dependency, and this is
// the only place in the app that needs it.
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'; // cost-efficient default; override with ANTHROPIC_MODEL

function isConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

function buildPrompt({ subject, topic, level, senFriendly, count }) {
  const lines = [
    `Write exactly ${count} short quiz questions for a UK classroom "question mode" round.`,
    `Subject: ${subject}.`,
  ];
  if (topic) lines.push(`Topic/focus: ${topic}.`);
  if (level) lines.push(`Pupil level: ${level}.`);
  if (senFriendly) {
    lines.push(
      'These pupils have additional learning needs (SEN). Write for that: short sentences, one idea per question, plain everyday words, no double negatives, no trick questions, no ambiguous wording.'
    );
  }
  lines.push(
    '',
    'For each question, decide whether it fits multiple-choice or a short free-text answer — mix both if it suits the questions, don\'t force everything into one shape.',
    'For multiple-choice questions, provide exactly 4 short options, one of which exactly matches the answer.',
    'For free-text questions, omit options entirely so the pupil types the answer.',
    '',
    'Reply with ONLY a JSON array, no other text, no markdown code fence. Each element:',
    '{"question_text": "...", "answer_text": "...", "options": ["...", "...", "...", "..."] or null}',
    'The answer_text must be short (a word or short phrase) since it\'s matched against the pupil\'s typed answer.'
  );
  return lines.join('\n');
}

function extractJsonArray(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) throw new Error('no JSON array found in the AI response');
  return JSON.parse(text.slice(start, end + 1));
}

function validateQuestions(raw, expectedCount) {
  if (!Array.isArray(raw) || !raw.length) throw new Error('AI response was not a non-empty array');
  return raw.slice(0, expectedCount).map((q, i) => {
    if (!q || typeof q.question_text !== 'string' || !q.question_text.trim()) {
      throw new Error(`question ${i + 1} is missing question_text`);
    }
    if (typeof q.answer_text !== 'string' || !q.answer_text.trim()) {
      throw new Error(`question ${i + 1} is missing answer_text`);
    }
    let options = null;
    if (Array.isArray(q.options) && q.options.length) {
      options = q.options.map((o) => String(o).trim()).filter(Boolean);
      if (!options.some((o) => o.toLowerCase() === q.answer_text.trim().toLowerCase())) {
        options.push(q.answer_text.trim()); // AI sometimes drops it — don't discard an otherwise-good question
      }
    }
    return { question_text: q.question_text.trim(), answer_text: q.answer_text.trim(), options };
  });
}

async function generateQuestions({ subject, topic, level, senFriendly, count }) {
  if (!isConfigured()) {
    const err = new Error('AI question generation isn\'t set up yet — add ANTHROPIC_API_KEY in your deployment\'s environment variables.');
    err.notConfigured = true;
    throw err;
  }

  const prompt = buildPrompt({ subject, topic, level, senFriendly, count });
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 300) || res.statusText}`);
  }

  const data = await res.json();
  const text = (data.content || []).map((block) => block.text || '').join('');
  const raw = extractJsonArray(text);
  return validateQuestions(raw, count);
}

module.exports = { generateQuestions, isConfigured };
