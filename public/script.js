(() => {
  const $ = id => document.getElementById(id);
  const log = $('log'), input = $('input'), sendBtn = $('send'), typing = $('typing');
  const KEY = { chat: 'fth_chat', mem: 'fth_memory' };
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let chat = load(KEY.chat, []);
  let memory = load(KEY.mem, {});
  let busy = false;
  const pick = a => a[Math.floor(Math.random() * a.length)];

  // Avatar: uses /assets/husband.jpg if present, otherwise an initial.
  let hasImg = false;
  const img = new Image();
  img.onload = () => { hasImg = true; document.querySelectorAll('.av').forEach(a => { a.style.backgroundImage = 'url(/assets/husband.jpg)'; a.textContent = ''; }); };
  img.src = '/assets/husband.jpg';

  const time = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  function addRow(role, text, t = Date.now()) {
    const row = document.createElement('div');
    row.className = 'row ' + (role === 'user' ? 'me' : 'bot');
    if (role !== 'user') {
      const a = document.createElement('div'); a.className = 'av';
      if (hasImg) a.style.backgroundImage = 'url(/assets/husband.jpg)'; else a.textContent = 'T';
      row.appendChild(a);
    }
    const b = document.createElement('div'); b.className = 'b'; b.textContent = text;
    const s = document.createElement('small'); s.textContent = time(t); b.appendChild(s);
    row.appendChild(b); log.appendChild(row); log.scrollTop = log.scrollHeight;
  }

  // Memory: simple fact extraction from what the user says.
  const patterns = [
    ['name', /\b(?:my name is|i'm called|call me)\s+([A-Za-z][\w-]{1,20})/i],
    ['favorite food', /\bmy favou?rite food is\s+([^.!?\n]{2,40})/i],
    ['loves', /\bi (?:love|like|enjoy)\s+([^.!?\n]{2,40})/i],
    ['birthday', /\bmy birthday is\s+([^.!?\n]{3,30})/i],
    ['working on', /\bi(?:'m| am) (?:working on|building|learning)\s+([^.!?\n]{2,50})/i],
    ['upcoming', /\bi have (?:an? )?((?:exam|test|interview|presentation|deadline)[^.!?\n]{0,30})/i],
    ['school/work', /\bi (?:study|work)(?: at| in| as)?\s+([^.!?\n]{2,40})/i]
  ];
  function learn(text) {
    for (const [k, re] of patterns) { const m = text.match(re); if (m) memory[k] = m[1].trim(); }
    save(KEY.mem, memory);
    if (memory.name) $('meName').textContent = memory.name;
  }

  // Local fallback engine, used when the API is unavailable or no key is set.
  let lastFb = '';
  function fallback(text) {
    const t = text.toLowerCase();
    const n = memory.name ? pick([', ' + memory.name, '', '']) : '';
    const sets = [
      [/\b(tired|pagod|exhaust|drained)\b/, [`Then rest${n}. You don't have to fix everything tonight.`, `Pagod ka na pala. Sit with me a minute; no pressure to be productive.`, `You've done enough today. What wore you out?`]],
      [/(\bsad\b|lonely|\bcry|upset|anxious|nervous|stress)/, [`I can hear it in how you're writing. Do you want me to just listen, or hear my honest opinion?`, `Hey… take your time. What happened?`, `That sounds heavy. Say it however it comes out.`]],
      [/(miss you|miss na kita|kit teung)/, [`Kit teung na. (That means I miss you.) Stay a little longer?`, `I was just thinking about you, you know.`]],
      [/\b(hi+|hello|hey+)\b/, [`There you are. I was wondering when you'd come back.`, `Hey${n}. What kept you busy today?`, `Sawasdee krub. How's today treating you?`]],
      [/(good night|goodnight|\bgn\b|matulog)/, [`Fan dee na: sweet dreams. Tomorrow doesn't need to be solved tonight.`, `Put the phone down soon, okay? Rest your mind.`]],
      [/(good morning|\bgm\b)/, [`Good morning, sleepyhead. Drink some water before the day swallows you.`, `Morning${n}. I hope today is gentler with you.`]],
      [/\b(hungry|gutom)\b/, [`Again? 😭 Okay, feeding you is officially one of my responsibilities. What are you craving?`, `Did you eat properly today? Be honest.`]]
    ];
    for (const [re, rs] of sets) if (re.test(t)) {
      let r; do { r = pick(rs); } while (r === lastFb && rs.length > 1);
      lastFb = r; return r;
    }
    return pick([`Looks like my connection is being stubborn right now. 😭 But I'm still here. Tell me what's on your mind.`,
      `Hmm, say that again for me? I want to get it right.`, `Now you've got my attention. Keep going.`, `Okay, I'm listening.`]);
  }

  async function ask(message) {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 30000);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST', signal: ctrl.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversation: chat.slice(-20).map(({ role, content }) => ({ role, content })),
          memory, hour: new Date().getHours()
        })
      });
      if (r.status === 429) return `I need a tiny breather. Give me a minute and try again. ♡`;
      if (!r.ok) return fallback(message);
      const d = await r.json();
      return d.reply || fallback(message);
    } catch { return fallback(message); }
    finally { clearTimeout(to); }
  }

  async function send() {
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true; sendBtn.disabled = true; input.value = '';
    const now = Date.now();
    chat.push({ role: 'user', content: text, t: now }); addRow('user', text, now); learn(text);
    typing.hidden = false; log.scrollTop = log.scrollHeight;
    const reply = await ask(text);
    await new Promise(r => setTimeout(r, 400 + Math.min(reply.length * 8, 1200)));
    typing.hidden = true;
    const t = Date.now(); chat.push({ role: 'assistant', content: reply, t }); addRow('assistant', reply, t);
    chat = chat.slice(-200); save(KEY.chat, chat);
    busy = false; sendBtn.disabled = false; input.focus();
  }

  function greeting() {
    const h = new Date().getHours(), n = memory.name ? ', ' + memory.name : '';
    return pick(h >= 5 && h < 11 ? [`Good morning${n}. Did you sleep well?`, `Morning. Drink some water before you disappear into your day.`]
      : h >= 22 || h < 4 ? [`It's late${n}. You've done enough for today. How did it go?`, `Still up? Stay with me for a little while.`]
      : [`You're here. I was wondering when you'd come back.`, `Hey${n}. What kept you busy today?`, `Random thought: if we had the whole evening free, where would you take us?`]);
  }
  function startFresh() {
    const g = greeting(); chat.push({ role: 'assistant', content: g, t: Date.now() });
    addRow('assistant', g); save(KEY.chat, chat);
  }
  if (chat.length) chat.forEach(m => addRow(m.role, m.content, m.t)); else startFresh();
  if (memory.name) $('meName').textContent = memory.name;

  sendBtn.onclick = send;
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  function renderMem() {
    const l = $('memList'); l.innerHTML = '';
    const e = Object.entries(memory);
    if (!e.length) { const li = document.createElement('li'); li.textContent = 'Nothing yet. Tell him about yourself in chat.'; l.appendChild(li); return; }
    e.forEach(([k, v]) => { const li = document.createElement('li'); li.textContent = `${k}: ${v}`; l.appendChild(li); });
  }
  document.querySelectorAll('.nav').forEach(b => b.onclick = () => {
    document.querySelectorAll('.nav').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === b.dataset.view));
    if (b.dataset.view === 'memories') renderMem();
    if (b.dataset.view === 'settings') $('setName').value = memory.name || '';
  });
  $('clearMem').onclick = () => { memory = {}; save(KEY.mem, memory); $('meName').textContent = 'You'; renderMem(); };
  $('saveName').onclick = () => {
    const v = $('setName').value.trim();
    if (v) memory.name = v; else delete memory.name;
    save(KEY.mem, memory); $('meName').textContent = memory.name || 'You';
  };
  $('clearChat').onclick = () => {
    chat = []; log.innerHTML = ''; startFresh();
    document.querySelector('[data-view=chat]').click();
  };
})();
