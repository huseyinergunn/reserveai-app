import { google, sheets_v4 } from 'googleapis';
import { logger } from '../../utils/logger';

interface SheetsConfig {
  clientId:      string;
  clientSecret:  string;
  refreshToken:  string;
  spreadsheetId: string;
  sheetName:     string;   // sheet tab name, e.g. "Sayfa1"
  tableName?:    string;   // named table/range, e.g. "Randevular"
}

export class SheetsService {
  constructor(private readonly cfg: SheetsConfig) {}

  /**
   * Appends a row. Column order is determined by the header row already in the
   * spreadsheet so the field names must match the column headers exactly.
   */
  async appendRow(data: Record<string, string>): Promise<void> {
    const sheets  = await this.buildClient();
    const headers = await this.getHeaders(sheets);
    const row     = headers.map((h) => data[h] ?? '');

    // If a named table is configured use it directly; otherwise fall back to
    // the explicit column range so the API can locate the table boundary.
    const lastCol    = headers.length > 0 ? this.colLetter(headers.length - 1) : 'Z';
    const appendRange = this.cfg.tableName
      ? this.cfg.tableName
      : `${this.cfg.sheetName}!A1:${lastCol}1`;

    await sheets.spreadsheets.values.append({
      spreadsheetId:    this.cfg.spreadsheetId,
      range:            appendRange,
      // RAW keeps every value as a literal string — prevents Sheets from
      // auto-converting "23 Nisan 2026 14:00" into a serial date number.
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody:      { values: [row] },
    });
    logger.info(`[SheetsService] Row appended to "${appendRange}" — id=${data['id'] ?? '?'}`);
  }

  /**
   * Finds a row by the value in the "id" column and updates the specified fields.
   * Missing columns are silently skipped.
   */
  async updateRow(id: string, updates: Record<string, string>): Promise<void> {
    const sheets  = await this.buildClient();
    const headers = await this.getHeaders(sheets);

    // Find which column holds the 'id' field (don't assume column A)
    const idColIdx = headers.indexOf('id');
    if (idColIdx === -1) {
      logger.warn(`[SheetsService] No 'id' column found in sheet headers — cannot locate row`);
      return;
    }
    const idColLetter = this.colLetter(idColIdx);

    const idRes = await sheets.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range:         `${this.cfg.sheetName}!${idColLetter}:${idColLetter}`,
    });
    const idCol  = ((idRes.data.values ?? []) as string[][]).map((r) => r[0] ?? '');
    const rowIdx = idCol.findIndex((v) => v === id);
    if (rowIdx === -1) {
      logger.warn(`[SheetsService] Row not found for id=${id}`);
      return;
    }
    const rowNum = rowIdx + 1; // 1-indexed

    for (const [field, value] of Object.entries(updates)) {
      const colIdx = headers.indexOf(field);
      if (colIdx === -1) continue;
      const col = this.colLetter(colIdx);
      await sheets.spreadsheets.values.update({
        spreadsheetId:   this.cfg.spreadsheetId,
        range:           `${this.cfg.sheetName}!${col}${rowNum}`,
        valueInputOption:'RAW',
        requestBody:     { values: [[value]] },
      });
    }
    logger.info(`[SheetsService] Row updated — id=${id} fields=[${Object.keys(updates).join(',')}]`);
  }

  private async getHeaders(sheets: sheets_v4.Sheets): Promise<string[]> {
    // Named range returns the full table; take only the first row (headers).
    // Fallback: read the first row of the configured sheet tab.
    const range = this.cfg.tableName ?? `${this.cfg.sheetName}!1:1`;
    const res   = await sheets.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range,
    });
    return ((res.data.values?.[0] ?? []) as string[]);
  }

  private async buildClient(): Promise<sheets_v4.Sheets> {
    const auth = new google.auth.OAuth2(this.cfg.clientId, this.cfg.clientSecret);
    auth.setCredentials({ refresh_token: this.cfg.refreshToken });
    return google.sheets({ version: 'v4', auth });
  }

  private colLetter(zeroIdx: number): string {
    // Handles A–Z (26 columns max — sufficient for typical appointment sheets)
    return String.fromCharCode(65 + zeroIdx);
  }
}
