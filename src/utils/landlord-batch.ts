import type { ShenLeId } from '@/types/shenle'

export interface CommunityAssignmentChange {
  id: ShenLeId
  initial: boolean
  desired: boolean
}

export type CommunityAssignmentChanges = Record<string, CommunityAssignmentChange>

export function toggleUserSelection(selected: ShenLeId[], userId: ShenLeId, disabled = false): ShenLeId[] {
  if (disabled)
    return selected
  const exists = selected.some(id => String(id) === String(userId))
  return exists ? selected.filter(id => String(id) !== String(userId)) : [...selected, userId]
}

export function assignmentState(changes: CommunityAssignmentChanges, communityId: ShenLeId, initial: boolean): boolean {
  return changes[String(communityId)]?.desired ?? initial
}

export function toggleCommunityAssignment(
  changes: CommunityAssignmentChanges,
  communityId: ShenLeId,
  initial: boolean,
): CommunityAssignmentChanges {
  const key = String(communityId)
  const desired = !assignmentState(changes, communityId, initial)
  const next = { ...changes }
  if (desired === initial)
    delete next[key]
  else
    next[key] = { id: communityId, initial, desired }
  return next
}

export function buildAssignmentDelta(changes: CommunityAssignmentChanges) {
  const values = Object.values(changes)
  return {
    assignCommunityIds: values.filter(item => !item.initial && item.desired).map(item => item.id),
    unassignCommunityIds: values.filter(item => item.initial && !item.desired).map(item => item.id),
  }
}
