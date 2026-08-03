export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return ids;
  const result = ids.slice();
  result.splice(oldIndex, 1);
  result.splice(newIndex, 0, activeId);
  return result;
}
