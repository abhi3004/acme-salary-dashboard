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
export interface EmployeePayrollEntry {
  id?: string
  payroll_period_id?: string
  employee_id?: string
  period_name: string
  start_date?: string
  end_date?: string
  payment_due_date: string
  salary_snapshot: number
  currency: string
  additions: number
  deductions: number
  carried_forward: number
  net_payable: number
  amount_paid: number
  outstanding_amount: number
  status: 'pending' | 'partially_paid' | 'paid' | 'projected'
  period_status: 'draft' | 'approved' | 'processing' | 'completed' | 'closed' | 'projected'
  calculated_at?: string
  paid_at?: string | null
}
export interface EmployeePayrollSummary {
  employee_id: string
  upcoming: EmployeePayrollEntry | null
  projection: EmployeePayrollEntry | null
  previous: EmployeePayrollEntry[]
  outstanding: {
    by_currency: { currency: string; amount: number }[]
    periods: EmployeePayrollEntry[]
  }
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
  organization: { employees: number; departments: number; countries: number }
  country: string | null
  country_options: string[]
  salaries: { currency: string; employees: number; total: number; average: number }[]
  salary_by_department: { department: string; currency: string; employees: number; total: number }[]
  statuses: { status: string; employees: number }[]
  compensation: {
    currency: string | null
    total: number | null
    average: number | null
    approximate: boolean
    unavailable_currencies: string[]
    departments: { department: string; employees: number; total: number }[]
    exchange_rates: { date: string; source: string; source_url: string }
  }
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
  search?: string
  minSalary?: string
  maxSalary?: string
}

export const PERMISSIONS = [
  'employee.read', 'employee.profile.update', 'salary.read', 'salary.change.request',
  'salary.change.approve', 'salary.change.apply', 'payroll.read', 'payroll.manage',
  'audit.read', 'user.manage',
] as const
export type Permission = (typeof PERMISSIONS)[number]
export interface AuthUser {
  id: string
  name: string
  email: string
  permissions: Permission[]
  is_admin: boolean
}
export interface ManagedUser extends AuthUser {
  status: 'invited' | 'active' | 'disabled'
  created_at: string
  last_login_at: string | null
}

export type AuditCategory = 'imports' | 'employees' | 'salaries' | 'approvals' | 'payroll' | 'users'
export interface AuditEvent {
  id: number
  category: AuditCategory
  action: string
  actor: string
  resource_type: string
  resource_id: string
  summary: string
  created_at: string
  metadata: Record<string, unknown>
}
export interface AuditLogResponse {
  events: AuditEvent[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}
