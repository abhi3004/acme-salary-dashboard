export interface Employee {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  department: string
  role: string
  salary: number
  status: string
  country: string
  joining_date: string
  currency: string
  last_updated_date: string
  last_updated_by: string
}

export const FILTERABLE_FIELDS = ['department', 'role', 'status', 'country', 'currency'] as const

export type EditableEmployee = Omit<Employee, 'id' | 'last_updated_date' | 'last_updated_by'>
export type EmployeeUpdate = Partial<EditableEmployee> & {
  expected_last_updated_date: string
  reason?: string
}
export interface EmployeeUpdateResponse {
  employee: Employee
  changed: boolean
  audit_id: number | null
}
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected'
export interface EmployeeChangeRequest {
  id: string
  employee_id: string
  requested_by: string
  approved_by: string | null
  reason: string | null
  changes: Partial<EditableEmployee>
  filename: string
  status: ChangeRequestStatus
  error: string | null
  created_at: string
  reviewed_at: string | null
  status_url: string
}
export type FilterableField = (typeof FILTERABLE_FIELDS)[number]

export interface EmployeeListResponse {
  data: Employee[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}

export interface FilterValuesResponse {
  filters: Record<FilterableField, string[]>
}

export interface DashboardSummary {
  employees: number
  departments: number
  countries: number
  salaries: { currency: string; employees: number; total: number; average: number }[]
  salary_by_department: { department: string; currency: string; employees: number; total: number }[]
  statuses: { status: string; employees: number }[]
}

export type ImportStatusValue = 'pending' | 'validating' | 'processing' | 'retrying' | 'completed' | 'failed'

export interface RowError {
  row: number
  field: string
  message: string
}

export interface ImportRecord {
  id: string
  filename: string
  status: ImportStatusValue
  total_rows: number | null
  processed_rows: number
  progress: number
  attempts: number
  error: { code: string; errors?: RowError[]; message?: string } | null
  created_at: string
  updated_at: string
  status_url: string
}

export interface EmployeeListParams {
  page: number
  limit: number
  sort: keyof Employee
  order: 'asc' | 'desc'
  filters: Partial<Record<FilterableField, string>>
  minSalary?: string
  maxSalary?: string
}
