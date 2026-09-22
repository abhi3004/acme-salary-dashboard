import type {
  Employee,
  EmployeeListParams,
  EmployeeListResponse,
  FilterValuesResponse,
  ImportRecord,
  DashboardSummary,
  EmployeeUpdate,
  EmployeeUpdateResponse,
  EmployeeChangeRequest,
  EmployeePayrollSummary,
  AuthUser,
  ManagedUser,
  Permission,
  AuditCategory,
  AuditLogResponse,
} from './types'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return fetch('/api/auth/me').then((response) => json<{ user: AuthUser }>(response)).then((body) => body.user)
}

export function login(email: string, password: string): Promise<AuthUser> {
  return fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }) })
    .then((response) => json<{ user: AuthUser }>(response)).then((body) => body.user)
}

export function logout(): Promise<void> {
  return fetch('/api/auth/logout', { method: 'POST' }).then((response) => {
    if (!response.ok && response.status !== 204) return json<never>(response)
  }) as Promise<void>
}

export function fetchUsers(): Promise<{ users: ManagedUser[]; permissions: Permission[] }> {
  return fetch('/api/users').then((response) => json(response))
}

export function fetchAuditEvents(page: number, category?: AuditCategory, signal?: AbortSignal): Promise<AuditLogResponse> {
  const query = new URLSearchParams({ page: String(page), limit: '25' })
  if (category) query.set('category', category)
  return fetch(`/api/audit-events?${query}`, { signal }).then((response) => json<AuditLogResponse>(response))
}

export function inviteUser(input: { name: string; email: string; permissions: Permission[] }): Promise<{
  invitation: { email: string; token: string; expires_at: string; accept_url: string }
}> {
  return fetch('/api/users/invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input) }).then((response) => json(response))
}

export function acceptInvitation(token: string, password: string): Promise<void> {
  return fetch(`/api/auth/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }).then(async (response) => {
    if (!response.ok) await json<never>(response)
  })
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.message ?? `Request failed with status ${response.status}.`)
  }
  return body as T
}

export function fetchEmployees(params: EmployeeListParams, signal?: AbortSignal): Promise<EmployeeListResponse> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
    sort: params.sort,
    order: params.order,
  })
  for (const [field, value] of Object.entries(params.filters)) {
    if (value) query.set(field, value)
  }
  if (params.search) query.set('search', params.search)
  if (params.minSalary) query.set('min_salary', params.minSalary)
  if (params.maxSalary) query.set('max_salary', params.maxSalary)
  return fetch(`/api/employees?${query}`, { signal }).then((r) => json<EmployeeListResponse>(r))
}

export function fetchFilterValues(): Promise<FilterValuesResponse> {
  return fetch('/api/employees/filters').then((r) => json<FilterValuesResponse>(r))
}

export function fetchDashboard(signal?: AbortSignal, country?: string): Promise<DashboardSummary> {
  const query = country ? `?${new URLSearchParams({ country })}` : ''
  return fetch(`/api/dashboard${query}`, { signal }).then((r) => json<DashboardSummary>(r))
}

export function fetchEmployee(id: string, signal?: AbortSignal): Promise<Employee> {
  return fetch(`/api/employees/${encodeURIComponent(id)}`, { signal })
    .then((response) => json<{ employee: Employee }>(response)).then((body) => body.employee)
}

export function updateEmployee(id: string, input: EmployeeUpdate, actor: string): Promise<EmployeeUpdateResponse> {
  return fetch(`/api/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Updated-By': actor },
    body: JSON.stringify(input),
  }).then((response) => json<EmployeeUpdateResponse>(response))
}

export function requestEmployeeChange(id: string, input: EmployeeUpdate, actor: string, proof: File): Promise<EmployeeChangeRequest> {
  const form = new FormData()
  form.append('proof', proof)
  form.append('changes', JSON.stringify(input))
  return fetch(`/api/employees/${encodeURIComponent(id)}/change-requests`, {
    method: 'POST', headers: { 'X-Updated-By': actor }, body: form,
  }).then((response) => json<EmployeeChangeRequest>(response))
}

export function fetchEmployeeChangeRequests(id: string): Promise<{ requests: EmployeeChangeRequest[] }> {
  return fetch(`/api/employees/${encodeURIComponent(id)}/change-requests`).then((response) => json(response))
}

export function fetchEmployeePayroll(id: string, signal?: AbortSignal): Promise<EmployeePayrollSummary> {
  return fetch(`/api/employees/${encodeURIComponent(id)}/payroll`, { signal }).then((response) => json<EmployeePayrollSummary>(response))
}

export function fetchImport(id: string): Promise<ImportRecord> {
  return fetch(`/api/employees/imports/${id}`).then((r) => json<ImportRecord>(r))
}

export function uploadImportFile(file: File): Promise<ImportRecord> {
  const form = new FormData()
  form.append('file', file)
  return fetch('/api/employees/imports', { method: 'POST', body: form }).then((r) => json<ImportRecord>(r))
}

const CSV_COLUMNS = [
  'id', 'first_name', 'last_name', 'email', 'phone', 'department', 'role',
  'salary', 'status', 'country', 'joining_date', 'currency',
  'last_updated_date', 'last_updated_by',
] as const satisfies readonly (keyof Employee)[]

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`

// The backend only accepts bulk imports, so a single employee is submitted
// as a one-row CSV through the same validated import pipeline.
export function uploadSingleEmployee(employee: Record<(typeof CSV_COLUMNS)[number], string>): Promise<ImportRecord> {
  const csv = [
    CSV_COLUMNS.join(','),
    CSV_COLUMNS.map((column) => csvCell(employee[column])).join(','),
  ].join('\n')
  const file = new File([csv], `employee-${employee.id}.csv`, { type: 'text/csv' })
  return uploadImportFile(file)
}
