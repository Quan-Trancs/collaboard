export type HistoryAction = 'add' | 'update' | 'delete';

export type HistoryEntry = {
  action: HistoryAction;
  element: { id: string; [key: string]: unknown };
  previous?: { id: string; [key: string]: unknown };
  userId?: string;
};

export type HistoryCounts = {
  canUndo: boolean;
  canRedo: boolean;
};

export function undoAppliedPayload(entry: HistoryEntry, userId: string, counts: HistoryCounts) {
  if (entry.action === 'add') {
    return { action: 'delete' as const, elementId: entry.element.id, userId, ...counts };
  }
  if (entry.action === 'delete') {
    return { action: 'add' as const, element: entry.element, userId, ...counts };
  }
  return {
    action: 'update' as const,
    elementId: entry.element.id,
    element: entry.previous || entry.element,
    previousState: entry.previous || entry.element,
    userId,
    ...counts,
  };
}

export function redoAppliedPayload(entry: HistoryEntry, userId: string, counts: HistoryCounts) {
  if (entry.action === 'add') {
    return { action: 'add' as const, element: entry.element, userId, ...counts };
  }
  if (entry.action === 'delete') {
    return { action: 'delete' as const, elementId: entry.element.id, userId, ...counts };
  }
  return {
    action: 'update' as const,
    elementId: entry.element.id,
    element: entry.element,
    previousState: entry.element,
    userId,
    ...counts,
  };
}
