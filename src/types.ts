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
export type FilterableField = (typeof FILTERABLE_FIELDS)[number]

export interface EmployeeListResponse {
  data: Employee[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
}

export interface FilterValuesResponse {
  filters: Record<FilterableField, string[]>
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
