import { google, sheets_v4 } from 'googleapis';
import { logger } from '../../utils/logger';

interface SheetsConfig {
  clientId:      string;
  clientSecret:  string;
  refreshToken:  string;
  spreadsheetId: string;
  sheetName:     string;   // sheet tab name, e.g. "Sayfa1"
  tableName?:    string;   // named table/range, e.g. "Randevular"
  idColumn?:     string;   // header name used as the unique-ID column (default: "id")
}

export class SheetsService {
  private readonly idColumn: string;

  constructor(private readonly cfg: SheetsConfig) {
    this.idColumn = cfg.idColumn ?? 'id';
  }

  /**
   * Appends a row. Column order is determined by the header row.
   * The configured idColumn is used to look up the 'id' key from data,
   * so the id value lands in the correct column regardless of its header name.
   */
  async appendRow(data: Record<string, string>): Promise<void> {
    const sheets  = await this.buildClient();
    const headers = await this.getHeaders(sheets);

    // Build a normalised data map: if the spreadsheet id column header differs
    // from "id" (e.g. "q"), copy the id value under that header name so it
    // lands in the right cell when we map over headers below.
    const mapped: Record<string, string> = { ...data };
    if (this.idColumn !== 'id' && data['id']) {
      mapped[this.idColumn] = data['id'];
    }

    const row     = headers.map((h) => mapped[h] ?? '');
    const lastCol = headers.length > 0 ? this.colLetter(headers.length - 1) : 'Z';

    // Find the actual last non-empty row by reading column A so we always
    // write immediately after the last filled row — no gaps from deleted rows.
    const colARes = await sheets.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range:         `${this.cfg.sheetName}!A:A`,
    });
    const colAValues = (colARes.data.values ?? []) as string[][];
    // Walk backwards to find the last row that has any value in column A
    let lastFilledRow = 0;
    for (let i = colAValues.length - 1; i >= 0; i--) {
      if (colAValues[i]?.[0]?.trim()) {
        lastFilledRow = i + 1; // convert to 1-indexed
        break;
      }
    }
    const targetRow = lastFilledRow + 1;

    await sheets.spreadsheets.values.update({
      spreadsheetId:    this.cfg.spreadsheetId,
      range:            `${this.cfg.sheetName}!A${targetRow}:${lastCol}${targetRow}`,
      valueInputOption: 'RAW',
      requestBody:      { values: [row] },
    });
    logger.info(`[SheetsService] Row appended at row ${targetRow} — id=${data['id'] ?? '?'}`);
  }

  /**
   * Finds a row by the value in the id column and updates specified fields.
   * Uses the configured idColumn name to locate the correct column.
   */
  async updateRow(id: string, updates: Record<string, string>): Promise<void> {
    const sheets  = await this.buildClient();
    const headers = await this.getHeaders(sheets);

    const idColIdx = headers.indexOf(this.idColumn);
    if (idColIdx === -1) {
      logger.warn(
        `[SheetsService] Column "${this.idColumn}" not found in headers [${headers.join(', ')}] — ` +
        `set GOOGLE_SHEETS_ID_COLUMN to match your spreadsheet's id column header`,
      );
      return;
    }
    const idColLetter = this.colLetter(idColIdx);

    // Read the full id column to find the target row number
    const idRes = await sheets.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range:         `${this.cfg.sheetName}!${idColLetter}:${idColLetter}`,
    });
    const idCol  = ((idRes.data.values ?? []) as string[][]).map((r) => r[0] ?? '');
    const rowIdx = idCol.findIndex((v) => v === id);
    if (rowIdx === -1) {
      logger.warn(`[SheetsService] Row not found for id="${id}" in column "${this.idColumn}"`);
      return;
    }
    const rowNum = rowIdx + 1; // 1-indexed sheet row

    for (const [field, value] of Object.entries(updates)) {
      const colIdx = headers.indexOf(field);
      if (colIdx === -1) continue;
      const col = this.colLetter(colIdx);
      await sheets.spreadsheets.values.update({
        spreadsheetId:    this.cfg.spreadsheetId,
        range:            `${this.cfg.sheetName}!${col}${rowNum}`,
        valueInputOption: 'RAW',
        requestBody:      { values: [[value]] },
      });
    }
    logger.info(`[SheetsService] Row updated — id=${id} fields=[${Object.keys(updates).join(',')}]`);
  }

  private async getHeaders(sheets: sheets_v4.Sheets): Promise<string[]> {
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
    return String.fromCharCode(65 + zeroIdx);
  }
}
