import { expect, test, type Page } from '@playwright/test'
import type { Employee } from '../src/types'

const employee: Employee = {
  id: 'EMP-001', first_name: 'Asha', last_name: 'Sharma', email: 'asha@example.com', phone: '+91 9876543210',
  department: 'Engineering', role: 'Engineer', salary: 50000.25, status: 'active', country: 'India',
  joining_date: '2024-02-29T00:00:00Z', currency: 'INR', last_updated_date: '2026-01-01T00:00:00Z', last_updated_by: 'original-hr',
}

async function mockEmployeeApi(page: Page, id = employee.id) {
  const state = {
    employee: { ...employee, id }, patches: [] as { input: Record<string, unknown>; actor: string | undefined }[],
    failSave: false, failLoad: false, beforeSave: async () => {}, reads: 0,
  }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = decodeURIComponent(url.pathname)
    const record = state.employee
    if (path === '/api/auth/me') return route.fulfill({ json: { user: {
      id: 'admin', name: 'Test Admin', email: 'admin@acme.test', is_admin: true,
      permissions: ['employee.read', 'employee.profile.update', 'salary.read', 'salary.change.request',
        'salary.change.approve', 'salary.change.apply', 'payroll.read', 'payroll.manage', 'audit.read', 'user.manage'],
    } } })
    if (path === '/api/employees/filters') return route.fulfill({ json: { filters: {
      department: ['Engineering', 'Finance'], role: ['Engineer', 'Manager'], status: ['active', 'inactive', 'on_leave'],
      country: ['India', 'US'], currency: ['INR', 'USD'],
    } } })
    if (path === '/api/dashboard') return route.fulfill({ json: {
      employees: 1, countries: 1, departments: 1,
      organization: { employees: 1, countries: 1, departments: 1 }, country: null, country_options: [record.country],
      compensation: {
        currency: 'USD', total: record.salary / 109.8755 * 1.146, average: record.salary / 109.8755 * 1.146,
        approximate: true, unavailable_currencies: [],
        departments: [{ department: record.department, employees: 1, total: record.salary / 109.8755 * 1.146 }],
        exchange_rates: { date: '2026-09-18', source: 'European Central Bank',
          source_url: 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml' },
      },
      salaries: [{ currency: record.currency, employees: 1, total: record.salary, average: record.salary }],
      salary_by_department: [{ department: record.department, currency: record.currency, employees: 1, total: record.salary }],
      statuses: [{ status: record.status, employees: 1 }],
    } })
    if (path === '/api/employees') return route.fulfill({ json: {
      data: [record], pagination: { page: 1, limit: 25, total: 1, total_pages: 1 },
    } })
    if (path === `/api/employees/${id}` && route.request().method() === 'GET') {
      state.reads++
      if (state.failLoad) return route.fulfill({ status: 503, json: { error: { message: 'Service unavailable' } } })
      return route.fulfill({ json: { employee: record } })
    }
    if (path === `/api/employees/${id}` && route.request().method() === 'PATCH') {
      const input = route.request().postDataJSON()
      const actor = route.request().headers()['x-updated-by']
      state.patches.push({ input, actor })
      await state.beforeSave()
      if (state.failSave) return route.fulfill({ status: 503, json: { error: { message: 'Storage is temporarily unavailable.' } } })
      if (input.expected_last_updated_date !== state.employee.last_updated_date) return route.fulfill({ status: 409, json: { error: { message: 'Employee was updated since it was read. Refresh before retrying.' } } })
      const { expected_last_updated_date: _version, reason: _reason, ...changes } = input
      state.employee = { ...state.employee, ...changes, last_updated_by: actor!, last_updated_date: `2026-09-19T12:00:0${state.patches.length}.000Z` }
      return route.fulfill({ json: { employee: state.employee, changed: true, audit_id: 2 } })
    }
    return route.fulfill({ status: 404, json: { error: { message: 'Employee not found.' } } })
  })
  return state
}

async function reviewStatusChange(page: Page) {
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('inactive')
  await page.getByLabel('Your work email').fill('hr@example.com')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Are you sure?' })).toBeVisible()
}

test('IDs link to the details page from both the dashboard and full directory', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await mockEmployeeApi(page)
  for (const url of ['/', '/employees']) {
    await page.goto(url)
    const link = page.getByRole('link', { name: 'EMP-001', exact: true })
    await expect(link).toHaveAttribute('href', '/employee/EMP-001')
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL('/employee/EMP-001')
    await expect(page.getByRole('heading', { name: 'Employee details', exact: true })).toBeVisible()
    await expect(page.getByLabel('First name')).toHaveValue('Asha')
    await expect(page.getByLabel('Salary', { exact: true })).toHaveValue('50000.25')
    await expect(page.getByLabel('Joining date')).toHaveValue('2024-02-29')
    await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  }
  expect(errors).toEqual([])
})

