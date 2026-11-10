const crypto = require('node:crypto');

module.exports = async (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const { APPS_SCRIPT_URL, VOTE_SHARED_SECRET } = process.env;
  if (!APPS_SCRIPT_URL || !VOTE_SHARED_SECRET) {
    return response.status(503).json({ connected: false, reason: 'Vercel 환경 변수가 없습니다.' });
  }
  try {
    const challenge = crypto.randomBytes(24).toString('hex');
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('challenge', challenge);
    const upstream = await fetch(url, { redirect: 'follow' });
    const data = JSON.parse(await upstream.text());
    const expected = crypto.createHmac('sha256', VOTE_SHARED_SECRET).update(challenge).digest('hex');
    const connected = data.service === 'soul-vote' && data.version === 'name-v1' &&
      typeof data.proof === 'string' && data.proof.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(data.proof), Buffer.from(expected));
    return response.status(connected ? 200 : 503).json({
      connected,
      reason: connected ? 'Vercel과 Apps Script 연결 및 비밀키가 일치합니다.' : 'Apps Script 버전 또는 비밀키가 일치하지 않습니다.',
      scriptVersion: data.version || null
    });
  } catch (error) {
    console.error('connection check failed:', error);
    return response.status(503).json({ connected: false, reason: 'Apps Script 응답을 확인할 수 없습니다.' });
  }
};
