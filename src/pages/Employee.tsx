import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ApiError, fetchEmployee, fetchEmployeeChangeRequests, fetchFilterValues, requestEmployeeChange } from '../api'
import Icon from '../components/Icon'
import PayrollOverview from '../components/PayrollOverview'
import type { EditableEmployee, Employee as EmployeeRecord, EmployeeUpdate } from '../types'

const FIELD_LABELS: Record<keyof EditableEmployee, string> = {
  first_name: 'First name', last_name: 'Last name', email: 'Email', phone: 'Phone',
  department: 'Department', role: 'Role', status: 'Status', country: 'Country',
  joining_date: 'Joining date', salary: 'Salary', currency: 'Currency',
}
const FIELDS = Object.keys(FIELD_LABELS) as (keyof EditableEmployee)[]
type Draft = Record<keyof EditableEmployee, string>
type Change = { field: keyof EditableEmployee; before: string; after: string }
type Confirmation = { input: EmployeeUpdate; actor: string; changes: Change[]; proof: File }
type Toast = { kind: 'success' | 'error'; message: string }
const statusLabel = (status: string) => status.replace(/[_-]/g, ' ').replace(/^./, (value) => value.toUpperCase())
const toDraft = (employee: EmployeeRecord) => Object.fromEntries(FIELDS.map((field) => [
  field, field === 'joining_date' ? employee[field].slice(0, 10) : String(employee[field]),
])) as Draft
const formatDate = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
const formatSalary = (value: string | number, currency: string) => Number(value).toLocaleString('en-US', { style: 'currency', currency })

export default function Employee() {
  const { id = '' } = useParams<{ id: string }>()
  const employee = useQuery({
    queryKey: ['employee', id], queryFn: ({ signal }) => fetchEmployee(id, signal),
    refetchOnWindowFocus: false,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  })

  if (employee.isPending) return <section className="panel employee-load-state" role="status"><Icon name="people" size={30} /><h1>Employee details</h1><p>Loading employee details…</p></section>
  if (employee.isError && !employee.data) return <section className="panel employee-load-state">
    <Icon name="people" size={30} /><h1>{employee.error instanceof ApiError && employee.error.status === 404 ? 'Employee not found' : 'Unable to load employee'}</h1>
    <p role="alert">{employee.error.message}</p>
    <div className="form-actions"><Link className="button button-secondary" to="/employees">Back to employees</Link><button onClick={() => employee.refetch()}>Try again</button></div>
  </section>
  return <EmployeeEditor key={id} initialEmployee={employee.data} reload={() => employee.refetch().then((result) => {
    if (result.error) throw result.error
    return result.data!
  })} />
}

