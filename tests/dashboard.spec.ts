import { expect, test, type Page } from '@playwright/test'
import type { Employee } from '../src/types'

const employees: Employee[] = Array.from({ length: 215 }, (_, index) => ({
  id: `EMP-${String(index + 1).padStart(4, '0')}`,
  first_name: `Employee ${index + 1}`,
  last_name: `Last ${index + 1}`,
  email: `employee-${index + 1}-with-a-long-email@example.com`,
  phone: '1234567890',
  department: index % 2 ? 'Sales' : 'Engineering',
  role: 'Specialist',
  salary: 40_000 + index * 100,
  status: 'active',
  country: 'India',
  currency: 'INR',
  joining_date: '2024-01-01T00:00:00Z',
  last_updated_date: '2026-01-01T00:00:00Z',
  last_updated_by: 'test',
}))

async function mockApi(page: Page) {
  const requests: URLSearchParams[] = []
  await page.route('**/api/employees/filters', (route) => route.fulfill({
    json: { filters: {
      department: ['Engineering', 'Sales', 'Empty'],
      role: ['Specialist'], status: ['active'], country: ['India'], currency: ['INR'],
    } },
  }))
  await page.route('**/api/employees?*', async (route) => {
    const query = new URL(route.request().url()).searchParams
    requests.push(query)
    const pageNumber = Number(query.get('page'))
    const limit = Number(query.get('limit'))
    const sort = query.get('sort') as keyof Employee
    const direction = query.get('order') === 'desc' ? -1 : 1
    const filtered = employees.filter((employee) => (
      ['department', 'role', 'status', 'country', 'currency'].every((field) => (
        !query.get(field) || employee[field as keyof Employee] === query.get(field)
      )) && (!query.get('min_salary') || employee.salary >= Number(query.get('min_salary')))
        && (!query.get('max_salary') || employee.salary <= Number(query.get('max_salary')))
    )).sort((a, b) => {
      const first = a[sort]
      const second = b[sort]
      return (first < second ? -1 : first > second ? 1 : 0) * direction
    })
    await route.fulfill({ json: {
      data: filtered.slice((pageNumber - 1) * limit, pageNumber * limit),
      pagination: { page: pageNumber, limit, total: filtered.length, total_pages: Math.ceil(filtered.length / limit) },
    } })
  })
  return requests
}

test('virtualizes rows with a fixed viewport and aligned sticky headers', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockApi(page)
  await page.goto('/')
  await page.getByLabel('Employees per page').selectOption('100')
  await expect(page.getByText('215 employees · page 1 of 3')).toBeVisible()
  const grid = page.getByRole('region', { name: /Employee table/ })
  const rows = page.locator('.employee-row')
  await expect(rows.first()).toContainText('EMP-0001')
  expect(await rows.count()).toBeLessThan(30)
  expect((await grid.boundingBox())!.height).toBe(560)
  const widthBefore = await page.locator('th').first().evaluate((element) => element.getBoundingClientRect().width)

  await grid.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(rows.last()).toContainText('EMP-0100')
  expect(await rows.count()).toBeLessThan(30)
  const header = await page.locator('th').first().boundingBox()
  expect(Math.abs(header!.y - (await grid.boundingBox())!.y - 1)).toBeLessThan(2)
  expect(header!.width).toBe(widthBefore)
  const lastRow = (await rows.last().boundingBox())!
  const viewport = (await grid.boundingBox())!
  expect(lastRow.y + lastRow.height).toBeLessThanOrEqual(viewport.y + viewport.height)

  await grid.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  const lastHeader = (await page.locator('th').last().boundingBox())!
  const lastCell = (await rows.last().locator('td').last().boundingBox())!
  expect(Math.abs(lastHeader.x - lastCell.x)).toBeLessThan(1)
  expect(errors).toEqual([])
  await grid.evaluate((element) => { element.scrollLeft = 0 })
  await page.screenshot({ path: testInfo.outputPath('employee-grid.png'), fullPage: true })
})

