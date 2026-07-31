/**
 * Website Grader — Google Sheets submission webhook.
 *
 * This is the whole "backend" for submissions: a Google Apps Script Web App
 * bound to a Google Sheet. The app POSTs one JSON submission per graded site;
 * this appends it as a row. The only secret is the deploy URL.
 *
 * ── Setup (about 2 minutes) ──────────────────────────────────────────────
 *  1. Create a Google Sheet.
 *  2. Extensions → Apps Script. Delete the placeholder, paste this file.
 *  3. Deploy → New deployment → gear icon → Web app.
 *       • Execute as: Me
 *       • Who has access: Anyone
 *  4. Deploy, authorize, and copy the Web app URL (ends in /exec).
 *  5. Put it in the app's env as GOOGLE_SHEETS_WEBHOOK_URL.
 *
 * To confirm it works: grade a site in the app, then check the "Submissions"
 * tab — a new row should appear.
 */

const SHEET_NAME = 'Submissions';

const HEADERS = [
  'Timestamp',
  'URL',
  'Score',
  'Max',
  'Grade',
  'Model',
  'Email',
  'Name',
  'Summary',
  'Dimension scores',
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    const dims = body.dimensionScores || {};
    const dimsStr = Object.keys(dims)
      .map(function (k) { return k + ': ' + dims[k]; })
      .join(' | ');

    sheet.appendRow([
      body.timestamp || new Date().toISOString(),
      body.url || '',
      body.totalScore != null ? body.totalScore : '',
      body.maxScore != null ? body.maxScore : '',
      body.grade || '',
      body.modelUsed || '',
      body.userEmail || '',
      body.userName || '',
      body.summary || '',
      dimsStr,
    ]);

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
