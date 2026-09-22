import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchAuditEvents } from '../api'
import Icon, { type IconName } from '../components/Icon'
import type { AuditCategory, AuditEvent } from '../types'

const categories: Record<AuditCategory, { label: string; icon: IconName }> = {
  imports: { label: 'Imports', icon: 'upload' },
  employees: { label: 'Employees', icon: 'people' },
  salaries: { label: 'Salary changes', icon: 'wallet' },
  approvals: { label: 'Change requests', icon: 'document' },
  payroll: { label: 'Payroll', icon: 'calendar' },
  users: { label: 'User access', icon: 'people' },
}

const fieldLabel = (field: string) => field.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase())
const displayValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.map(displayValue).join(', ')
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function EventDetails({ event }: { event: AuditEvent }) {
  const rawChanges = event.metadata.changes
  const changes = Array.isArray(rawChanges) ? rawChanges.filter((change): change is { field: string; before: unknown; after: unknown } =>
    !!change && typeof change === 'object' && typeof change.field === 'string') : []
  const otherDetails = Object.entries(event.metadata).filter(([key, value]) => key !== 'changes' && value !== null)
  return <details className="audit-details">
    <summary>View details</summary>
    {changes.length > 0 && <div className="table-wrap"><table aria-label="Changed values">
      <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
      <tbody>{changes.map((change) => <tr key={change.field}><td>{fieldLabel(change.field)}</td>
        <td>{displayValue(change.before)}</td><td>{displayValue(change.after)}</td></tr>)}</tbody>
    </table></div>}
    <dl className="audit-metadata">
      <div><dt>Action</dt><dd>{event.action}</dd></div>
      <div><dt>Record</dt><dd>{event.resource_type} · {event.resource_id}</dd></div>
      {otherDetails.map(([key, value]) => <div key={key}><dt>{fieldLabel(key)}</dt><dd>{displayValue(value)}</dd></div>)}
    </dl>
  </details>
}

export default function Notifications({ userId, canViewEmployees }: { userId: string; canViewEmployees: boolean }) {
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState<AuditCategory | ''>('')
  const activity = useQuery({
    queryKey: ['audit-events', userId, page, category],
    queryFn: ({ signal }) => fetchAuditEvents(page, category || undefined, signal),
    refetchInterval: page === 1 ? 30_000 : false,
    staleTime: 0,
  })
  const refresh = () => { if (page === 1) void activity.refetch(); else setPage(1) }
  const pagination = activity.data?.pagination

  return <section className="notifications-page">
    <div className="page-heading"><div><div className="eyebrow">WORKSPACE ACTIVITY</div><h1>Notifications</h1>
      <p>See who changed employee records, salaries, payroll and user access.</p></div>
      <button className="button-secondary" type="button" onClick={refresh} disabled={activity.isFetching}>
        <Icon name="refresh" size={16} />Refresh</button>
    </div>
    <section className="employee-panel" aria-labelledby="audit-heading">
      <div className="audit-toolbar"><div><h2 id="audit-heading">Audit log</h2>
        <p>Newest activity first · Updates every 30 seconds on the first page</p></div>
        <label>Activity type<select value={category} onChange={(event) => {
          setCategory(event.target.value as AuditCategory | ''); setPage(1)
        }}><option value="">All activity</option>
          {Object.entries(categories).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
        </select></label>
      </div>
      {activity.isError && <div className="audit-state" role="alert"><strong>Couldn’t load the audit log.</strong>
        <p>{activity.error.message}</p><button type="button" className="button-secondary" onClick={() => void activity.refetch()}>Try again</button></div>}
      {activity.isPending && <p className="audit-state" role="status">Loading activity…</p>}
      {!activity.isError && activity.data?.events.length === 0 && <div className="audit-state">
        <Icon name="bell" size={28} /><h2>No activity yet</h2><p>{category ? 'No changes match this activity type.'
          : 'New changes will appear here. Earlier records have not been backfilled.'}</p></div>}
      {!activity.isError && activity.data && <ol className="audit-feed" aria-label="Activity" aria-busy={activity.isFetching}>
        {activity.data.events.map((event) => <li key={event.id}>
          <article className="audit-event" aria-label={event.summary}>
            <div className={`audit-event-icon audit-${event.category}`}><Icon name={categories[event.category]?.icon ?? 'document'} size={18} /></div>
            <div className="audit-event-body"><div className="audit-event-topline">
              <span className="audit-category">{categories[event.category]?.label ?? event.category}</span>
              <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}</time></div>
              <h3>{event.summary}</h3><p className="audit-actor">By <strong>{event.actor}</strong>
                {canViewEmployees && event.resource_type === 'employee' && <Link to={`/employee/${encodeURIComponent(event.resource_id)}`}>View employee →</Link>}</p>
              <EventDetails event={event} />
            </div>
          </article>
        </li>)}
      </ol>}
      {pagination && !activity.isError && <div className="pager">
        <span className="muted">{pagination.total.toLocaleString()} event{pagination.total === 1 ? '' : 's'}
          {pagination.total > 0 && ` · page ${pagination.page} of ${pagination.total_pages}`}</span>
        <div className="pager-controls"><button type="button" disabled={page <= 1 || activity.isFetching} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <button type="button" disabled={page >= pagination.total_pages || activity.isFetching} onClick={() => setPage((value) => value + 1)}>Next</button></div>
      </div>}
    </section>
  </section>
}