function EmployeeEditor({ initialEmployee, reload }: { initialEmployee: EmployeeRecord; reload: () => Promise<EmployeeRecord> }) {
  const queryClient = useQueryClient()
  // Keep a saved snapshot so a refetch cannot overwrite HR's in-progress edits.
  const [saved, setSaved] = useState(initialEmployee)
  const [draft, setDraft] = useState(() => toDraft(initialEmployee))
  const [actor, setActor] = useState('')
  const [reason, setReason] = useState('')
  const [proof, setProof] = useState<File | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [reloading, setReloading] = useState(false)
  const [activeTab, setActiveTab] = useState<'details' | 'payroll'>('details')
  const filters = useQuery({ queryKey: ['filter-values'], queryFn: fetchFilterValues })
  const requests = useQuery({ queryKey: ['employee-change-requests', saved.id], queryFn: () => fetchEmployeeChangeRequests(saved.id),
    refetchInterval: (query) => query.state.data?.requests.some((request) => request.status === 'pending') ? 1000 : false })
  const original = toDraft(saved)
  const changes: Change[] = FIELDS.filter((field) => field === 'salary'
    ? Number(draft.salary) !== saved.salary || draft.salary.trim() === ''
    : draft[field].trim() !== original[field]
  ).map((field) => ({ field, before: original[field], after: draft[field].trim() }))
  const statuses = [...new Set(['active', 'inactive', 'on_leave', saved.status, ...(filters.data?.filters.status ?? [])])]
  const currencies = [...new Set([...Intl.supportedValuesOf('currency'), saved.currency])].sort()

  const update = useMutation({
    mutationFn: ({ input, actor: updatedBy, proof: document }: Confirmation) => requestEmployeeChange(saved.id, input, updatedBy, document),
    onSuccess: () => {
      setReason('')
      setProof(null)
      setConfirmation(null)
      setToast({ kind: 'success', message: 'Change request submitted. The proof PDF is being checked asynchronously.' })
      void queryClient.invalidateQueries({ queryKey: ['employee-change-requests', saved.id] })
    },
    onError: (error) => {
      setConfirmation(null)
      setToast({ kind: 'error', message: `Update failed. ${error.message}` })
    },
  })

  useEffect(() => {
    if (toast?.kind !== 'success') return
    const timer = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const changeField = (field: keyof EditableEmployee, value: string) => {
    setDraft((previous) => ({ ...previous, [field]: value }))
    setToast(null)
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!changes.length || update.isPending || !proof || !reason.trim()) return
    const input: EmployeeUpdate = { expected_last_updated_date: saved.last_updated_date }
    for (const { field, after } of changes) {
      if (field === 'salary') input.salary = Number(after)
      else input[field] = after
    }
    input.reason = reason.trim()
    setConfirmation({ input, actor: actor.trim(), changes, proof })
  }
  const reset = () => {
    setDraft(toDraft(saved))
    setReason('')
    setProof(null)
    setToast(null)
    update.reset()
  }
  const reloadLatest = async () => {
    setReloading(true)
    try {
      const latest = await reload()
      setSaved(latest)
      setDraft(toDraft(latest))
      setReason('')
      update.reset()
      setToast({ kind: 'success', message: 'Latest employee details loaded. You can edit them now.' })
    } catch (error) {
      setToast({ kind: 'error', message: `Could not reload employee details. ${(error as Error).message}` })
    } finally {
      setReloading(false)
    }
  }
  const input = (field: keyof EditableEmployee, type = 'text', list?: string) => <label key={field}>
    {FIELD_LABELS[field]}<input name={field} type={type} required maxLength={255} value={draft[field]}
      list={list ? `employee-${list}-options` : undefined}
      onChange={(event) => changeField(field, event.target.value)} />
  </label>

  return <section className="employee-details-page">
    <nav className="employee-breadcrumb" aria-label="Breadcrumb"><Link to="/">Dashboard</Link><Icon name="chevron" size={12} /><Link to="/employees">Employees</Link><Icon name="chevron" size={12} /><span>{saved.id}</span></nav>
    <div className="page-heading"><div><div className="eyebrow">PEOPLE & PAYROLL</div><h1>Employee details</h1><p>Manage employee information, status, and salary.</p></div>
      <Link className="button button-secondary" to="/employees">Back to employees</Link>
    </div>
    <div className="employee-profile-banner">
      <span className="profile-avatar" aria-hidden="true">{saved.first_name[0]}{saved.last_name[0]}</span>
      <div className="profile-identity"><h2>{saved.first_name} {saved.last_name}</h2><p>{saved.role} <span>·</span> {saved.department}</p><span className="profile-id">{saved.id}</span></div>
      <span className={`badge profile-status badge-${saved.status}`}>{statusLabel(saved.status)}</span>
    </div>
    <div className="employee-tabs" role="tablist" aria-label="Employee sections">
      <button type="button" role="tab" aria-selected={activeTab === 'details'} onClick={() => setActiveTab('details')}>Employee details</button>
      <button type="button" role="tab" aria-selected={activeTab === 'payroll'} onClick={() => setActiveTab('payroll')}>Payroll history</button>
    </div>
    {activeTab === 'payroll' ? <div role="tabpanel"><PayrollOverview employeeId={saved.id} /></div> : <div className="employee-details-layout" role="tabpanel">
      <form className="employee-edit-form" onSubmit={submit}>
        <fieldset disabled={update.isPending || reloading} className="employee-fields">
          <section className="panel employee-form-section" aria-labelledby="personal-heading">
            <div className="detail-section-heading"><span><Icon name="people" /></span><div><h2 id="personal-heading">Personal information</h2><p>The essentials about this employee.</p></div></div>
            <div className="form-grid employee-detail-fields">{input('first_name')}{input('last_name')}{input('email', 'email')}{input('phone', 'tel')}</div>
          </section>
          <section className="panel employee-form-section" aria-labelledby="employment-heading">
            <div className="detail-section-heading"><span><Icon name="building" /></span><div><h2 id="employment-heading">Employment details</h2><p>Keep their role, team, and status up to date.</p></div></div>
            <div className="form-grid employee-detail-fields">
              {input('department', 'text', 'department')}{input('role', 'text', 'role')}
              <label>Status<select name="status" value={draft.status} onChange={(event) => changeField('status', event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</select></label>
              {input('country', 'text', 'country')}{input('joining_date', 'date')}
            </div>
          </section>
          <section className="panel employee-form-section" aria-labelledby="compensation-heading">
            <div className="detail-section-heading"><span><Icon name="wallet" /></span><div><h2 id="compensation-heading">Salary & compensation</h2><p>Salary changes are recorded in the employee’s salary history.</p></div></div>
            <div className="form-grid employee-detail-fields">
              <label>Salary<input name="salary" type="number" min="0" max={Number.MAX_SAFE_INTEGER / 100} step="0.01" required value={draft.salary} onChange={(event) => changeField('salary', event.target.value)} /></label>
              <label>Currency<select name="currency" value={draft.currency} onChange={(event) => changeField('currency', event.target.value)}>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>
            </div>
          </section>
          <section className="panel employee-save-section">
            <label>Your work email<input type="email" required maxLength={255} value={actor} placeholder="you@company.com" onChange={(event) => setActor(event.target.value)} autoComplete="email" /></label>
            <label>Reason<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Must match the Reason in the PDF" /></label>
            <label>Approved proof PDF<input type="file" required accept="application/pdf,.pdf" onChange={(event) => setProof(event.target.files?.[0] ?? null)} /></label>
            <p className="field-help">The PDF must be titled “Employee Change Authorization” and contain Employee ID, Reason, Approved By, Approval Date, and one <code>field: value</code> line for every changed field.</p>
            {update.isError && <div className="employee-save-error"><p>{update.error.message}</p>
              {update.error instanceof ApiError && update.error.status === 409 && <button type="button" className="link" onClick={reloadLatest}>Reload latest details (discard edits)</button>}
            </div>}
            <div className="employee-save-actions"><span>{changes.length ? `${changes.length} unsaved change${changes.length === 1 ? '' : 's'}` : 'All changes saved'}</span>
              <div><button type="button" className="button-secondary" onClick={reset} disabled={!changes.length}>Reset changes</button><button type="submit" disabled={!changes.length || !proof || !reason.trim() || update.isPending}>{update.isPending ? 'Submitting…' : 'Request changes'}</button></div>
            </div>
          </section>
        </fieldset>
        {(['department', 'role', 'country'] as const).map((field) => <datalist key={field} id={`employee-${field}-options`}>{filters.data?.filters[field].map((value) => <option key={value} value={value} />)}</datalist>)}
      </form>
      <aside className="employee-summary" aria-label="Saved employee record">
        <section className="panel"><div className="eyebrow">CURRENT RECORD</div><h2>At a glance</h2>
          <div className="employee-salary-summary"><Icon name="wallet" /><strong>{formatSalary(saved.salary, saved.currency)}</strong><span>Recorded salary · {saved.currency}</span></div>
          <dl className="employee-record-list"><div><dt>Employee ID</dt><dd>{saved.id}</dd></div><div><dt>Status</dt><dd>{statusLabel(saved.status)}</dd></div><div><dt>Country</dt><dd>{saved.country}</dd></div><div><dt>Joined</dt><dd>{formatDate(saved.joining_date)}</dd></div></dl>
        </section>
        <section className="panel record-update-panel"><span className="record-update-icon"><Icon name="calendar" /></span><h2>Last updated</h2><p>{formatDate(saved.last_updated_date)}</p><span>By {saved.last_updated_by}</span><p className="field-help">Employee ID stays the same when details are updated.</p></section>
        <section className="panel change-request-panel"><div className="eyebrow">CHANGE REQUESTS</div><h2>Approval status</h2>
          {!requests.data?.requests.length && <p className="field-help">No change requests yet.</p>}
          {requests.data?.requests.slice(0, 5).map((request) => <div className="change-request-item" key={request.id}><strong>{request.status}</strong><span>{request.filename}</span>{request.approved_by && <small>Approved by {request.approved_by}</small>}{request.error && <small>{request.error}</small>}</div>)}
        </section>
      </aside>
    </div>}
    {confirmation && <ConfirmUpdate confirmation={confirmation} name={`${saved.first_name} ${saved.last_name}`} currency={saved.currency} busy={update.isPending}
      onCancel={() => setConfirmation(null)} onConfirm={() => { if (!update.isPending) update.mutate(confirmation) }} />}
    {toast && <div className={`update-toast toast-${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast-symbol" aria-hidden="true">{toast.kind === 'success' ? '✓' : '!'}</span><div><strong>{toast.kind === 'success' ? 'Success' : 'Update failed'}</strong><p>{toast.message}</p></div>
      <button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={16} /></button>
    </div>}
  </section>
}

function ConfirmUpdate({ confirmation, name, currency, busy, onCancel, onConfirm }: {
  confirmation: Confirmation; name: string; currency: string; busy: boolean; onCancel: () => void; onConfirm: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  const display = (change: Change, side: 'before' | 'after') => change.field === 'salary'
    ? formatSalary(change[side], side === 'after' ? confirmation.input.currency ?? currency : currency)
    : change.field === 'status' ? statusLabel(change[side]) : change[side]
  return <dialog className="employee-confirm-dialog" ref={dialog} aria-labelledby="confirm-update-heading" aria-describedby="confirm-update-description"
    onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <span className="confirm-icon"><Icon name="people" size={24} /></span><h2 id="confirm-update-heading">Are you sure?</h2>
    <p id="confirm-update-description">Update the following details for <strong>{name}</strong>?</p>
    <div className="confirmation-change-list">{confirmation.changes.map((change) => <div className="confirmation-change" key={change.field}>
      <strong>{FIELD_LABELS[change.field]}</strong><div><span>{display(change, 'before')}</span><Icon name="arrow" size={14} /><span>{display(change, 'after')}</span></div>
    </div>)}</div>
    {confirmation.input.reason && <p className="confirmation-reason"><strong>Reason:</strong> {confirmation.input.reason}</p>}
    <p className="confirmation-actor">Requested by {confirmation.actor} · Proof: {confirmation.proof.name}</p>
    <div className="confirm-actions"><button type="button" className="button-secondary" disabled={busy} onClick={onCancel} autoFocus>Cancel</button><button type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Submitting…' : 'Submit request'}</button></div>
  </dialog>
}
