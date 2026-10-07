# Future Thai Husband

1. Install: `npm install` (Node 18+)
2. Create `.env`: `cp .env.example .env`
3. Put your key in `.env` as `AI_API_KEY=...` (also set `AI_BASE_URL` / `AI_MODEL` for any OpenAI-compatible provider). The key stays server-side only.
4. Start: `npm start`
5. Open http://localhost:3000
6. Avatar: put your own image at `assets/husband.jpg` (it is also used as the faint chat backdrop).

Without a key the app still works using a local fallback engine.

Deploy: host on Render/Railway/Fly/etc. as a Node web service (`npm start`), set `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` in the host's environment settings, never commit `.env`. Consider adding rate limiting (e.g. `express-rate-limit`) on `/api/chat` before going public.
