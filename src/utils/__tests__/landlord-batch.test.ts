import { describe, expect, it } from 'vitest'
import {
  assignmentState,
  buildAssignmentDelta,
  toggleCommunityAssignment,
  toggleUserSelection,
} from '../landlord-batch'

describe('source contact batch selection', () => {
  it('selects users once and ignores users already configured', () => {
    expect(toggleUserSelection([], '1')).toEqual(['1'])
    expect(toggleUserSelection(['1'], '1')).toEqual([])
    expect(toggleUserSelection(['1'], '2', true)).toEqual(['1'])
  })

  it('keeps assignment changes independent of paging and filtering', () => {
    let changes = {}
    changes = toggleCommunityAssignment(changes, '10', false)
    changes = toggleCommunityAssignment(changes, '20', true)

    expect(assignmentState(changes, '10', false)).toBe(true)
    expect(assignmentState(changes, '20', true)).toBe(false)
    expect(assignmentState(changes, '30', true)).toBe(true)
    expect(buildAssignmentDelta(changes)).toEqual({
      assignCommunityIds: ['10'],
      unassignCommunityIds: ['20'],
    })
  })

  it('drops a change when a row is toggled back to its initial state', () => {
    let changes = toggleCommunityAssignment({}, '10', false)
    changes = toggleCommunityAssignment(changes, '10', false)

    expect(changes).toEqual({})
    expect(buildAssignmentDelta(changes)).toEqual({ assignCommunityIds: [], unassignCommunityIds: [] })
  })
})
