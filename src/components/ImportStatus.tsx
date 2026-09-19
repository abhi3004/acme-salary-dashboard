import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchImport } from '../api'
import type { ImportRecord } from '../types'

const TERMINAL = ['completed', 'failed']

export default function ImportStatus({ importId }: { importId: string }) {
  const queryClient = useQueryClient()
  const record = useQuery({
    queryKey: ['import', importId],
    queryFn: () => fetchImport(importId),
    refetchInterval: (query) =>
      query.state.data && TERMINAL.includes(query.state.data.status) ? false : 1000,
  })

  // Refresh the employee list once the batch lands.
  const completedOnce = useRef(false)
  useEffect(() => {
    if (record.data?.status === 'completed' && !completedOnce.current) {
      completedOnce.current = true
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['filter-values'] })
    }
  }, [record.data?.status, queryClient])

  if (record.isPending) return <p className="muted">Checking import status…</p>
  if (record.isError) return <p className="error">{(record.error as Error).message}</p>
  return <ImportCard record={record.data} />
}

function ImportCard({ record }: { record: ImportRecord }) {
  const running = !TERMINAL.includes(record.status)
  return (
    <div className={`import-card import-${record.status}`}>
      <div className="import-head">
        <strong>{record.filename}</strong>
        <span className={`badge badge-${record.status}`}>{record.status}</span>
      </div>
      <div className="progress">
        <div className="progress-bar" style={{ width: `${record.status === 'completed' ? 100 : record.progress}%` }} />
      </div>
      <p className="muted">
        {record.total_rows !== null
          ? `${record.processed_rows} of ${record.total_rows} rows processed (${record.progress}%)`
          : 'Validating file…'}
        {record.attempts > 1 && ` · attempt ${record.attempts}`}
        {running && ' · updating every second'}
      </p>
      {record.status === 'failed' && record.error?.errors && (
        <div className="table-wrap">
          <table className="error-table">
            <thead><tr><th>Row</th><th>Field</th><th>Problem</th></tr></thead>
            <tbody>
              {record.error.errors.map((e, i) => (
                <tr key={i}><td>{e.row}</td><td>{e.field}</td><td>{e.message}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {record.status === 'failed' && !record.error?.errors && (
        <p className="error">{record.error?.message ?? 'The import failed.'}</p>
      )}
    </div>
  )
}
