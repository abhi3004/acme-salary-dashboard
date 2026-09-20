import { useMemo, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { jsPDF } from 'jspdf'
import Icon from '../components/Icon'
import { fetchEmployees } from '../api'

type PermissionKind = 'detail' | 'increment' | 'decrement' | 'status'
type Permission = { id: number; kind: PermissionKind; field: string; value: string; amount: string }

const DETAIL_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'department', 'role', 'country', 'joining_date', 'currency']
const C_LEVEL_ROLES = ['Chief Executive Officer (CEO)', 'Chief People Officer (CPO)', 'Chief Financial Officer (CFO)', 'Chief Operating Officer (COO)']
const blankPermission = (id: number): Permission => ({ id, kind: 'detail', field: 'role', value: '', amount: '' })
const label = (value: string) => value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())
const formatSalary = (salary: number, currency: string) => salary.toLocaleString('en-US', { style: 'currency', currency })

function authorizedChange(permission: Permission, currentSalary?: number): { field: string; value: string; summary: string } | null {
  if (permission.kind === 'detail' && permission.value.trim()) return { field: permission.field, value: permission.value.trim(), summary: `${label(permission.field)} change` }
  if (permission.kind === 'status' && permission.value) return { field: 'status', value: permission.value, summary: permission.value === 'inactive' ? 'Employment termination / firing' : 'Employment status change' }
  if ((permission.kind === 'increment' || permission.kind === 'decrement') && currentSalary !== undefined && permission.amount) {
    const current = currentSalary
    const amount = Number(permission.amount)
    const value = permission.kind === 'increment' ? current + amount : current - amount
    if (Number.isFinite(value) && value >= 0) return { field: 'salary', value: value.toFixed(2).replace(/\.00$/, ''), summary: `Salary ${permission.kind} of ${amount}` }
  }
  return null
}

