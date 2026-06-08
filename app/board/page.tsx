'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Task, TaskStatus, COLUMNS, PRIORITIES } from '../../lib/types';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, useDraggable, useDroppable,
} from '@dnd-kit/core';
import { Plus, Pencil, Trash2, Calendar, User } from 'lucide-react';

const emptyForm = { title: '', description: '', priority: 'medium', assignee: '', due_date: '', status: 'backlog' as TaskStatus };

function prio(p: string) { return PRIORITIES.find((x) => x.key === p) || PRIORITIES[1]; }

function Card({ task, onEdit, onDelete }: { task: Task; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const p = prio(task.priority);
  return (
    <div ref={setNodeRef} style={style} className={`card p-3 mb-2 shadow-sm ${isDragging ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div {...listeners} {...attributes} className="flex-1 cursor-grab active:cursor-grabbing">
          <div className="text-sm font-medium text-gray-900">{task.title}</div>
          {task.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</div>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="text-gray-400 hover:text-brand p-1"><Pencil size={14} /></button>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={`badge ${p.badge}`}>{p.label}</span>
        {task.assignee && <span className="text-xs text-gray-500 flex items-center gap-1"><User size={12} />{task.assignee}</span>}
        {task.due_date && <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={12} />{new Date(task.due_date).toLocaleDateString('ru-RU')}</span>}
      </div>
    </div>
  );
}

function Column({ status, title, accent, tasks, onEdit, onDelete }: any) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={`flex-1 min-w-[260px] rounded-xl p-3 transition-colors ${isOver ? 'bg-brand/5' : 'bg-gray-100/70'}`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2.5 h-2.5 rounded-full ${accent}`} />
        <h3 className="font-semibold text-sm text-gray-700">{title}</h3>
        <span className="text-xs text-gray-400">{tasks.length}</span>
      </div>
      {tasks.map((t: Task) => <Card key={t.id} task={t} onEdit={() => onEdit(t)} onDelete={() => onDelete(t)} />)}
      {tasks.length === 0 && <div className="text-center text-xs text-gray-400 py-6">Перетащите задачу сюда</div>}
    </div>
  );
}

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [delTarget, setDelTarget] = useState<Task | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('todo_tasks').select('*').order('position', { ascending: true });
    setTasks(data || []);
    setLoading(false);
  }

  function openAdd(status: TaskStatus = 'backlog') { setEditing(null); setForm({ ...emptyForm, status }); setModal(true); }
  function openEdit(t: Task) {
    setEditing(t);
    setForm({ title: t.title, description: t.description || '', priority: t.priority, assignee: t.assignee || '', due_date: t.due_date || '', status: t.status });
    setModal(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      assignee: form.assignee.trim() || null,
      due_date: form.due_date || null,
      status: form.status,
    };
    if (editing) {
      await supabase.from('todo_tasks').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('todo_tasks').insert({ ...payload, position: Date.now() });
    }
    setModal(false); setSaving(false); setLoading(true); await load();
  }

  async function doDelete() {
    if (!delTarget) return;
    await supabase.from('todo_tasks').delete().eq('id', delTarget.id);
    setDelTarget(null); setLoading(true); await load();
  }

  function onDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }
  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    const newStatus = String(over.id) as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))); // оптимистично
    await supabase.from('todo_tasks').update({ status: newStatus, position: Date.now() }).eq('id', taskId);
  }

  const activeTask = tasks.find((t) => t.id === activeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Доска задач</h1>
          <p className="text-sm text-gray-500 mt-1">{tasks.length} задач · перетаскивайте карточки между статусами</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => openAdd()}><Plus size={16} /> Новая задача</button>
      </div>

      {loading ? (
        <div className="text-gray-400 py-20 text-center">Загрузка...</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((c) => (
              <Column key={c.key} status={c.key} title={c.title} accent={c.accent}
                tasks={tasks.filter((t) => t.status === c.key)} onEdit={openEdit} onDelete={setDelTarget} />
            ))}
          </div>
          <DragOverlay>{activeTask ? <div className="card p-3 shadow-lg w-64"><div className="text-sm font-medium">{activeTask.title}</div></div> : null}</DragOverlay>
        </DndContext>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setModal(false)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold">{editing ? 'Редактировать задачу' : 'Новая задача'}</h3>
              <button onClick={() => setModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="lbl">Название *</label>
                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Что нужно сделать" /></div>
              <div><label className="lbl">Описание</label>
                <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="lbl">Статус</label>
                  <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
                  </select></div>
                <div><label className="lbl">Приоритет</label>
                  <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="lbl">Исполнитель</label>
                  <input className="input" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} placeholder="Имя" /></div>
                <div><label className="lbl">Срок</label>
                  <input className="input" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setModal(false)} disabled={saving}>Отмена</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
            </div>
          </div>
        </div>
      )}

      {delTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDelTarget(null)}>
          <div className="card max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Удалить задачу?</h3>
            <p className="text-sm text-gray-500 mb-5">«{delTarget.title}» будет удалена безвозвратно.</p>
            <div className="flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setDelTarget(null)}>Отмена</button>
              <button className="btn-danger" onClick={doDelete}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