test('sorts on the server using keyboard headers and resets page and scroll', async ({ page }) => {
  const requests = await mockApi(page)
  await page.goto('/')
  await page.getByLabel('Employees per page').selectOption('100')
  await expect(page.getByText('215 employees · page 1 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('215 employees · page 2 of 3')).toBeVisible()
  const grid = page.getByRole('region', { name: /Employee table/ })
  await grid.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(page.locator('.employee-row').last()).toContainText('EMP-0200')
  await page.getByRole('button', { name: 'Salary', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('columnheader', { name: 'Salary' })).toHaveAttribute('aria-sort', 'ascending')
  await expect(page.getByText('215 employees · page 1 of 3')).toBeVisible()
  await expect.poll(() => grid.evaluate((element) => element.scrollTop)).toBe(0)
  expect(requests.at(-1)!.get('sort')).toBe('salary')
  expect(requests.at(-1)!.get('page')).toBe('1')
  await page.keyboard.press('Space')
  await expect(page.getByRole('columnheader', { name: 'Salary' })).toHaveAttribute('aria-sort', 'descending')
  await expect(page.locator('.employee-row').first()).toContainText('EMP-0215')
  expect(requests.at(-1)!.get('order')).toBe('desc')
})

test('preserves filters, page size, final page and empty results', async ({ page }) => {
  const requests = await mockApi(page)
  await page.goto('/')
  await page.getByLabel('Employees per page').selectOption('100')
  await expect(page.getByText('215 employees · page 1 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('215 employees · page 2 of 3')).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('215 employees · page 3 of 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await page.getByLabel('Employees per page').selectOption('25')
  await expect(page.getByText('215 employees · page 1 of 9')).toBeVisible()
  await page.getByRole('combobox', { name: /^Department/ }).selectOption('Engineering')
  await expect(page.getByText('108 employees · page 1 of 5')).toBeVisible()
  await page.getByLabel('Min salary').fill('50000')
  await page.getByLabel('Min salary').press('Enter')
  await expect(page.getByText('58 employees · page 1 of 3')).toBeVisible()
  await page.getByLabel('Max salary').fill('51000')
  await page.getByLabel('Max salary').press('Enter')
  await expect(page.getByText('6 employees · page 1 of 1')).toBeVisible()
  expect(requests.at(-1)!.get('min_salary')).toBe('50000')
  expect(requests.at(-1)!.get('max_salary')).toBe('51000')
  await page.getByRole('combobox', { name: /^Department/ }).selectOption('Empty')
  await expect(page.getByText('No employees match the current filters.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByText('215 employees · page 1 of 9')).toBeVisible()
  // Clearing filters can reuse the initial page from Query's cache.
  await expect(page.getByRole('combobox', { name: /^Department/ })).toHaveValue('')
  await expect(page.getByLabel('Min salary')).toHaveValue('')
  await expect(page.getByLabel('Max salary')).toHaveValue('')
  await expect(page.locator('.employee-row').first()).toContainText('EMP-0001')
})

test('keeps the scroll viewport during loading and reports request failures', async ({ page }) => {
  await mockApi(page)
  let releaseRequest!: () => void
  const holdRequest = new Promise<void>((resolve) => { releaseRequest = resolve })
  await page.route('**/api/employees?*', async (route) => {
    await holdRequest
    await route.fulfill({ status: 500, json: { error: { message: 'Service unavailable' } } })
  })
  await page.goto('/')
  await expect(page.getByRole('table', { name: 'Employees' })).toHaveAttribute('aria-busy', 'true')
  const grid = page.getByRole('region', { name: /Employee table/ })
  expect((await grid.boundingBox())!.height).toBe(560)
  releaseRequest()
  await expect(page.getByRole('alert')).toHaveText('Service unavailable')
  await expect(page.getByText('Unable to load employees.')).toBeVisible()
  expect((await grid.boundingBox())!.height).toBe(560)
})

test('contains horizontal scrolling at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await page.goto('/')
  await expect(page.locator('.employee-row').first()).toBeVisible()
  const grid = page.getByRole('region', { name: /Employee table/ })
  expect(await grid.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await grid.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  await expect(page.getByRole('button', { name: 'Joined', exact: true })).toBeVisible()
})
