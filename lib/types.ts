export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee: string | null;
  due_date: string | null;
  position: number;
  created_at: string;
}

export const COLUMNS: { key: TaskStatus; title: string; accent: string }[] = [
  { key: 'backlog', title: 'Бэклог', accent: 'bg-gray-400' },
  { key: 'in_progress', title: 'В работе', accent: 'bg-blue-500' },
  { key: 'review', title: 'На проверке', accent: 'bg-amber-500' },
  { key: 'done', title: 'Готово', accent: 'bg-emerald-500' },
];

export const PRIORITIES: { key: Priority; label: string; badge: string }[] = [
  { key: 'low', label: 'Низкий', badge: 'bg-gray-100 text-gray-600' },
  { key: 'medium', label: 'Средний', badge: 'bg-blue-50 text-blue-700' },
  { key: 'high', label: 'Высокий', badge: 'bg-amber-50 text-amber-700' },
  { key: 'urgent', label: 'Срочный', badge: 'bg-red-50 text-red-700' },
];

// === Бухгалтерия ===

export interface WhiteImport {
  id: string;
  file_name: string;
  account: string | null;
  company: string | null;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number;
  closing_balance: number;
  total_debit: number;   // расход (списания)
  total_credit: number;  // приход (поступления)
  tx_count: number;
  created_at: string;
}

export interface WhiteTx {
  id?: string;
  import_id?: string;
  doc_date: string | null;
  counterparty: string | null;
  inn: string | null;
  doc_type: string | null;
  branch: string | null;
  debit: number;   // расход
  credit: number;  // приход
  purpose: string | null;
}

export type CashType = 'income' | 'expense'; // Приход | Расход

export interface CashEntry {
  id: string;
  entry_date: string;
  type: CashType;
  amount: number;
  category: string | null;
  note: string | null;
  created_at: string;
}
