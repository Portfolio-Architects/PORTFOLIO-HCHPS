'use client';

import React from 'react';
import { Task, TaskStatus } from '@/types';
import { Badge } from './ui/badge';
import { Plus, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  onAdd: (status?: TaskStatus) => void;
}

const columns: { id: TaskStatus; label: string; color: string }[] = [
  { id: 'todo', label: '📋 대기', color: 'var(--color-text-secondary)' },
  { id: 'in-progress', label: '🔄 진행중', color: 'var(--color-primary)' },
  { id: 'done', label: '✅ 완료', color: 'var(--color-success)' },
];

const priorityVariant = { low: 'success' as const, medium: 'warning' as const, high: 'danger' as const };

function KanbanCard({ task, onEdit }: { task: Task; onEdit: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="bg-[var(--color-card)] rounded-lg border border-[var(--color-border-light)] p-3 shadow-[var(--shadow-sm)] card-hover cursor-pointer group"
      onClick={() => onEdit(task)}
    >
      <div className="flex items-start gap-2">
        <div {...listeners} className="mt-0.5 text-[var(--color-text-tertiary)] opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{task.title}</div>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge variant={priorityVariant[task.priority]}>
              {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '보통' : '낮음'}
            </Badge>
            {task.category && <span className="text-[10px] text-[var(--color-text-tertiary)]">{task.category}</span>}
          </div>
          {task.dueDate && (
            <div className="text-[10px] text-[var(--color-text-tertiary)] mt-1.5">
              📅 {task.dueDate}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KanbanBoard({ tasks, onStatusChange, onEdit, onAdd }: KanbanBoardProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = over.id as string;
    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    // Check if dropped on a column
    if (['todo', 'in-progress', 'done'].includes(overId)) {
      if (activeTask.status !== overId) {
        onStatusChange(activeTask.id, overId as TaskStatus);
      }
      return;
    }

    // Dropped on another task - move to that task's column
    const overTask = tasks.find(t => t.id === overId);
    if (overTask && activeTask.status !== overTask.status) {
      onStatusChange(activeTask.id, overTask.status);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">칸반 보드</h2>
        <button onClick={() => onAdd('todo')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer">
          <Plus size={16} /> 새 업무
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map(col => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <div key={col.id} className="bg-[var(--color-bg)] rounded-xl p-3 kanban-column">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-sm font-semibold" style={{ color: col.color }}>
                    {col.label}
                  </h3>
                  <span className="text-xs text-[var(--color-text-tertiary)] bg-white px-2 py-0.5 rounded-full">{colTasks.length}</span>
                </div>
                <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy} id={col.id}>
                  <div className="space-y-2 min-h-[60px]" id={col.id}>
                    {colTasks.map(task => (
                      <KanbanCard key={task.id} task={task} onEdit={onEdit} />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="text-center py-6 text-xs text-[var(--color-text-tertiary)]">
                        드래그하여 이동
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}
