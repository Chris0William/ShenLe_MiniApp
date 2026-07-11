import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const page = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/admin/landlord-manage/index.vue'), 'utf8')

describe('source contact management UI', () => {
  it('provides batch user selection and assignment status controls', () => {
    expect(page).toContain('批量设置')
    expect(page).toContain('未分配')
    expect(page).toContain('已分配给他')
    expect(page).toContain('新增分配')
    expect(page).toContain('移除')
    expect(page).toContain('batchSetLandlords')
    expect(page).toContain('batchAssignOwner')
    expect(page).toContain('communityRequestId')
    expect(page).toContain('userRequestId')
    expect(page).toMatch(/if \(reset\) \{\s+page\.value = 0/)
    expect(page).toMatch(/if \(reset\) \{\s+userPage\.value = 0/)
    expect(page).toMatch(/if \(reset\) \{\s+communityPage\.value = 0/)
    expect(page).toContain('submittedTargetUserId')
    expect(page).toContain('submittedChanges')
    expect(page).toContain(':close-on-click-modal="!communitySubmitting"')
    expect(page).toContain('submittedUserIds')
    expect(page).toContain(':close-on-click-modal="!userSubmitting"')
  })

  it('does not expose conflicting per-row assign and remove commands', () => {
    expect(page).not.toContain('confirmAssign')
    expect(page).not.toContain('confirmUnassign')
    expect(page).not.toContain('communityPage.value += 1')
    expect(page).not.toContain('userPage.value += 1')
  })
})
