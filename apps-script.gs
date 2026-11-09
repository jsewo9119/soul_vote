// Bind this script to the supplied Google spreadsheet, then run setup() once.
// Deploy as a web app: Execute as me; access Anyone. Requests are authenticated
// with VOTE_SHARED_SECRET, stored in Script Properties and in Vercel environment variables.
function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID 스크립트 속성을 설정해 주세요.');
  return SpreadsheetApp.openById(id);
}
const RESPONSE_TAB = '응답_자동';
const MEMBER_TAB = '회원';
const TALLY_TAB = '집계_자동';
const KEYS = [
  'mvp_vocal', 'mvp_piano', 'mvp_guitar', 'mvp_bass', 'mvp_perc',
  'new_vocal', 'new_piano', 'new_guitar', 'new_bass', 'new_perc',
  'growth_vocal', 'growth_piano', 'growth_guitar', 'growth_bass', 'growth_perc',
  'chemi', 'grand'
];
const LABELS = [
  '보컬 MVP', '피아노 MVP', '기타 MVP', '베이스 MVP', '퍼커션 MVP',
  '보컬 신인상', '피아노 신인상', '기타 신인상', '베이스 신인상', '퍼커션 신인상',
  '보컬 장족의 발전상', '피아노 장족의 발전상', '기타 장족의 발전상',
  '베이스 장족의 발전상', '퍼커션 장족의 발전상', '베스트 케미상', '대상'
];

function setup() {
  const book = spreadsheet_();
  ensureSheet_(book, MEMBER_TAB, ['허용된 구글 이메일']);
  ensureSheet_(book, RESPONSE_TAB, ['제출 시각', '구글 계정 ID', '구글 이메일'].concat(LABELS));
  ensureSheet_(book, TALLY_TAB, ['부문', '후보', '득표수']);
}

function doPost(e) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('VOTE_SHARED_SECRET');
    if (!secret || secret.length < 32) return result_(false, '서버 비밀키가 설정되지 않았어요.');
    const body = e && e.parameter || {};
    const json = body.payload || '';
    const signature = body.signature || '';
    if (!json || json.length > 12000 || !/^[a-f0-9]{64}$/.test(signature)) {
      return result_(false, '잘못된 요청입니다.');
    }
    const expected = Utilities.computeHmacSha256Signature(json, secret)
      .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
    if (signature !== expected) return result_(false, '인증되지 않은 요청입니다.');
    const vote = JSON.parse(json);
    if (!vote.sub || !vote.email || !vote.picks ||
        Math.abs(Date.now() - Number(vote.issuedAt)) > 120000) {
      return result_(false, '만료되거나 잘못된 요청입니다.');
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const book = spreadsheet_();
      const members = book.getSheetByName(MEMBER_TAB);
      const responses = book.getSheetByName(RESPONSE_TAB);
      if (!members || !responses) return result_(false, '시트 준비가 필요합니다.');
      const allowed = members.getLastRow() < 2 ? [] : members.getRange(2, 1, members.getLastRow() - 1, 1)
        .getDisplayValues().map(function (r) { return r[0].trim().toLowerCase(); });
      if (allowed.indexOf(String(vote.email).toLowerCase()) < 0) {
        return result_(false, '회원 명단에 없는 구글 계정입니다.', 'NOT_MEMBER');
      }
      if (responses.getLastRow() >= 2) {
        const existing = responses.getRange(2, 2, responses.getLastRow() - 1, 2).getDisplayValues();
        if (existing.some(function (row) {
          return row[0] === String(vote.sub) || row[1].toLowerCase() === String(vote.email).toLowerCase();
        })) return result_(false, '이미 투표를 제출한 계정입니다.', 'ALREADY_VOTED');
      }
      const picks = KEYS.map(function (key) { return safeCell_(vote.picks[key]); });
      if (picks.some(function (value) { return !value; })) return result_(false, '빈 문항이 있습니다.');
      responses.appendRow([new Date(), String(vote.sub), String(vote.email).toLowerCase()].concat(picks));
      try { refreshTally_(book, responses); }
      catch (tallyError) { console.error('집계 갱신 실패:', tallyError); }
      return result_(true);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return result_(false, '서버에서 투표를 저장하지 못했습니다.');
  }
}

function refreshTally_(book, responses) {
  const counts = {};
  if (responses.getLastRow() >= 2) {
    const rows = responses.getRange(2, 4, responses.getLastRow() - 1, KEYS.length).getDisplayValues();
    rows.forEach(function (row) {
      row.forEach(function (choice, index) {
        if (!choice) return;
        const id = KEYS[index] + '\u0000' + choice;
        counts[id] = (counts[id] || 0) + 1;
      });
    });
  }
  const output = Object.keys(counts).map(function (id) {
    const parts = id.split('\u0000');
    const index = KEYS.indexOf(parts[0]);
    return [LABELS[index], parts[1], counts[id], index];
  }).sort(function (a, b) { return a[3] - b[3] || b[2] - a[2] || a[1].localeCompare(b[1]); })
    .map(function (row) { return row.slice(0, 3); });
  const tally = book.getSheetByName(TALLY_TAB);
  if (tally.getLastRow() > 1) tally.getRange(2, 1, tally.getLastRow() - 1, 3).clearContent();
  if (output.length) tally.getRange(2, 1, output.length, 3).setValues(output);
}

// Run manually if a previous tally refresh failed after a vote was saved.
function rebuildTally() {
  const book = spreadsheet_();
  refreshTally_(book, book.getSheetByName(RESPONSE_TAB));
}

function ensureSheet_(book, name, header) {
  const sheet = book.getSheetByName(name) || book.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function safeCell_(value) {
  const text = String(value == null ? '' : value).trim().slice(0, 80);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function result_(ok, error, code) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok, error: error, code: code }))
    .setMimeType(ContentService.MimeType.JSON);
}
