import { expect, test, type Page } from '@playwright/test'
import { PERMISSIONS, type AuditEvent, type Permission } from '../src/types'

async function session(page: Page, permissions: Permission[] = [...PERMISSIONS]) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: {
    id: 'audit-admin', name: 'ACME Administrator', email: 'admin@acme.test', is_admin: true, permissions,
  } } }))
}

const events: AuditEvent[] = Array.from({ length: 26 }, (_, index) => ({
  id: 26 - index, category: index === 0 ? 'salaries' : 'imports',
  action: index === 0 ? 'salary.changed' : 'import.completed', actor: 'hr@admin.co',
  resource_type: index === 0 ? 'employee' : 'import', resource_id: index === 0 ? 'EMP-60000' : `import-${index}`,
  summary: index === 0 ? 'Changed salary for EMP-60000 from INR 60000 to INR 70000' : `Added 30 employee records from team-${index}.csv`,
  created_at: '2026-09-21T08:00:00.000Z',
  metadata: index === 0 ? { reason: 'Annual review', changes: [{ field: 'salary', before: 60000, after: 70000 }] }
    : { processed_rows: 30, filename: `team-${index}.csv` },
}))

test('admin can review audit details, paginate, filter and refresh notifications', async ({ page }, testInfo) => {
  await session(page)
  const requests: URLSearchParams[] = []
  await page.route('**/api/audit-events?*', (route) => {
    const query = new URL(route.request().url()).searchParams
    requests.push(query)
    const pageNumber = Number(query.get('page'))
    const limit = Number(query.get('limit'))
    const filtered = events.filter((event) => !query.get('category') || event.category === query.get('category'))
    return route.fulfill({ json: { events: filtered.slice((pageNumber - 1) * limit, pageNumber * limit),
      pagination: { page: pageNumber, limit, total: filtered.length, total_pages: Math.ceil(filtered.length / limit) } } })
  })
  await page.goto('/notifications')
  await expect(page.getByRole('link', { name: 'Notifications' })).toHaveClass(/active/)
  await expect(page.getByText('26 events · page 1 of 2')).toBeVisible()
  const salary = page.getByRole('article', { name: events[0]!.summary })
  await expect(salary).toContainText('hr@admin.co')
  await salary.getByText('View details', { exact: true }).click()
  await expect(salary.getByRole('table', { name: 'Changed values' })).toContainText('60000')
  await expect(salary.getByRole('table', { name: 'Changed values' })).toContainText('70000')
  await expect(salary.getByRole('link', { name: 'View employee' })).toHaveAttribute('href', '/employee/EMP-60000')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('26 events · page 2 of 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByLabel('Activity type').selectOption('salaries')
  await expect(page.getByText('1 event · page 1 of 1')).toBeVisible()
  expect(requests.at(-1)!.get('category')).toBe('salaries')
  const before = requests.length
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect.poll(() => requests.length).toBeGreaterThan(before)
  await salary.getByText('View details', { exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('notifications-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({ path: testInfo.outputPath('notifications-mobile.png'), fullPage: true })
})

test('audit page provides empty states and retry after a failed request', async ({ page }) => {
  await session(page)
  let fail = true
  await page.route('**/api/audit-events?*', (route) => fail
    ? route.fulfill({ status: 503, json: { error: { message: 'Temporarily unavailable' } } })
    : route.fulfill({ json: { events: [], pagination: { page: 1, limit: 25, total: 0, total_pages: 0 } } }))
  await page.goto('/notifications')
  await expect(page.getByRole('alert')).toContainText('Couldn’t load the audit log.')
  fail = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'No activity yet' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
})

test('users without audit.read cannot open the feed or discover it in navigation', async ({ page }) => {
  await session(page, ['employee.read'])
  let requests = 0
  await page.route('**/api/audit-events?*', (route) => { requests++; return route.abort() })
  await page.goto('/notifications')
  await expect(page.getByRole('alert')).toContainText('Access restricted')
  await expect(page.getByRole('link', { name: 'Notifications' })).toHaveCount(0)
  expect(requests).toBe(0)
})
