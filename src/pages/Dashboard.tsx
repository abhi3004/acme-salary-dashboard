import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCreateAtom, useSelector } from '@tanstack/react-store'
import { useTable, type PaginationState, type SortingState } from '@tanstack/react-table'
import { fetchEmployees, fetchFilterValues } from '../api'
import EmployeeTable from '../components/EmployeeTable'
import { employeeColumns, employeeTableFeatures } from '../tables/employees'
import { FILTERABLE_FIELDS, type Employee, type EmployeeListParams, type FilterableField } from '../types'

const EMPTY_EMPLOYEES: Employee[] = []

const fieldLabel = (field: string) => field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export default function Dashboard() {
  // Query and Table share only the slices needed to request a server page.
  const sortingAtom = useCreateAtom<SortingState>([{ id: 'id', desc: false }])
  const paginationAtom = useCreateAtom<PaginationState>({ pageIndex: 0, pageSize: 25 })
  const sorting = useSelector(sortingAtom)
  const page = useSelector(paginationAtom)
  const [filters, setFilters] = useState<EmployeeListParams['filters']>({})
  const [salary, setSalary] = useState({ min: '', max: '' })
  const [salaryDraft, setSalaryDraft] = useState({ min: '', max: '' })
  const params: EmployeeListParams = {
    page: page.pageIndex + 1,
    limit: page.pageSize,
    sort: (sorting[0]?.id ?? 'id') as keyof Employee,
    order: sorting[0]?.desc ? 'desc' : 'asc',
    filters,
    minSalary: salary.min,
    maxSalary: salary.max,
  }

  const filterValues = useQuery({ queryKey: ['filter-values'], queryFn: fetchFilterValues })
  const employees = useQuery({
    queryKey: ['employees', params],
    queryFn: ({ signal }) => fetchEmployees(params, signal),
    placeholderData: keepPreviousData,
  })

  const table = useTable({
    features: employeeTableFeatures,
    columns: employeeColumns,
    data: employees.data?.data ?? EMPTY_EMPLOYEES,
    getRowId: (employee) => employee.id,
    atoms: { sorting: sortingAtom, pagination: paginationAtom },
    manualSorting: true,
    manualPagination: true,
    rowCount: employees.data?.pagination.total ?? 0,
    enableMultiSort: false,
    enableSortingRemoval: false,
    sortDescFirst: false,
  }, () => null)

  const setFilter = (field: FilterableField, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    table.setPageIndex(0)
  }
  const applySalary = () => {
    setSalary({ min: salaryDraft.min.trim(), max: salaryDraft.max.trim() })
    table.setPageIndex(0)
  }
  const clearFilters = () => {
    setSalaryDraft({ min: '', max: '' })
    setSalary({ min: '', max: '' })
    setFilters({})
    table.setPageIndex(0)
  }

  const pagination = employees.data?.pagination
  const hasFilters = Object.values(params.filters).some(Boolean) || params.minSalary || params.maxSalary

  return (
    <section>
      <h1>Employees</h1>
      <div className="filters">
        {FILTERABLE_FIELDS.map((field) => (
          <label key={field}>
            {fieldLabel(field)}
            <select value={params.filters[field] ?? ''} onChange={(e) => setFilter(field, e.target.value)}>
              <option value="">All</option>
              {(filterValues.data?.filters[field] ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Min salary
          <input type="number" min="0" value={salaryDraft.min} placeholder="0"
            onChange={(e) => setSalaryDraft((s) => ({ ...s, min: e.target.value }))}
            onBlur={applySalary} onKeyDown={(e) => e.key === 'Enter' && applySalary()} />
        </label>
        <label>
          Max salary
          <input type="number" min="0" value={salaryDraft.max} placeholder="Any"
            onChange={(e) => setSalaryDraft((s) => ({ ...s, max: e.target.value }))}
            onBlur={applySalary} onKeyDown={(e) => e.key === 'Enter' && applySalary()} />
        </label>
        {hasFilters && <button type="button" className="link" onClick={clearFilters}>Clear filters</button>}
      </div>

      {employees.isError && <p className="error" role="alert">{employees.error.message}</p>}
      <p className="muted table-status" role="status">
        {employees.isPending ? 'Loading employees…' : employees.isFetching ? 'Updating employees…' : '\u00a0'}
      </p>
      <EmployeeTable
        table={table}
        scrollKey={JSON.stringify(params)}
        busy={employees.isFetching}
        emptyMessage={employees.isPending ? 'Loading employees…' : employees.isError
          ? 'Unable to load employees.' : 'No employees match the current filters.'}
      />
      {pagination && (
        <div className="pager">
          <span className="muted">
            {pagination.total} employee{pagination.total === 1 ? '' : 's'}
            {pagination.total > 0 && ` · page ${pagination.page} of ${pagination.total_pages}`}
          </span>
          <div className="pager-controls">
            <select aria-label="Employees per page" value={page.pageSize}
              onChange={(e) => table.setPagination({ pageIndex: 0, pageSize: Number(e.target.value) })}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button disabled={employees.isPlaceholderData || !table.getCanPreviousPage()}
              onClick={() => table.previousPage()}>Previous</button>
            <button disabled={employees.isPlaceholderData || !table.getCanNextPage()}
              onClick={() => table.nextPage()}>Next</button>
          </div>
        </div>
      )}
    </section>
  )
}
