import type {
  Employee,
  EmployeeListParams,
  EmployeeListResponse,
  FilterValuesResponse,
  ImportRecord,
} from './types'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
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
  if (params.minSalary) query.set('min_salary', params.minSalary)
  if (params.maxSalary) query.set('max_salary', params.maxSalary)
  return fetch(`/api/employees?${query}`, { signal }).then((r) => json<EmployeeListResponse>(r))
}

export function fetchFilterValues(): Promise<FilterValuesResponse> {
  return fetch('/api/employees/filters').then((r) => json<FilterValuesResponse>(r))
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
