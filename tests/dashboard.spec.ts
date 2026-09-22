import { expect, test, type Page } from '@playwright/test'
import type { DashboardSummary, Employee } from '../src/types'

const employees: Employee[] = Array.from({ length: 215 }, (_, index) => ({
  id: `EMP-${String(index + 1).padStart(4, '0')}`,
  first_name: `Employee ${index + 1}`,
  last_name: `Last ${index + 1}`,
  email: `employee-${index + 1}-with-a-long-email@example.com`,
  phone: '1234567890',
  department: index % 2 ? 'Sales' : 'Engineering',
  role: 'Specialist',
  salary: 40_000 + index * 100,
  status: index === 214 ? 'inactive' : 'active',
  country: index === 214 ? 'United States' : 'India',
  currency: index === 214 ? 'USD' : 'INR',
  joining_date: '2024-01-01T00:00:00Z',
  last_updated_date: '2026-01-01T00:00:00Z',
  last_updated_by: 'test',
}))

function dashboardFixture(country = ''): DashboardSummary {
  const india = country === 'India'
  const us = country === 'United States'
  return {
    employees: india ? 214 : us ? 1 : 215, departments: us ? 1 : 2, countries: country ? 1 : 2,
    organization: { employees: 215, departments: 2, countries: 2 },
    country: country || null, country_options: ['India', 'United States'],
    salaries: [], salary_by_department: [],
    statuses: india ? [{ status: 'active', employees: 214 }] : us ? [{ status: 'inactive', employees: 1 }]
      : [{ status: 'active', employees: 214 }, { status: 'inactive', employees: 1 }],
    compensation: {
      currency: india ? 'INR' : 'USD', approximate: !country, unavailable_currencies: [],
      total: india ? 10839100 : us ? 61400 : 174451.67,
      average: india ? 50650 : us ? 61400 : 811.40,
      departments: india ? [
        { department: 'Sales', employees: 107, total: 5424900 },
        { department: 'Engineering', employees: 107, total: 5414200 },
      ] : us ? [{ department: 'Engineering', employees: 1, total: 61400 }] : [
        { department: 'Engineering', employees: 108, total: 117870.03 },
        { department: 'Sales', employees: 107, total: 56581.63 },
      ],
      exchange_rates: { date: '2026-09-18', source: 'European Central Bank',
        source_url: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml' },
    },
  }
}

async function mockApi(page: Page) {
  const requests: URLSearchParams[] = []
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { user: {
    id: 'admin', name: 'Test Admin', email: 'admin@acme.test', is_admin: true,
    permissions: ['employee.read', 'employee.profile.update', 'salary.read', 'salary.change.request',
      'salary.change.approve', 'salary.change.apply', 'payroll.read', 'payroll.manage', 'audit.read', 'user.manage'],
  } } }))
  await page.route('**/api/dashboard*', (route) => route.fulfill({
    json: dashboardFixture(new URL(route.request().url()).searchParams.get('country') ?? ''),
  }))
  await page.route('**/api/employees/filters', (route) => route.fulfill({
    json: { filters: {
      department: ['Engineering', 'Sales', 'Empty'],
      role: ['Specialist'], status: ['active', 'inactive'], country: ['India', 'United States'], currency: ['INR', 'USD'],
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
      (!query.get('search') || [employee.id, employee.first_name, employee.last_name,
        `${employee.first_name} ${employee.last_name}`, employee.country, employee.email]
        .some((value) => value.toLowerCase().includes(query.get('search')!.toLowerCase()))) &&
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
  await page.getByRole('button', { name: /^Filters/ }).click()
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
  await expect(page.getByText('No employees match your search or filters.')).toBeVisible()
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

test('searches by name, ID, country and email on Enter or button click', async ({ page }) => {
  const requests = await mockApi(page)
  await page.goto('/employees')
  const search = page.getByRole('searchbox', { name: 'Search employees' })

  await search.fill('EMP-0042')
  await search.press('Enter')
  await expect(page.getByText('1 employee · page 1 of 1')).toBeVisible()
  await expect(page.locator('.employee-row')).toContainText('EMP-0042')
  expect(requests.at(-1)!.get('search')).toBe('EMP-0042')

  await search.fill('employee 12')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.locator('.employee-row').first()).toContainText('EMP-0012')

  await search.fill('employee-75-with-a-long-email@example.com')
  await search.press('Enter')
  await expect(page.locator('.employee-row')).toContainText('EMP-0075')

  await search.fill('India')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByText('214 employees · page 1 of 9')).toBeVisible()
})

test('keeps filters hidden behind a toggle and indicates active filters', async ({ page }) => {
  await mockApi(page)
  await page.goto('/employees')
  const toggle = page.getByRole('button', { name: /^Filters/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Min salary')).toBeHidden()
  await toggle.click()
  await page.getByRole('combobox', { name: /^Country/ }).selectOption('India')
  await expect(toggle).toHaveClass(/has-active-filters/)
  await expect(toggle.getByLabel('1 active filters')).toBeVisible()
  await toggle.click()
  await expect(page.getByLabel('Min salary')).toBeHidden()
  await toggle.click()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(toggle).not.toHaveClass(/has-active-filters/)
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

test('contains horizontal scrolling at a narrow viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await page.goto('/')
  await expect(page.locator('.employee-row').first()).toBeVisible()
  await page.getByLabel('Dashboard country').selectOption('India')
  await expect(page.getByRole('article', { name: 'Total employees', exact: true })).toContainText('214 / 215')
  const grid = page.getByRole('region', { name: /Employee table/ })
  expect(await grid.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await grid.evaluate((element) => { element.scrollLeft = element.scrollWidth })
  await expect(page.getByRole('button', { name: 'Joined', exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('dashboard-mobile.png'), fullPage: true })
})

test('uses one country selector for salaries, employees, departments, statuses and the table', async ({ page }, testInfo) => {
  const requests = await mockApi(page)
  await page.goto('/')
  const country = page.getByLabel('Dashboard country')
  const employeeMetric = page.getByRole('article', { name: 'Total employees', exact: true })
  const averageMetric = page.getByRole('article', { name: 'Average salary', exact: true })
  const totalMetric = page.getByRole('article', { name: 'Total salaries', exact: true })
  await expect(country).toHaveValue('')
  await expect(employeeMetric).toContainText('215')
  await expect(averageMetric).toContainText('≈ $811')
  await expect(totalMetric).toContainText('≈ $174,452')
  await expect(page.getByRole('figure')).toHaveAccessibleName('Salary totals by department in USD')
  await expect(page.getByText(/Estimates use fixed European Central Bank reference rates from 2026-09-18/)).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('215 employees · page 2 of 9')).toBeVisible()
  await country.selectOption('India')
  await expect(employeeMetric).toContainText('214 / 215')
  await expect(averageMetric).toContainText('₹50,650')
  await expect(averageMetric).not.toContainText('≈')
  await expect(totalMetric).toContainText('₹10.8M')
  await expect(page.getByRole('figure')).toHaveAccessibleName('Salary totals by department in INR')
  await expect(page.getByRole('img', { name: 'Active: 214', exact: true })).toBeVisible()
  await expect(page.getByText('214 employees · page 1 of 9')).toBeVisible()
  expect(requests.at(-1)!.get('country')).toBe('India')
  await page.screenshot({ path: testInfo.outputPath('dashboard-india.png'), fullPage: true })
  // Table-only filters must not change the dashboard's selected country.
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(page.getByRole('combobox', { name: /^Country/ })).toBeHidden()
  await page.getByRole('combobox', { name: /^Department/ }).selectOption('Sales')
  await expect(page.getByText('107 employees · page 1 of 5')).toBeVisible()
  await expect(employeeMetric).toContainText('214 / 215')
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(country).toHaveValue('India')
  await expect(page.getByText('214 employees · page 1 of 9')).toBeVisible()
  await country.selectOption('United States')
  await expect(employeeMetric).toContainText('1 / 215')
  await expect(averageMetric).toContainText('$61,400')
  await expect(totalMetric).toContainText('$61,400')
  await expect(page.getByRole('article', { name: 'Departments', exact: true }).locator('strong')).toHaveText('1')
  await expect(page.getByRole('img', { name: 'Inactive: 1', exact: true })).toBeVisible()
  await expect(page.getByText('1 employee · page 1 of 1')).toBeVisible()
  await expect(page.locator('.employee-row')).toContainText('EMP-0215')
  await country.selectOption('')
  await expect(employeeMetric).toContainText('215')
  await expect(employeeMetric).not.toContainText('/')
  await expect(averageMetric).toContainText('≈ $811')
  await expect(page.getByText('215 employees · page 1 of 9')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('dashboard-global.png'), fullPage: true })
})

test('opens and closes mobile navigation and preserves access to the full directory and imports', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  await page.goto('/')
  const menu = page.getByRole('navigation', { name: 'Main navigation' })
  await expect(menu).toBeHidden()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(menu).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await menu.getByRole('link', { name: 'Employees', exact: true }).click()
  await expect(page).toHaveURL('/employees')
  await expect(menu).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Employee directory' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Email' })).toBeAttached()
  await page.getByRole('button', { name: 'Open menu' }).click()
  await menu.getByRole('link', { name: 'Add employees' }).click()
  await expect(page).toHaveURL('/add')
  await expect(page.getByRole('tab', { name: 'Upload file' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: 'Add one manually' }).click()
  await expect(page.getByLabel('Employee ID')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})

test('handles empty and unavailable summaries without showing invented financial totals', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/dashboard', (route) => route.fulfill({ status: 503, json: { error: { message: 'Unavailable' } } }))
  await page.goto('/')
  await expect(page.getByText('Couldn’t load the dashboard summary.', { exact: false })).toBeVisible()
  await expect(page.getByRole('article', { name: 'Total salaries', exact: true })).toContainText('—')
  await expect(page.locator('.employee-row').first()).toContainText('EMP-0001')
  await page.route('**/api/dashboard', (route) => route.fulfill({ json: {
    ...dashboardFixture(),
    employees: 0, departments: 0, countries: 0, salaries: [], salary_by_department: [], statuses: [],
    organization: { employees: 0, departments: 0, countries: 0 }, country_options: [],
    compensation: { ...dashboardFixture().compensation, total: 0, average: null, departments: [] },
  } }))
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Your salary overview starts here')).toBeVisible()
  await expect(page.getByRole('article', { name: 'Total employees', exact: true })).toContainText('0')
  await expect(page.getByRole('article', { name: 'Average salary', exact: true })).toContainText('No salary records yet')
  await expect(page.getByLabel('Overview currency')).toBeHidden()
})

test('hides incomplete conversion totals without hiding headcounts or native employee salaries', async ({ page }) => {
  await mockApi(page)
  const summary = dashboardFixture()
  await page.route('**/api/dashboard*', (route) => route.fulfill({ json: {
    ...summary,
    compensation: { ...summary.compensation, total: null, average: null, departments: [], unavailable_currencies: ['AED'] },
  } }))
  await page.goto('/')
  await expect(page.getByRole('article', { name: 'Total salaries', exact: true })).toContainText('—')
  await expect(page.getByRole('article', { name: 'Total employees', exact: true })).toContainText('215')
  await expect(page.getByText('No reference rate for AED.', { exact: false })).toBeVisible()
  await expect(page.getByRole('figure')).toBeHidden()
  await expect(page.locator('.employee-row').first()).toContainText('₹40,000')
})

test('keeps country and organization headcounts readable for a 10,000-employee organization on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockApi(page)
  const summary = dashboardFixture('India')
  await page.route('**/api/dashboard*', (route) => route.fulfill({ json: {
    ...(new URL(route.request().url()).searchParams.has('country') ? summary : dashboardFixture()),
    employees: 3231, organization: { ...summary.organization, employees: 10000 },
    statuses: [{ status: 'active', employees: 3231 }],
  } }))
  await page.goto('/')
  await page.getByLabel('Dashboard country').selectOption('India')
  const count = page.getByRole('article', { name: 'Total employees', exact: true }).locator('.metric-copy strong')
  await expect(count).toHaveText('3,231 / 10,000')
  expect(await count.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
})
