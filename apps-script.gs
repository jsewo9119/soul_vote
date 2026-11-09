// Bind this script to the supplied Google spreadsheet, then run setup() once.
// Deploy as a web app: Execute as me; access Anyone. Requests are authenticated
// with VOTE_SHARED_SECRET, stored in Script Properties and in Vercel environment variables.
function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID 스크립트 속성을 설정해 주세요.');
  return SpreadsheetApp.openById(id);
}
const RESPONSE_TAB = '응답_공개';
const TALLY_TAB = '집계_공개';
const SCRIPT_VERSION = 'public-v2';
const KEYS = [
  'mvp_vocal', 'mvp_piano', 'mvp_guitar', 'mvp_bass', 'mvp_perc',
  'new_vocal', 'new_piano', 'new_guitar', 'new_bass', 'new_perc',
  'growth_vocal', 'growth_piano', 'growth_guitar', 'growth_bass', 'growth_perc',
  'chemi', 'grand'
];
const LABELS = [
  '보컬 부문 MVP', '피아노 부문 MVP', '기타 부문 MVP', '베이스 부문 MVP', '퍼커션 부문 MVP',
  '보컬 부문 신인상', '피아노 부문 신인상', '기타 부문 신인상', '베이스 부문 신인상', '퍼커션 부문 신인상',
  '보컬 부문 장족의 발전상', '피아노 부문 장족의 발전상', '기타 부문 장족의 발전상',
  '베이스 부문 장족의 발전상', '퍼커션 부문 장족의 발전상', '베스트 케미상', '대상'
];

function setup() {
  const book = spreadsheet_();
  const responses = ensureSheet_(book, RESPONSE_TAB, ['제출 시각', '브라우저 ID'].concat(LABELS));
  ensureSheet_(book, TALLY_TAB, ['부문', '후보', '득표수']);
  formatResponses_(responses);
  refreshTally_(book, responses);
}

// Used by the Vercel connection check; never returns the shared secret.
function doGet(e) {
  const challenge = String(e && e.parameter && e.parameter.challenge || '');
  const secret = PropertiesService.getScriptProperties().getProperty('VOTE_SHARED_SECRET');
  if (!/^[a-f0-9]{32,64}$/.test(challenge) || !secret || secret.length < 32) {
    return result_(false, '연결 확인 요청이 올바르지 않습니다.');
  }
  const proof = hmac_(challenge, secret);
  return ContentService.createTextOutput(JSON.stringify({ service: 'soul-vote', version: SCRIPT_VERSION, proof: proof }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('VOTE_SHARED_SECRET');
    if (!secret || secret.length < 32) return result_(false, '서버 비밀키가 설정되지 않았어요.');
    const body = e && e.parameter || {};
    const payload64 = body.payload64 || '';
    const signature = body.signature || '';
    if (!/^[A-Za-z0-9_-]{1,16000}$/.test(payload64) || !/^[a-f0-9]{64}$/.test(signature)) {
      return result_(false, '잘못된 요청입니다.');
    }
    const expected = hmac_(payload64, secret);
    if (signature !== expected) return result_(false, '인증되지 않은 요청입니다.');
    const padded = payload64 + '='.repeat((4 - payload64.length % 4) % 4);
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(padded)).getDataAsString('UTF-8');
    const vote = JSON.parse(json);
    if (!vote.vid || !/^[a-zA-Z0-9-]{16,64}$/.test(String(vote.vid)) || !vote.picks ||
        Math.abs(Date.now() - Number(vote.issuedAt)) > 120000) {
      return result_(false, '만료되거나 잘못된 요청입니다.');
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const book = spreadsheet_();
      const responses = book.getSheetByName(RESPONSE_TAB);
      if (!responses) return result_(false, '시트 준비가 필요합니다.');
      if (responses.getLastRow() >= 2) {
        const existing = responses.getRange(2, 2, responses.getLastRow() - 1, 1).getDisplayValues();
        if (existing.some(function (row) { return row[0] === String(vote.vid); })) {
          return result_(false, '이 브라우저에서는 이미 투표했어요.', 'ALREADY_VOTED');
        }
      }
      const picks = KEYS.map(function (key) { return safeCell_(vote.picks[key]); });
      if (picks.some(function (value) { return !value; })) return result_(false, '빈 문항이 있습니다.');
      responses.appendRow([new Date(), String(vote.vid)].concat(picks));
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

function hmac_(value, secret) {
  return Utilities.computeHmacSha256Signature(value, secret, Utilities.Charset.US_ASCII)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

function refreshTally_(book, responses) {
  const counts = KEYS.map(function () { return {}; });
  if (responses.getLastRow() >= 2) {
    const rows = responses.getRange(2, 3, responses.getLastRow() - 1, KEYS.length).getDisplayValues();
    rows.forEach(function (row) {
      row.forEach(function (choice, index) {
        if (!choice) return;
        counts[index][choice] = (counts[index][choice] || 0) + 1;
      });
    });
  }
  const tally = book.getSheetByName(TALLY_TAB);
  const requiredColumns = KEYS.length * 3;
  if (tally.getMaxColumns() < requiredColumns) {
    tally.insertColumnsAfter(tally.getMaxColumns(), requiredColumns - tally.getMaxColumns());
  }
  tally.clear();
  tally.getRange('A1').setValue('2026 SOUL AWARDS 집계').setFontSize(18).setFontWeight('bold');
  tally.getRange('A2').setValue('총 투표자 수').setFontWeight('bold');
  tally.getRange('B2').setValue(Math.max(0, responses.getLastRow() - 1)).setFontWeight('bold');
  tally.setFrozenRows(5);
  KEYS.forEach(function (key, index) {
    const column = index * 3 + 1;
    const heading = tally.getRange(4, column, 1, 3);
    heading.setBackground('#1a3cff').setFontColor('#ffffff').setFontWeight('bold');
    tally.getRange(4, column).setValue(LABELS[index]);
    const subhead = tally.getRange(5, column, 1, 2);
    subhead.setValues([['후보', '득표']]).setBackground('#ffe36e').setFontWeight('bold');
    tally.setColumnWidth(column, 170);
    tally.setColumnWidth(column + 1, 75);
    tally.setColumnWidth(column + 2, 22);
    const ranked = Object.keys(counts[index]).map(function (name) {
      return [name, counts[index][name]];
    }).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
    if (ranked.length) tally.getRange(6, column, ranked.length, 2).setValues(ranked);
  });
}

function formatResponses_(responses) {
  const header = responses.getRange(1, 1, 1, 2 + LABELS.length);
  header.setValues([['제출 시각', '투표자 ID'].concat(LABELS)]);
  header.setBackground('#1a3cff').setFontColor('#ffffff').setFontWeight('bold');
  responses.setFrozenRows(1);
  responses.setColumnWidth(1, 145);
  responses.setColumnWidth(2, 300);
  for (let column = 3; column <= 2 + LABELS.length; column++) {
    responses.setColumnWidth(column, 160);
  }
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
  return sheet;
}

function safeCell_(value) {
  const text = String(value == null ? '' : value).trim().slice(0, 80);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function result_(ok, error, code) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok, error: error, code: code }))
    .setMimeType(ContentService.MimeType.JSON);
}