test('shows the exact changes before saving, supports cancel, and refreshes the employee and dashboard', async ({ page }) => {
  const state = await mockEmployeeApi(page)
  await page.goto('/')
  await expect(page.getByRole('article', { name: 'Average salary' })).toContainText('≈ $522')
  await page.getByRole('link', { name: 'EMP-001', exact: true }).click()
  await page.getByLabel('First name').fill('Priya')
  await page.getByLabel('Salary', { exact: true }).fill('65000.75')
  await page.getByLabel('Reason for salary change (optional)').fill('Annual review')
  await reviewStatusChange(page)
  const dialog = page.getByRole('dialog', { name: 'Are you sure?' })
  await expect(dialog).toContainText('Asha')
  await expect(dialog).toContainText('Priya')
  await expect(dialog).toContainText('₹50,000.25')
  await expect(dialog).toContainText('₹65,000.75')
  expect(state.patches).toHaveLength(0)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByLabel('Salary', { exact: true })).toHaveValue('65000.75')
  expect(state.patches).toHaveLength(0)
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, update employee' }).click()
  await expect(page.getByRole('status')).toContainText('Employee details updated successfully.')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Priya Sharma' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  expect(state.patches).toEqual([{ actor: 'hr@example.com', input: {
    expected_last_updated_date: employee.last_updated_date, first_name: 'Priya', status: 'inactive', salary: 65000.75, reason: 'Annual review',
  } }])
  await page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByRole('article', { name: 'Average salary' })).toContainText('≈ $678')
  await expect(page.locator('.employee-row').first()).toContainText('Priya Sharma')
  await expect(page.locator('.employee-row').first()).toContainText('inactive')
  await page.getByRole('link', { name: 'EMP-001', exact: true }).click()
  await page.reload()
  await expect(page.getByLabel('First name')).toHaveValue('Priya')
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('inactive')
})

test('failed saves show an error toast, preserve draft values, and can be retried', async ({ page }) => {
  const state = await mockEmployeeApi(page)
  state.failSave = true
  await page.goto('/employee/EMP-001')
  await reviewStatusChange(page)
  await page.getByRole('button', { name: 'Yes, update employee' }).click()
  await expect(page.getByRole('alert')).toContainText('Update failed.')
  await expect(page.getByRole('alert')).toContainText('Storage is temporarily unavailable.')
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('inactive')
  expect(state.employee.status).toBe('active')
  await page.getByRole('button', { name: 'Dismiss notification' }).click()
  await expect(page.getByRole('alert')).toBeHidden()
  state.failSave = false
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.getByRole('button', { name: 'Yes, update employee' }).click()
  await expect(page.getByRole('status')).toContainText('updated successfully')
  expect(state.employee.status).toBe('inactive')
  expect(state.patches).toHaveLength(2)
})

test('prevents duplicate saves while a confirmed update is in flight', async ({ page }) => {
  const state = await mockEmployeeApi(page)
  let release!: () => void
  state.beforeSave = () => new Promise<void>((resolve) => { release = resolve })
  await page.goto('/employee/EMP-001')
  await reviewStatusChange(page)
  await page.getByRole('button', { name: 'Yes, update employee' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(state.patches).toHaveLength(1)
  release()
  await expect(page.getByRole('status')).toContainText('updated successfully')
  expect(state.patches).toHaveLength(1)
})

test('conflicts retain edits until HR reloads the latest version before retrying', async ({ page }) => {
  const state = await mockEmployeeApi(page)
  await page.goto('/employee/EMP-001')
  await reviewStatusChange(page)
  state.employee = { ...state.employee, role: 'Manager', last_updated_date: '2026-09-18T10:00:00.000Z' }
  await page.getByRole('button', { name: 'Yes, update employee' }).click()
  await expect(page.getByRole('alert')).toContainText('Employee was updated since it was read')
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('inactive')
  await page.getByRole('button', { name: 'Reload latest details (discard edits)' }).click()
  await expect(page.getByLabel('Role', { exact: true })).toHaveValue('Manager')
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('active')
  await reviewStatusChange(page)
  await page.getByRole('button', { name: 'Yes, update employee' }).click()
  await expect(page.getByRole('status')).toContainText('updated successfully')
  expect(state.patches.at(-1)!.input.expected_last_updated_date).toBe('2026-09-18T10:00:00.000Z')
  expect(state.employee.role).toBe('Manager')
})

test('validates required inputs and supports resetting edits without sending a request', async ({ page }) => {
  const state = await mockEmployeeApi(page)
  await page.goto('/employee/EMP-001')
  await page.getByLabel('Salary', { exact: true }).fill('-1')
  await page.getByLabel('Your work email').fill('hr@example.com')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(state.patches).toHaveLength(0)
  await page.getByRole('button', { name: 'Reset changes' }).click()
  await expect(page.getByLabel('Salary', { exact: true })).toHaveValue('50000.25')
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled()
  await page.getByLabel('Email', { exact: true }).fill('not-an-email')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(state.patches).toHaveLength(0)
})

test('supports encoded IDs, direct links, mobile editing and accessible confirmation', async ({ page }) => {
  const id = 'EMP / A#1'
  await page.setViewportSize({ width: 390, height: 844 })
  await mockEmployeeApi(page, id)
  await page.goto('/employees')
  await page.getByRole('link', { name: id, exact: true }).click()
  await expect(page).toHaveURL(`/employee/${encodeURIComponent(id)}`)
  await expect(page.getByLabel('First name')).toHaveValue('Asha')
  await reviewStatusChange(page)
  const dialog = page.getByRole('dialog', { name: 'Are you sure?' })
  await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  expect((await dialog.boundingBox())!.width).toBeLessThan(390)
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(dialog).toBeHidden()
})

test('provides recoverable loading failures and an employee-not-found state', async ({ page }) => {
  const state = await mockEmployeeApi(page)
  state.failLoad = true
  await page.goto('/employee/EMP-001')
  await expect(page.getByRole('heading', { name: 'Unable to load employee' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Service unavailable')
  state.failLoad = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByLabel('First name')).toHaveValue('Asha')
  await page.goto('/employee/missing')
  await expect(page.getByRole('heading', { name: 'Employee not found' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to employees' }).click()
  await expect(page).toHaveURL('/employees')
})
