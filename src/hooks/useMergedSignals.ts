import { useMemo } from 'react';
import { extractKeywords, SignalEntry } from '@/hooks/useSignal';
import { Task, KnowledgeEntry, Project, Meeting, BudgetEntry, InventoryItem } from '@/types';

export function useMergedSignals(
  signalEntries: SignalEntry[],
  keywordMap: Record<string, number>,
  tasks: Task[],
  knowledgeEntries: KnowledgeEntry[] | undefined,
  projects: Project[],
  meetings: Meeting[],
  budgetEntries: BudgetEntry[],
  inventoryItems: InventoryItem[]
) {
  // ── Merge keywords from ALL Modules into Signal Map (Brain Dump) ──
  const mergedKeywordMap = useMemo(() => {
    const map: Record<string, number> = { ...keywordMap };
    
    const extractAndAdd = (text: string, tags: string[] = []) => {
      const words = extractKeywords(text);
      tags.forEach(t => { if (t.length >= 2) words.push(t); });
      words.forEach(kw => { map[kw] = (map[kw] || 0) + 1; });
    };

    // 1. 업무 (Tasks)
    for (const t of tasks) extractAndAdd(t.title + ' ' + (t.description || ''), t.tags);
    // 2. 지식 (Knowledge)
    for (const e of (knowledgeEntries || [])) extractAndAdd(e.title + ' ' + e.content, e.tags);
    // 3. 프로젝트 (Projects)
    for (const p of projects) extractAndAdd(p.name + ' ' + (p.description || '') + ' ' + p.checklistItems.map(c => c.text).join(' '));
    // 4. 회의록 (Meetings)
    for (const m of meetings) extractAndAdd(m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), m.attendees);
    // 5. 예산/지출 (Budget)
    for (const b of budgetEntries) extractAndAdd(b.purpose + ' ' + (b.memo || ''));
    // 6. 재고/비품 (Inventory)
    for (const i of inventoryItems) extractAndAdd(i.name + ' ' + i.category);

    return map;
  }, [keywordMap, tasks, knowledgeEntries, projects, meetings, budgetEntries, inventoryItems]);

  const mergedEntries = useMemo(() => {
    const buildEntry = (idPrefix: string, id: string, text: string, keywordsSource: string, tags: string[], createdAt: string, category: string) => ({
      id: `${idPrefix}-${id}`,
      text,
      keywords: [...extractKeywords(keywordsSource), ...tags.filter(tag => tag.length >= 2)],
      createdAt,
      category,
      tags: tags.filter(tag => tag.length >= 2),
    });

    const taskMap = tasks.map(t => buildEntry('task', t.id, `[업무] ${t.title}`, t.title + ' ' + (t.description || ''), t.tags, t.createdAt, '업무'));
    const knowMap = (knowledgeEntries || []).map(e => buildEntry('know', e.id, `[지식] ${e.title}`, e.title + ' ' + e.content, e.tags, e.createdAt, '지식창고'));
    const projectMap = projects.map(p => buildEntry('proj', p.id, `[프로젝트] ${p.name}`, p.name + ' ' + (p.description || ''), ['프로젝트'], p.createdAt, '프로젝트'));
    const meetingMap = meetings.map(m => buildEntry('meet', m.id, `[회의] ${m.title}`, m.title + ' ' + (m.agenda || '') + ' ' + (m.notes || ''), ['회의록', ...m.attendees], m.createdAt, '회의록'));
    const budgetMap = budgetEntries.map(b => buildEntry('budg', b.id, `[지출] ${b.purpose}`, b.purpose + ' ' + (b.memo || ''), ['예산'], b.date, '지출예산'));
    const inventoryMap = inventoryItems.map(i => buildEntry('inv', i.id, `[비품] ${i.name}`, i.name + ' ' + i.category, ['재고'], i.createdAt, '재고관리'));

    const sigMap = signalEntries.map(s => ({ ...s, category: '내 생각', tags: [] }));

    // Sort by createdAt descending
    const all = [...sigMap, ...taskMap, ...knowMap, ...projectMap, ...meetingMap, ...budgetMap, ...inventoryMap];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [signalEntries, tasks, knowledgeEntries, projects, meetings, budgetEntries, inventoryItems]);

  return { mergedKeywordMap, mergedEntries };
}
