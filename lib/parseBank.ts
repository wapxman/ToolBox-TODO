import * as XLSX from 'xlsx';
import { WhiteTx } from './types';

export interface ParsedStatement {
  account: string | null;
  company: string | null;
  period_start: string | null; // YYYY-MM-DD
  period_end: string | null;
  opening_balance: number;
  closing_balance: number;
  total_debit: number;  // расход
  total_credit: number; // приход
  transactions: WhiteTx[];
}

function num(v: any): number {
  if (v == null || v === '') return 0;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// "13.05.26" | "13.05.2026" -> "2026-05-13"
function parseDate(v: any): string | null {
  if (!v) return null;
  const m = String(v).trim().match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function findHeaderRow(rows: any[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].map((c) => String(c).toLowerCase()).join('|');
    if (joined.includes('дата') && (joined.includes('дебет') || joined.includes('кредит'))) return i;
  }
  return -1;
}

function colIndex(header: any[], ...needles: string[]): number {
  const lower = header.map((c) => String(c).toLowerCase().trim());
  for (let i = 0; i < lower.length; i++) {
    if (needles.some((n) => lower[i].includes(n))) return i;
  }
  return -1;
}

export function parseBankStatement(fileData: ArrayBuffer): ParsedStatement {
  const wb = XLSX.read(fileData, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

  let account: string | null = null;
  let company: string | null = null;
  let period_start: string | null = null;
  let period_end: string | null = null;
  let opening_balance = 0;
  let closing_balance = 0;

  const headerIdx = findHeaderRow(rows);

  // Метаданные — строки до заголовка
  for (let i = 0; i < (headerIdx >= 0 ? headerIdx : Math.min(rows.length, 6)); i++) {
    const text = rows[i].map((c) => String(c)).join(' ').replace(/\s+/g, ' ').trim();

    const period = text.match(/за\s+(\d{1,2}\.\d{1,2}\.\d{2,4})\s*-\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/i);
    if (period) {
      period_start = parseDate(period[1]);
      period_end = parseDate(period[2]);
    }

    const acc = text.match(/Счет[:\s]+(\d{6,})/i);
    if (acc) account = acc[1];

    const comp = text.match(/(ООО|АО|ОАО|ЗАО|ИП|МЧЖ)\s+[^,]+/i);
    if (comp && !company) company = comp[0].trim();

    const open = text.match(/Остаток на начало периода[:\s]+([\d\s.,]+)/i);
    if (open) opening_balance = num(open[1]);

    const close = text.match(/Остаток на конец\s*периода[:\s]+([\d\s.,]+)/i);
    if (close) closing_balance = num(close[1]);
  }

  const transactions: WhiteTx[] = [];
  let total_debit = 0;
  let total_credit = 0;

  if (headerIdx >= 0) {
    const header = rows[headerIdx];
    const cDate = colIndex(header, 'дата');
    const cName = colIndex(header, 'наименование');
    const cDocType = colIndex(header, 'тип документ');
    const cBranch = colIndex(header, 'филиал');
    const cDebit = colIndex(header, 'дебет');
    const cCredit = colIndex(header, 'кредит');
    const cPurpose = colIndex(header, 'назначение');
    const cInn = colIndex(header, 'инн');

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const first = String(r[0] || '').toLowerCase();
      // строка итогов / пустая
      if (first.includes('итого') || first.includes('всего')) continue;
      const date = parseDate(cDate >= 0 ? r[cDate] : r[0]);
      const debit = cDebit >= 0 ? num(r[cDebit]) : 0;
      const credit = cCredit >= 0 ? num(r[cCredit]) : 0;
      if (!date && debit === 0 && credit === 0) continue;

      transactions.push({
        doc_date: date,
        counterparty: cName >= 0 ? String(r[cName] || '').trim() || null : null,
        inn: cInn >= 0 ? String(r[cInn] || '').trim() || null : null,
        doc_type: cDocType >= 0 ? String(r[cDocType] || '').trim() || null : null,
        branch: cBranch >= 0 ? String(r[cBranch] || '').trim() || null : null,
        debit,
        credit,
        purpose: cPurpose >= 0 ? String(r[cPurpose] || '').trim() || null : null,
      });
      total_debit += debit;
      total_credit += credit;
    }
  }

  return {
    account,
    company,
    period_start,
    period_end,
    opening_balance,
    closing_balance,
    total_debit: Math.round(total_debit * 100) / 100,
    total_credit: Math.round(total_credit * 100) / 100,
    transactions,
  };
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
}
