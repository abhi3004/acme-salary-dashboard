import { useQuery } from '@tanstack/react-query'
import { fetchEmployeePayroll } from '../api'
import type { EmployeePayrollEntry } from '../types'
import Icon from './Icon'

const money = (value: number, currency: string) => value.toLocaleString('en-US', { style: 'currency', currency })
const date = (value: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
const status = (value: string) => value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase())

function Upcoming({ payroll }: { payroll: EmployeePayrollEntry }) {
  return <section className="panel payroll-card payroll-upcoming"><div className="payroll-card-heading"><span><Icon name="calendar" /></span><div><div className="eyebrow">UPCOMING SALARY</div><h2>{payroll.period_name}</h2></div></div>
    <strong className="payroll-total">{money(payroll.net_payable, payroll.currency)}</strong><span className="payroll-due">Due {date(payroll.payment_due_date)} · {status(payroll.period_status)}</span>
    <dl className="payroll-breakdown"><div><dt>Salary snapshot</dt><dd>{money(payroll.salary_snapshot, payroll.currency)}</dd></div><div><dt>Additions</dt><dd>+{money(payroll.additions, payroll.currency)}</dd></div><div><dt>Deductions</dt><dd>-{money(payroll.deductions, payroll.currency)}</dd></div>{payroll.carried_forward !== 0 && <div><dt>Carried forward</dt><dd>{money(payroll.carried_forward, payroll.currency)}</dd></div>}</dl>
  </section>
}

export default function PayrollOverview({ employeeId }: { employeeId: string }) {
  const payroll = useQuery({ queryKey: ['employee-payroll', employeeId], queryFn: ({ signal }) => fetchEmployeePayroll(employeeId, signal) })
  if (payroll.isPending) return <section className="panel payroll-loading" role="status">Loading payroll history…</section>
  if (payroll.isError) return <section className="panel payroll-loading error" role="alert">Payroll data could not be loaded.</section>
  const upcoming = payroll.data.upcoming ?? payroll.data.projection
  return <section className="employee-payroll-section" aria-labelledby="employee-payroll-heading">
    <div className="section-title"><div><div className="eyebrow">PAYROLL LEDGER</div><h2 id="employee-payroll-heading">Salary disbursements</h2><p>Historical payments, the next expected salary, and overdue balances.</p></div></div>
    <div className="payroll-overview-grid">
      {upcoming && <Upcoming payroll={upcoming} />}
      <section className="panel payroll-card"><div className="payroll-card-heading"><span><Icon name="wallet" /></span><div><div className="eyebrow">OUTSTANDING</div><h2>Amount still due</h2></div></div>
        {payroll.data.outstanding.by_currency.length ? <div className="outstanding-totals">{payroll.data.outstanding.by_currency.map((entry) => <strong key={entry.currency}>{money(entry.amount, entry.currency)}</strong>)}</div> : <strong className="payroll-total payroll-clear">Nothing overdue</strong>}
        <span className="payroll-due">{payroll.data.outstanding.periods.length} overdue payroll period{payroll.data.outstanding.periods.length === 1 ? '' : 's'}</span>
      </section>
    </div>
    <section className="panel payroll-history"><div className="payroll-history-heading"><div><h2>Previous salary disbursements</h2><p>Salary values are historical snapshots and do not change with the current employee salary.</p></div></div>
      {payroll.data.previous.length ? <div className="payroll-table-scroll"><table><thead><tr><th>Period</th><th>Due date</th><th>Net payable</th><th>Paid</th><th>Outstanding</th><th>Status</th></tr></thead><tbody>{payroll.data.previous.map((entry) => <tr key={entry.id ?? `${entry.period_name}-${entry.payment_due_date}`}><td><strong>{entry.period_name}</strong><span>{money(entry.salary_snapshot, entry.currency)} snapshot</span></td><td>{date(entry.payment_due_date)}</td><td>{money(entry.net_payable, entry.currency)}</td><td>{money(entry.amount_paid, entry.currency)}</td><td>{money(entry.outstanding_amount, entry.currency)}</td><td><span className={`payroll-status status-${entry.status}`}>{status(entry.status)}</span></td></tr>)}</tbody></table></div>
        : <div className="payroll-empty"><Icon name="calendar" size={28} /><strong>No previous payroll records</strong><span>Completed salary periods will appear here.</span></div>}
    </section>
  </section>
}
