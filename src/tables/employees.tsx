import {
  createColumnHelper,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table'
import type { Employee } from '../types'
import { Link } from 'react-router-dom'

// The API processes the complete dataset. No client row models or function
// registries are needed for sorting/filtering/paginating an already fetched page.
export const employeeTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: {} as { width: number; numeric?: boolean },
})

const columnHelper = createColumnHelper<typeof employeeTableFeatures, Employee>()

export const dashboardColumns = columnHelper.columns([
  columnHelper.accessor('first_name', {
    header: 'Employee', meta: { width: 245 },
    cell: (info) => {
      const employee = info.row.original
      return <span className="employee-person">
        <span className={`employee-avatar avatar-${employee.first_name.charCodeAt(0) % 4}`} aria-hidden="true">{employee.first_name[0]}{employee.last_name[0]}</span>
        <span className="employee-person-copy"><strong>{employee.first_name} {employee.last_name}</strong><small><Link className="employee-id-link" to={`/employee/${encodeURIComponent(employee.id)}`}>{employee.id}</Link></small></span>
      </span>
    },
  }),
  columnHelper.accessor('role', {
    header: 'Position', meta: { width: 200 },
    cell: (info) => <span className="employee-detail"><span>{info.getValue()}</span><small>{info.row.original.department}</small></span>,
  }),
  columnHelper.accessor('salary', {
    header: 'Salary', meta: { width: 165, numeric: true },
    cell: (info) => info.getValue().toLocaleString(undefined, { style: 'currency', currency: info.row.original.currency }),
  }),
  columnHelper.accessor('status', {
    header: 'Status', meta: { width: 120 },
    cell: (info) => <span className={`badge badge-${info.getValue()}`}>{info.getValue().replace(/_/g, ' ')}</span>,
  }),
  columnHelper.accessor('country', { header: 'Country', meta: { width: 125 } }),
  columnHelper.accessor('joining_date', {
    header: 'Joined', meta: { width: 125 }, cell: (info) => info.getValue().slice(0, 10),
  }),
])

export const employeeColumns = columnHelper.columns([
  columnHelper.accessor('id', {
    header: 'ID', meta: { width: 160 }, cell: (info) => {
      const employee = info.row.original
      return <Link className="employee-id-link" to={`/employee/${encodeURIComponent(employee.id)}`}>{employee.id}</Link>
    },
  }),
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
