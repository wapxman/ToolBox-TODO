'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { WhiteImport, WhiteTx, CashEntry, CashType } from '../../lib/types';
import { parseBankStatement, fmtMoney, ParsedStatement } from '../../lib/parseBank';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Upload, TrendingUp, TrendingDown, Wallet, Trash2, FileSpreadsheet, Plus } from 'lucide-react';

type Tab = 'white' | 'black';

export default function AccountingPage() {
  const [tab, setTab] = useState<Tab>('white');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Бухгалтерия</h1>
        <p className="text-sm text-gray-500 mt-1">Белая — выписки из банка/1С · Чёрная — наличные вручную</p>
      </div>
      <div className="flex gap-2 bg-white p-1 rounded-xl border border-gray-100 w-fit">
        <div className={`tab ${tab === 'white' ? 'tab-active' : 'tab-idle'}`} onClick={() => setTab('white')}>⚪ Белая (банк/1С)</div>
        <div className={`tab ${tab === 'black' ? 'tab-active' : 'tab-idle'}`} onClick={() => setTab('black')}>⚫ Чёрная (наличные)</div>
      </div>
      {tab === 'white' ? <WhiteTab /> : <BlackTab />}
    </div>
  );
}

function StatCard({ icon, label, value, color }: any) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">{icon}{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function BreakdownCard({ title, rows, total, color, bar }: any) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-4">{title}</h3>
      {rows.length === 0 ? <div className="text-sm text-gray-400">Нет данных</div> : (
        <div className="space-y-3">
          {rows.map((r: any, i: number) => {
            const pct = total > 0 ? Math.round((r.sum / total) * 100) : 0;
            return (
              <div key={i}>
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="font-medium text-gray-800 truncate" title={r.cp}>{r.cp}</span>
                  <span className={`font-semibold whitespace-nowrap ${color}`}>{fmtMoney(r.sum)} <span className="text-gray-400 font-normal">· {pct}%</span></span>
                </div>
                {r.purpose && <div className="text-xs text-gray-500 truncate" title={r.purpose}>{r.purpose}</div>}
                <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden"><div className={`h-full ${bar} rounded-full`} style={{ width: pct + '%' }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ БЕЛАЯ ============
function WhiteTab() {
  const [imports, setImports] = useState<WhiteImport[]>([]);
  const [loading, setLoading] = useState(true);
  const [parsed, setParsed] = useState<ParsedStatement & { fileName: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [txCache, setTxCache] = useState<Record<string, WhiteTx[]>>({});
  const [allTx, setAllTx] = useState<{ counterparty: string | null; debit: number; credit: number; purpose: string | null }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const [impRes, txRes] = await Promise.all([
      supabase.from('acc_white_imports').select('*').order('created_at', { ascending: false }),
      supabase.from('acc_white_tx').select('counterparty, debit, credit, purpose'),
    ]);
    setImports(impRes.data || []);
    setAllTx(txRes.data || []);
    setLoading(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const res = parseBankStatement(buf);
      if (res.transactions.length === 0) { setError('Не удалось распознать операции в файле. Проверьте формат.'); return; }
      setParsed({ ...res, fileName: file.name });
    } catch (err: any) {
      setError('Ошибка чтения файла: ' + (err.message || ''));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveImport() {
    if (!parsed) return;
    setSaving(true);
    try {
      const { data: imp, error: impErr } = await supabase.from('acc_white_imports').insert({
        file_name: parsed.fileName,
        account: parsed.account,
        company: parsed.company,
        period_start: parsed.period_start,
        period_end: parsed.period_end,
        opening_balance: parsed.opening_balance,
        closing_balance: parsed.closing_balance,
        total_debit: parsed.total_debit,
        total_credit: parsed.total_credit,
        tx_count: parsed.transactions.length,
      }).select().single();
      if (impErr) throw impErr;
      const rows = parsed.transactions.map((t) => ({ ...t, import_id: imp.id }));
      const { error: txErr } = await supabase.from('acc_white_tx').insert(rows);
      if (txErr) throw txErr;
      setParsed(null); setLoading(true); await load();
    } catch (err: any) {
      setError('Ошибка сохранения: ' + (err.message || ''));
    } finally { setSaving(false); }
  }

  async function deleteImport(id: string) {
    await supabase.from('acc_white_tx').delete().eq('import_id', id);
    await supabase.from('acc_white_imports').delete().eq('id', id);
    setLoading(true); await load();
  }

  async function toggleTx(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!txCache[id]) {
      const { data } = await supabase.from('acc_white_tx').select('*').eq('import_id', id).order('doc_date');
      setTxCache((p) => ({ ...p, [id]: data || [] }));
    }
  }

  const totalCredit = imports.reduce((s, i) => s + Number(i.total_credit), 0);
  const totalDebit = imports.reduce((s, i) => s + Number(i.total_debit), 0);
  const lastBalance = imports[0]?.closing_balance || 0;
  const chartData = [...imports].reverse().map((i) => ({
    name: i.period_end ? new Date(i.period_end).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : i.file_name.slice(0, 8),
    Приход: Number(i.total_credit), Расход: Number(i.total_debit),
  }));

  const cleanPurpose = (p: string | null) => (p || '').replace(/^[\d\s]+/, '').trim();
  function breakdown(field: 'debit' | 'credit') {
    const m: Record<string, { sum: number; purpose: string }> = {};
    for (const t of allTx) {
      const amt = Number((t as any)[field]) || 0;
      if (amt <= 0) continue;
      const cp = t.counterparty || '—';
      if (!m[cp]) m[cp] = { sum: 0, purpose: cleanPurpose(t.purpose) };
      m[cp].sum += amt;
    }
    return Object.entries(m).map(([cp, v]) => ({ cp, sum: v.sum, purpose: v.purpose })).sort((a, b) => b.sum - a.sum);
  }
  const expenseRows = breakdown('debit');
  const incomeRows = breakdown('credit');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={16} className="text-emerald-500" />} label="Приход (всего)" value={fmtMoney(totalCredit)} color="text-emerald-600" />
        <StatCard icon={<TrendingDown size={16} className="text-red-500" />} label="Расход (всего)" value={fmtMoney(totalDebit)} color="text-red-600" />
        <StatCard icon={<Wallet size={16} className="text-brand" />} label="Чистый поток" value={fmtMoney(totalCredit - totalDebit)} />
        <StatCard icon={<Wallet size={16} className="text-gray-400" />} label="Последний остаток" value={fmtMoney(lastBalance)} />
      </div>

      {(expenseRows.length > 0 || incomeRows.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <BreakdownCard title="Структура расходов — на что ушли деньги" rows={expenseRows} total={totalDebit} color="text-red-600" bar="bg-red-400" />
          <BreakdownCard title="Структура приходов — откуда деньги" rows={incomeRows} total={totalCredit} color="text-emerald-600" bar="bg-emerald-400" />
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Загрузить выписку (1С / банк)</h3>
          <button className="btn-primary flex items-center gap-2" onClick={() => fileRef.current?.click()}><Upload size={16} /> Выбрать файл (.xlsx/.csv)</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFile} />
        </div>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</div>}

        {parsed && (
          <div className="border border-brand/30 rounded-xl p-4 bg-brand/5">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium"><FileSpreadsheet size={16} /> {parsed.fileName}</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <div><div className="text-gray-500">Компания</div><div className="font-medium">{parsed.company || '—'}</div></div>
              <div><div className="text-gray-500">Счёт</div><div className="font-medium">{parsed.account || '—'}</div></div>
              <div><div className="text-gray-500">Период</div><div className="font-medium">{parsed.period_start || '?'} — {parsed.period_end || '?'}</div></div>
              <div><div className="text-gray-500">Операций</div><div className="font-medium">{parsed.transactions.length}</div></div>
              <div><div className="text-gray-500">Приход</div><div className="font-medium text-emerald-600">{fmtMoney(parsed.total_credit)}</div></div>
              <div><div className="text-gray-500">Расход</div><div className="font-medium text-red-600">{fmtMoney(parsed.total_debit)}</div></div>
              <div><div className="text-gray-500">Остаток начало</div><div className="font-medium">{fmtMoney(parsed.opening_balance)}</div></div>
              <div><div className="text-gray-500">Остаток конец</div><div className="font-medium">{fmtMoney(parsed.closing_balance)}</div></div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={saveImport} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить импорт'}</button>
              <button className="btn-secondary" onClick={() => setParsed(null)}>Отмена</button>
            </div>
          </div>
        )}
      </div>

      {chartData.length > 0 && (
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Приход vs Расход по периодам</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtMoney(v)} width={80} />
              <Tooltip formatter={(v: any) => fmtMoney(v) + ' сум'} /><Legend />
              <Bar dataKey="Приход" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Расход" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="p-5 border-b border-gray-50"><h3 className="font-semibold text-gray-900">История импортов</h3></div>
        {loading ? <div className="p-8 text-center text-gray-400">Загрузка...</div> :
          imports.length === 0 ? <div className="p-8 text-center text-gray-400">Пока нет загруженных выписок. Загрузите первый файл выше.</div> : (
            <div className="divide-y divide-gray-50">
              {imports.map((i) => (
                <div key={i.id}>
                  <div className="p-4 flex items-center justify-between hover:bg-gray-50/50 cursor-pointer" onClick={() => toggleTx(i.id)}>
                    <div>
                      <div className="text-sm font-medium">{i.period_start || '?'} — {i.period_end || '?'} <span className="text-gray-400">· {i.company || i.file_name}</span></div>
                      <div className="text-xs text-gray-500 mt-0.5">{i.tx_count} операций · загружено {new Date(i.created_at).toLocaleString('ru-RU')}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-emerald-600">+{fmtMoney(i.total_credit)}</span>
                      <span className="text-sm text-red-600">−{fmtMoney(i.total_debit)}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteImport(i.id); }} className="text-gray-400 hover:text-red-500"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  {expanded === i.id && (
                    <div className="bg-gray-50/50 px-4 pb-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-xs text-gray-500 uppercase">
                          <th className="py-2 pr-3">Дата</th><th className="py-2 pr-3">Контрагент</th><th className="py-2 pr-3">Назначение</th>
                          <th className="py-2 pr-3 text-right">Приход</th><th className="py-2 text-right">Расход</th>
                        </tr></thead>
                        <tbody>
                          {(txCache[i.id] || []).map((t, idx) => (
                            <tr key={idx} className="border-t border-gray-100">
                              <td className="py-2 pr-3 whitespace-nowrap">{t.doc_date}</td>
                              <td className="py-2 pr-3">{t.counterparty || '—'}</td>
                              <td className="py-2 pr-3 text-gray-500 max-w-xs truncate" title={t.purpose || ''}>{t.purpose || '—'}</td>
                              <td className="py-2 pr-3 text-right text-emerald-600">{t.credit ? fmtMoney(t.credit) : ''}</td>
                              <td className="py-2 text-right text-red-600">{t.debit ? fmtMoney(t.debit) : ''}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ============ ЧЁРНАЯ ============
const emptyCash = { entry_date: new Date().toISOString().slice(0, 10), type: 'expense' as CashType, amount: '', category: '', note: '' };

function BlackTab() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(emptyCash);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('acc_cash').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    setEntries(data || []);
    setLoading(false);
  }

  async function add() {
    const amount = parseFloat(String(form.amount).replace(/\s/g, '').replace(',', '.'));
    if (!amount || amount <= 0) return;
    setSaving(true);
    await supabase.from('acc_cash').insert({
      entry_date: form.entry_date, type: form.type, amount,
      category: form.category.trim() || null, note: form.note.trim() || null,
    });
    setForm({ ...emptyCash });
    setSaving(false); setLoading(true); await load();
  }

  async function del(id: string) {
    await supabase.from('acc_cash').delete().eq('id', id);
    setLoading(true); await load();
  }

  const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
  const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp size={16} className="text-emerald-500" />} label="Приход (наличные)" value={fmtMoney(income)} color="text-emerald-600" />
        <StatCard icon={<TrendingDown size={16} className="text-red-500" />} label="Расход (наличные)" value={fmtMoney(expense)} color="text-red-600" />
        <StatCard icon={<Wallet size={16} className="text-brand" />} label="Баланс наличных" value={fmtMoney(income - expense)} color={income - expense < 0 ? 'text-red-600' : 'text-gray-900'} />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Добавить запись</h3>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div><label className="lbl">Дата</label><input className="input" type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
          <div><label className="lbl">Тип</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="income">Приход</option><option value="expense">Расход</option>
            </select></div>
          <div><label className="lbl">Сумма</label><input className="input" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="500000" /></div>
          <div><label className="lbl">Категория</label><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Зарплата, аренда..." /></div>
          <div><label className="lbl">Комментарий</label><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
          <button className="btn-primary flex items-center justify-center gap-2" onClick={add} disabled={saving}><Plus size={16} /> {saving ? '...' : 'Добавить'}</button>
        </div>
      </div>

      <div className="card">
        <div className="p-5 border-b border-gray-50"><h3 className="font-semibold text-gray-900">Записи ({entries.length})</h3></div>
        {loading ? <div className="p-8 text-center text-gray-400">Загрузка...</div> :
          entries.length === 0 ? <div className="p-8 text-center text-gray-400">Пока нет записей</div> : (
            <table className="w-full">
              <thead><tr className="text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
                <th className="px-5 py-3">Дата</th><th className="px-5 py-3">Тип</th><th className="px-5 py-3">Категория</th>
                <th className="px-5 py-3">Комментарий</th><th className="px-5 py-3 text-right">Сумма</th><th className="px-5 py-3"></th>
              </tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-gray-50">
                    <td className="px-5 py-3 text-sm whitespace-nowrap">{new Date(e.entry_date).toLocaleDateString('ru-RU')}</td>
                    <td className="px-5 py-3"><span className={`badge ${e.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{e.type === 'income' ? 'Приход' : 'Расход'}</span></td>
                    <td className="px-5 py-3 text-sm text-gray-500">{e.category || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{e.note || '—'}</td>
                    <td className={`px-5 py-3 text-sm text-right font-medium ${e.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>{e.type === 'income' ? '+' : '−'}{fmtMoney(e.amount)}</td>
                    <td className="px-5 py-3 text-right"><button onClick={() => del(e.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}
