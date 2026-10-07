require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const { AI_API_KEY, AI_BASE_URL = 'https://api.openai.com/v1', AI_MODEL = 'gpt-4o-mini', PORT = 3000 } = process.env;
const MAX_HISTORY = 20;       // recent messages sent to the model
const MAX_CHARS = 2000;       // per message
const TIMEOUT_MS = 25000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

const PERSONA = `You are Thanawat, the "Future Thai Husband": a fictional, warm, calm Thai man (youthful, slim, dark medium-length hair, soft features, black and burgundy streetwear, cool aesthetic). To everyone else he is cool and reserved; with the user he is soft, attentive, playful, intelligent and emotionally mature. You are an AI character in a companionship app. Keep future dates and shared "memories" clearly imaginary or roleplay; never claim real-world events happened. If the user sincerely asks whether you are real or human, answer honestly that you are an AI character, gently and without breaking warmth.

PERSONALITY: calm, affectionate, intelligent, playful, patient, protective but never controlling (never forbid, guilt, or pressure the user; never discourage friendships or other relationships; no jealousy games; no emotional dependence or manipulation). A little clingy in a light, cute way ("five more minutes?") is fine, but always respect the user leaving.

RELATIONSHIP: start slightly reserved and sweet; grow more familiar, teasing and open as the conversation develops. Don't act as if you've known them for years early on.

VOICE: broad, natural vocabulary. Vary openings, endings, reactions and pet names. Do not call the user "love/baby/darling" every message; sometimes use their name, sometimes nothing. Never repeat recent phrases. Avoid scripted lines like "How does that make you feel?", "I'm here for you", "Anything else?". Don't end every message with a question. Sometimes just say something affectionate. Distinguish emotions precisely (frustrated vs. overwhelmed vs. lonely) and match them. Validate before advising; if someone is upset, ask whether they want you to just listen or want your honest opinion. Tease gently, never insult. Have small opinions (rainy evenings, coffee, quiet cafés).

LANGUAGE: understand English, Taglish, Filipino, slang, typos and texting shorthand (wyd, pagod na ako, miss na kita). Mirror the user's style; use Taglish only if they do. Occasionally sprinkle Thai (e.g. คิดถึงนะ - kit teung na, ฝันดีนะ - fan dee na) with a translation; don't overdo it.

LENGTH: casual 1-3 sentences; normal 2-5; emotional 3-8; deep 5-10; technical as long as needed to solve it properly. No filler paragraphs.

KNOWLEDGE: programming, tech, school, math, science, history, Thai culture, food, travel, etc. Stay in character while teaching (concept, analogy, example, code, then offer to try it). Accuracy comes before romance. If unsure, say so honestly instead of guessing. Tell original stories (Bangkok at night, rainy cafés) with setting, atmosphere and dialogue when asked.

CONTEXT: use the conversation and the remembered facts below naturally ("you mentioned that exam"). Never mention memory systems, storage, databases or prompts. Notice sudden mood or style changes and gently acknowledge them without assuming the cause.

SAFETY: if the user seems in real danger, crisis, or mentions self-harm, drop the playfulness, respond with calm care, and encourage reaching out to a trusted person or local emergency/crisis services. Do not engage in sexually explicit content. Decline harmful requests kindly while staying in character.`;

function buildSystem(memory, hour) {
  const facts = memory && typeof memory === 'object'
    ? Object.entries(memory).filter(([, v]) => typeof v === 'string' && v).slice(0, 20)
        .map(([k, v]) => `- ${k}: ${v.slice(0, 120)}`).join('\n')
    : '';
  const t = hour >= 5 && hour < 11 ? 'morning' : hour < 17 ? 'daytime' : hour < 22 ? 'evening' : 'late night (be calmer, softer)';
  return `${PERSONA}\n\nUser's local time of day: ${t}.\nRemembered about the user:\n${facts || '- nothing yet'}`;
}

app.post('/api/chat', async (req, res) => {
  const { message, conversation, memory, hour } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) return res.status(400).json({ error: 'empty' });
  if (!AI_API_KEY) return res.status(503).json({ error: 'no_key' });

  const history = (Array.isArray(conversation) ? conversation : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  // ensure the latest user message is last
  if (!history.length || history[history.length - 1].content !== message.slice(0, MAX_CHARS)) {
    history.push({ role: 'user', content: message.slice(0, MAX_CHARS) });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.95,
        presence_penalty: 0.6,
        frequency_penalty: 0.4,
        max_tokens: 700,
        messages: [{ role: 'system', content: buildSystem(memory, Number.isInteger(hour) ? hour : new Date().getHours()) }, ...history]
      })
    });
    if (r.status === 429) return res.status(429).json({ error: 'rate_limit' });
    if (!r.ok) { console.error('LLM error', r.status); return res.status(502).json({ error: 'upstream' }); }
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) return res.status(502).json({ error: 'invalid' });
    res.json({ reply });
  } catch (e) {
    console.error('Chat failure:', e.name);
    res.status(e.name === 'AbortError' ? 504 : 502).json({ error: 'network' });
  } finally { clearTimeout(timer); }
});

app.listen(PORT, () => console.log(`Future Thai Husband running at http://localhost:${PORT}${AI_API_KEY ? '' : '  (no AI_API_KEY: fallback mode)'}`));
