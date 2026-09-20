import { useState, type FormEvent } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { fetchFilterValues, uploadImportFile, uploadSingleEmployee } from '../api'
import ImportStatus from '../components/ImportStatus'

type Mode = 'file' | 'form'

export default function AddEmployee() {
  const [mode, setMode] = useState<Mode>('file')
  return (
    <section>
      <div className="page-heading"><div><div className="eyebrow">GROW YOUR TEAM</div><h1>Add Employees</h1><p>A new addition, or a whole team. Start here.</p></div></div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'file'} className={mode === 'file' ? 'active' : ''}
          onClick={() => setMode('file')}>Upload file</button>
        <button role="tab" aria-selected={mode === 'form'} className={mode === 'form' ? 'active' : ''}
          onClick={() => setMode('form')}>Add one manually</button>
      </div>
      {mode === 'file' ? <FileUpload /> : <SingleEmployeeForm />}
    </section>
  )
}

function FileUpload() {
  const [file, setFile] = useState<File | null>(null)
  const upload = useMutation({ mutationFn: uploadImportFile })
  return (
    <div className="panel">
      <p className="muted">
        Upload a .csv or .xls file (up to 10 MB, max 10,000 rows). The batch is processed in the
        background — its status appears below.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (file) upload.mutate(file)
        }}
      >
        <div className="upload-row">
          <input type="file" accept=".csv,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit" disabled={!file || upload.isPending}>
            {upload.isPending ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </form>
      {upload.isError && <p className="error">{(upload.error as Error).message}</p>}
      {upload.data && <ImportStatus importId={upload.data.id} />}
    </div>
  )
}

const FORM_FIELDS = [
  { name: 'id', label: 'Employee ID', placeholder: 'EMP-00123' },
  { name: 'first_name', label: 'First name', placeholder: 'Priya' },
  { name: 'last_name', label: 'Last name', placeholder: 'Sharma' },
  { name: 'email', label: 'Email', placeholder: 'priya.sharma@example.com', type: 'email' },
  { name: 'phone', label: 'Phone', placeholder: '+91 98765 43210' },
  { name: 'department', label: 'Department', placeholder: 'Engineering', datalist: 'department' },
  { name: 'role', label: 'Role', placeholder: 'Software Engineer', datalist: 'role' },
  { name: 'salary', label: 'Salary', placeholder: '75000.00', type: 'number' },
  { name: 'status', label: 'Status', placeholder: 'active', datalist: 'status' },
  { name: 'country', label: 'Country', placeholder: 'India', datalist: 'country' },
  { name: 'joining_date', label: 'Joining date', type: 'date' },
  { name: 'currency', label: 'Currency (ISO 4217)', placeholder: 'INR', datalist: 'currency' },
  { name: 'last_updated_by', label: 'Updated by', placeholder: 'hr.admin@example.com' },
] as const

type FormValues = Record<(typeof FORM_FIELDS)[number]['name'], string>
const emptyForm = Object.fromEntries(FORM_FIELDS.map((f) => [f.name, ''])) as FormValues

function SingleEmployeeForm() {
  const [values, setValues] = useState<FormValues>(emptyForm)
  const filterValues = useQuery({ queryKey: ['filter-values'], queryFn: fetchFilterValues })
  const submit = useMutation({
    mutationFn: (form: FormValues) =>
      uploadSingleEmployee({ ...form, last_updated_date: new Date().toISOString().slice(0, 10) }),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit.mutate(values)
  }

  return (
    <div className="panel">
      <p className="muted">
        The employee is submitted through the same validated import pipeline as file uploads;
        the result appears below the form.
      </p>
      <form onSubmit={onSubmit} className="employee-form">
        <div className="form-grid">
          {FORM_FIELDS.map((field) => (
            <label key={field.name}>
              {field.label}
              <input
                required
                name={field.name}
                type={'type' in field ? field.type : 'text'}
                placeholder={'placeholder' in field ? field.placeholder : undefined}
                list={'datalist' in field ? `list-${field.datalist}` : undefined}
                min={field.name === 'salary' ? 0 : undefined}
                step={field.name === 'salary' ? '0.01' : undefined}
                value={values[field.name]}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {(['department', 'role', 'status', 'country', 'currency'] as const).map((field) => (
          <datalist key={field} id={`list-${field}`}>
            {(filterValues.data?.filters[field] ?? []).map((value) => <option key={value} value={value} />)}
          </datalist>
        ))}
        <div className="form-actions">
          <button type="submit" disabled={submit.isPending}>
            {submit.isPending ? 'Submitting…' : 'Add employee'}
          </button>
          <button type="button" className="link" onClick={() => setValues(emptyForm)}>Reset</button>
        </div>
      </form>
      {submit.isError && <p className="error">{(submit.error as Error).message}</p>}
      {submit.data && <ImportStatus importId={submit.data.id} />}
    </div>
  )
}
