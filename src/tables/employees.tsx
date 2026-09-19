import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'
import type { Employee } from '../types'

// The API processes the complete dataset. No client row models or function
// registries are needed for sorting/filtering/paginating an already fetched page.
export const employeeTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: {} as { width: number; numeric?: boolean },
})

const columnHelper = createColumnHelper<typeof employeeTableFeatures, Employee>()

export const employeeColumns = columnHelper.columns([
  columnHelper.accessor('id', { header: 'ID', meta: { width: 160 } }),
  columnHelper.accessor('first_name', { header: 'First name', meta: { width: 140 } }),
  columnHelper.accessor('last_name', { header: 'Last name', meta: { width: 140 } }),
  columnHelper.accessor('email', { header: 'Email', meta: { width: 260 } }),
  columnHelper.accessor('department', { header: 'Department', meta: { width: 150 } }),
  columnHelper.accessor('role', { header: 'Role', meta: { width: 170 } }),
  columnHelper.accessor('salary', {
    header: 'Salary',
    meta: { width: 160, numeric: true },
    cell: (info) => info.getValue().toLocaleString(undefined, {
      style: 'currency', currency: info.row.original.currency,
    }),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    meta: { width: 120 },
    cell: (info) => <span className={`badge badge-${info.getValue()}`}>{info.getValue()}</span>,
  }),
  columnHelper.accessor('country', { header: 'Country', meta: { width: 140 } }),
  columnHelper.accessor('joining_date', {
    header: 'Joined',
    meta: { width: 120 },
    cell: (info) => info.getValue().slice(0, 10),
  }),
])