export default function PermissionGenerator() {
  const [employeeId, setEmployeeId] = useState('')
  const [employeeIdTouched, setEmployeeIdTouched] = useState(false)
  const [requestedBy, setRequestedBy] = useState('')
  const [reason, setReason] = useState('')
  const [authorityRole, setAuthorityRole] = useState(C_LEVEL_ROLES[0]!)
  const [authorityName, setAuthorityName] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>([blankPermission(1)])
  const [generated, setGenerated] = useState(false)
  const employees = useQuery({
    queryKey: ['permission-generator-employees'],
    queryFn: ({ signal }) => fetchEmployees({ page: 1, limit: 10000, sort: 'id', order: 'asc', filters: {} }, signal),
    staleTime: 60_000,
  })
  const normalizedEmployeeId = employeeId.trim().toLocaleLowerCase()
  const selectedEmployee = employees.data?.data.find((employee) => employee.id.toLocaleLowerCase() === normalizedEmployeeId)
  const employeeName = selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : ''
  const employeeError = Boolean(employeeIdTouched && employeeId.trim() && !employees.isPending && !selectedEmployee)
  const changes = useMemo(() => permissions.map((permission) => authorizedChange(permission, selectedEmployee?.salary))
    .filter((change): change is NonNullable<typeof change> => Boolean(change)), [permissions, selectedEmployee?.salary])
  const duplicateFields = new Set(changes.filter((change, index) => changes.findIndex((candidate) => candidate.field === change.field) !== index).map((change) => change.field))

  const update = (id: number, values: Partial<Permission>) => setPermissions((items) => items.map((item) => item.id === id ? { ...item, ...values } : item))
  const add = () => setPermissions((items) => [...items, blankPermission(Math.max(0, ...items.map((item) => item.id)) + 1)])

  const generate = (event: FormEvent) => {
    event.preventDefault()
    if (!selectedEmployee || !changes.length || duplicateFields.size) return
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const left = 22
    pdf.setFillColor(34, 35, 36)
    pdf.rect(0, 0, 210, 37, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text('EMPLOYEE CHANGE AUTHORIZATION', left, 18)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text('C-level permission request | Confidential', left, 27)
    pdf.setTextColor(41, 45, 50)
    pdf.setFontSize(10)
    let y = 51
    const line = (title: string, value: string) => { pdf.setFont('helvetica', 'bold'); pdf.text(`${title}:`, left, y); pdf.setFont('helvetica', 'normal'); pdf.text(value, 59, y); y += 8 }
    line('Employee ID', selectedEmployee.id)
    line('Employee Name', employeeName.trim())
    line('Current Role', selectedEmployee.role)
    line('Current Salary', `${selectedEmployee.salary} ${selectedEmployee.currency}`)
    line('Requested By', requestedBy.trim())
    line('Approving Authority', authorityRole)
    line('Approved By', authorityName.trim())
    line('Approval Date', new Date().toISOString().slice(0, 10))
    const oneLineReason = reason.replace(/\s+/g, ' ').trim()
    line('Reason', oneLineReason)
    y += 6
    pdf.setFillColor(240, 245, 241)
    pdf.roundedRect(left, y - 7, 166, 13, 2, 2, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('AUTHORIZED CHANGES', left + 5, y + 1)
    y += 14
    pdf.setFontSize(10)
    changes.forEach((change, index) => {
      pdf.setFont('helvetica', 'bold')
      pdf.text(`${index + 1}. ${change.field}:`, left, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(change.value, 65, y)
      pdf.setTextColor(125, 133, 128)
      pdf.setFontSize(8)
      pdf.text(change.summary, 65, y + 4)
      pdf.setDrawColor(230, 234, 231)
      pdf.line(left, y + 8, 188, y + 8)
      pdf.setTextColor(41, 45, 50)
      pdf.setFontSize(10)
      y += 15
    })
    y = Math.max(y + 10, 190)
    pdf.setFont('helvetica', 'bold')
    pdf.text('C-LEVEL APPROVAL', left, y)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(105, 113, 108)
    pdf.text('By signing, the authority confirms that every change listed above is approved.', left, y + 7)
    pdf.setDrawColor(80, 87, 82)
    pdf.line(left, y + 27, 91, y + 27)
    pdf.line(117, y + 27, 188, y + 27)
    pdf.text('Signature', left, y + 33)
    pdf.text('Date', 117, y + 33)
    pdf.setTextColor(125, 133, 128)
    pdf.text(`Generated ${new Date().toLocaleString()} | Retain with the employee change request`, left, 282)
    pdf.save(`employee-change-permission-${selectedEmployee.id.replace(/[^a-z0-9_-]/gi, '-')}.pdf`)
    setGenerated(true)
  }

  return <section className="permission-page">
    <div className="page-heading"><div><div className="eyebrow">GOVERNANCE & APPROVALS</div><h1>Permission Generator</h1><p>Create a fixed-format PDF for C-level authorization of one or more employee changes.</p></div></div>
    <form className="permission-layout" onSubmit={generate}>
      <div className="permission-main">
        <section className="panel permission-section"><h2>Request details</h2><div className="form-grid permission-grid">
          <label className="employee-autocomplete">Employee ID<input required list="permission-employee-options" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setEmployeeIdTouched(false); setGenerated(false) }} onBlur={() => setEmployeeIdTouched(true)} placeholder={employees.isPending ? 'Loading employees…' : 'Start typing an employee ID'} aria-invalid={employeeError} aria-describedby={employeeError ? 'employee-id-error' : undefined} />
            <datalist id="permission-employee-options">{employees.data?.data.map((employee) => <option key={employee.id} value={employee.id}>{employee.first_name} {employee.last_name}</option>)}</datalist>
            {employeeError && <span className="field-error" id="employee-id-error">Select an employee ID from the list. The entered ID does not match an employee.</span>}
            {employees.isError && <span className="field-error">Employee IDs could not be loaded. Try refreshing the page.</span>}
          </label>
          <div className="employee-prefill-card" aria-live="polite"><span>Employee name<strong>{employeeName || 'Select an employee'}</strong></span><span>Current salary<strong>{selectedEmployee ? formatSalary(selectedEmployee.salary, selectedEmployee.currency) : '—'}</strong></span><span>Current role<strong>{selectedEmployee?.role || '—'}</strong></span></div>
          <label>Requested by<input required value={requestedBy} onChange={(event) => setRequestedBy(event.target.value)} placeholder="HR name or work email" /></label>
          <label>Approving authority<select value={authorityRole} onChange={(event) => setAuthorityRole(event.target.value)}>{C_LEVEL_ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
          <label className="field-full">C-level approver name<input required value={authorityName} onChange={(event) => setAuthorityName(event.target.value)} placeholder="Name recorded as Approved By" /></label>
          <label className="field-full">Business reason<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="One clear reason covering all requested permissions" /></label>
        </div></section>
        <section className="panel permission-section"><div className="permission-section-heading"><div><h2>Permissions requested</h2><p>Add every change that this authority should approve.</p></div><button type="button" className="button-secondary" onClick={add}><Icon name="plus" size={15} />Add permission</button></div>
          <div className="permission-list">{permissions.map((permission, index) => <div className="permission-row" key={permission.id}>
            <span className="permission-number">{index + 1}</span>
            <label>Permission<select value={permission.kind} onChange={(event) => update(permission.id, { kind: event.target.value as PermissionKind, value: '', field: event.target.value === 'status' ? 'status' : 'role' })}>
              <option value="detail">Details change</option><option value="increment">Salary increment</option><option value="decrement">Salary decrement</option><option value="status">Status / firing</option>
            </select></label>
            {permission.kind === 'detail' && <><label>Field<select value={permission.field} onChange={(event) => update(permission.id, { field: event.target.value })}>{DETAIL_FIELDS.map((field) => <option value={field} key={field}>{label(field)}</option>)}</select></label><label>New value<input required value={permission.value} onChange={(event) => update(permission.id, { value: event.target.value })} /></label></>}
            {(permission.kind === 'increment' || permission.kind === 'decrement') && <><label>Current salary<input readOnly value={selectedEmployee ? formatSalary(selectedEmployee.salary, selectedEmployee.currency) : 'Select an employee first'} /></label><label>{permission.kind === 'increment' ? 'Increase' : 'Decrease'} by<input required type="number" min="0.01" step="0.01" value={permission.amount} onChange={(event) => update(permission.id, { amount: event.target.value })} /></label></>}
            {permission.kind === 'status' && <label>Status<select required value={permission.value} onChange={(event) => update(permission.id, { value: event.target.value })}><option value="">Select status</option><option value="inactive">Inactive / fired</option><option value="on_leave">On leave</option><option value="active">Active</option></select></label>}
            {permissions.length > 1 && <button type="button" className="permission-remove" aria-label={`Remove permission ${index + 1}`} onClick={() => setPermissions((items) => items.filter((item) => item.id !== permission.id))}>×</button>}
          </div>)}</div>
          {duplicateFields.size > 0 && <p className="error">Only one permission per employee field is allowed: {[...duplicateFields].map(label).join(', ')}.</p>}
        </section>
      </div>
      <aside className="panel permission-summary"><div className="eyebrow">PDF PREVIEW</div><h2>{employeeName || 'Employee authorization'}</h2><p>{selectedEmployee ? `${selectedEmployee.id} · ${selectedEmployee.role} · ${formatSalary(selectedEmployee.salary, selectedEmployee.currency)}` : 'Select a valid employee ID'}</p><div className="permission-preview-list">{changes.map((change) => <div key={change.field}><strong>{label(change.field)}</strong><span>{change.value}</span></div>)}</div><button type="submit" disabled={!selectedEmployee || !changes.length || duplicateFields.size > 0}><Icon name="upload" size={16} />Generate permission PDF</button>{generated && <p className="permission-success">PDF generated. Obtain the authority’s signature before attaching it to a change request.</p>}</aside>
    </form>
  </section>
}
