const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const candidates = require('./candidates.json');

const SHEET_KEYS = [
  'mvp_vocal', 'mvp_piano', 'mvp_guitar', 'mvp_bass', 'mvp_perc',
  'new_vocal', 'new_piano', 'new_guitar', 'new_bass', 'new_perc',
  'growth_vocal', 'growth_piano', 'growth_guitar', 'growth_bass', 'growth_perc',
  'chemi', 'grand'
];
const auth = new OAuth2Client();

module.exports = async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') return response.status(405).json({ error: 'POST 요청만 허용됩니다.' });
  const { GOOGLE_CLIENT_ID, APPS_SCRIPT_URL, VOTE_SHARED_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !APPS_SCRIPT_URL || !VOTE_SHARED_SECRET) {
    return response.status(503).json({ error: '투표 서버 설정이 완료되지 않았어요.' });
  }
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!body || typeof body.credential !== 'string' || !body.picks || typeof body.picks !== 'object') {
      return response.status(400).json({ error: '투표 내용이 올바르지 않아요.' });
    }
    const picks = {};
    for (const key of SHEET_KEYS) {
      const value = body.picks[key];
      if (typeof value !== 'string' || !value.trim() || value.length > 80) {
        return response.status(400).json({ error: '모든 부문을 선택해 주세요.' });
      }
      picks[key] = value.trim();
      if (key !== 'grand' && !candidates[key]?.includes(picks[key])) {
        return response.status(400).json({ error: '후보 명단과 다른 선택이 있어요.' });
      }
    }
    if (picks.grand.length > 40 || /[\r\n]/.test(picks.grand)) {
      return response.status(400).json({ error: '대상 이름을 확인해 주세요.' });
    }
    const ticket = await auth.verifyIdToken({ idToken: body.credential, audience: GOOGLE_CLIENT_ID });
    const identity = ticket.getPayload();
    if (!identity?.sub || !identity.email || !identity.email_verified ||
        !(identity.email.endsWith('@gmail.com') || identity.hd)) {
      return response.status(403).json({ error: '확인된 구글 계정으로 로그인해 주세요.' });
    }
    const payload = {
      sub: identity.sub,
      email: identity.email.toLowerCase(),
      picks,
      issuedAt: Date.now()
    };
    const json = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', VOTE_SHARED_SECRET).update(json).digest('hex');
    const upstream = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ payload: json, signature }),
      redirect: 'follow'
    });
    const result = JSON.parse(await upstream.text());
    if (!upstream.ok || !result.ok) {
      return response.status(result.code === 'ALREADY_VOTED' ? 409 : 400)
        .json({ error: result.error || '투표 저장에 실패했어요.' });
    }
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('vote error:', error);
    return response.status(500).json({ error: '투표 저장에 실패했어요. 잠시 후 다시 시도해 주세요.' });
  }
};
