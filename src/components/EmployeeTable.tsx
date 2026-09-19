import { useCallback, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { batch } from '@tanstack/react-store'
import type { ReactTable } from '@tanstack/react-table'
import type { employeeTableFeatures } from '../tables/employees'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Employee } from '../types'

const ROW_HEIGHT = 44
const HEADER_HEIGHT = 44

interface EmployeeTableProps<TSelected = unknown> {
  table: ReactTable<typeof employeeTableFeatures, Employee, TSelected>
  scrollKey: string
  busy: boolean
  emptyMessage: string
}

export default function EmployeeTable<TSelected>({ table, scrollKey, busy, emptyMessage }: EmployeeTableProps<TSelected>) {
  // TanStack Virtual exposes a mutable instance; keep its reads out of compiler memoization.
  'use no memo'

  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = table.getRowModel().rows
  const columns = table.getAllLeafColumns()
  const getItemKey = useCallback((index: number) => rows[index].id, [rows])
  // oxlint-disable-next-line react/incompatible-library -- This component explicitly opts out with 'use no memo' above.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey,
    overscan: 5,
    // Rows start below the header, which remains in the native table flow.
    scrollMargin: HEADER_HEIGHT,
  })

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [scrollKey])

  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualRows.length ? virtualRows[0].start - HEADER_HEIGHT : 0
  const paddingBottom = virtualRows.length
    ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - HEADER_HEIGHT)
    : 0

  return (
    <div
      ref={scrollRef}
      className="table-wrap employee-table-scroll"
      role="region"
      aria-label="Employee table, scroll to see more rows and columns"
      tabIndex={0}
      style={{ '--employee-row-height': `${ROW_HEIGHT}px`, '--employee-header-height': `${HEADER_HEIGHT}px` } as CSSProperties}
    >
      <table
        className="employee-table"
        aria-label="Employees"
        aria-busy={busy}
        aria-rowcount={rows.length + 1}
        style={{ width: columns.reduce((width, column) => width + column.columnDef.meta!.width, 0) }}
      >
        <colgroup>
          {columns.map((column) => <col key={column.id} style={{ width: column.columnDef.meta!.width }} />)}
        </colgroup>
        <table.Subscribe source={table.atoms.sorting}>
          {(sorting) => (
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} aria-rowindex={1}>
                  {group.headers.map((header) => {
                    const sort = sorting.find((entry) => entry.id === header.column.id)
                    return (
                      <th key={header.id} scope="col" aria-sort={sort ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                        <button
                          type="button"
                          className="table-sort"
                          onClick={() => batch(() => {
                            header.column.toggleSorting()
                            table.setPageIndex(0)
                          })}
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="sort-indicator">{sort ? (sort.desc ? '▼' : '▲') : '↕'}</span>
                        </button>
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
          )}
        </table.Subscribe>
        <tbody>
          {paddingTop > 0 && (
            <tr aria-hidden="true" className="virtual-spacer"><td colSpan={columns.length} style={{ height: paddingTop }} /></tr>
          )}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]
            return (
              <tr key={row.id} className="employee-row" aria-rowindex={virtualRow.index + 2}>
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className={cell.column.columnDef.meta?.numeric ? 'num' : undefined}>
                    <span className="employee-cell" title={String(cell.getValue() ?? '')}>
                      <table.FlexRender cell={cell} />
                    </span>
                  </td>
                ))}
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true" className="virtual-spacer"><td colSpan={columns.length} style={{ height: paddingBottom }} /></tr>
          )}
          {!rows.length && (
            <tr><td colSpan={columns.length} className="muted">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
