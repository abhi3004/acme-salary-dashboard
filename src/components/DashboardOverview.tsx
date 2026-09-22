import type { CSSProperties } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { DashboardSummary } from '../types'
import Icon, { type IconName } from './Icon'

const number = (value: number) => value.toLocaleString('en-US')
const money = (value: number, currency: string, compact = false) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency, maximumFractionDigits: compact ? 1 : 0,
  notation: compact ? 'compact' : 'standard',
}).format(value)
const statusLabel = (value: string) => value.replace(/[_-]/g, ' ').replace(/^./, (char) => char.toUpperCase())
const STATUS_COLORS = ['#438b81', '#ff725e', '#ecc576', '#89aecb', '#a79abc', '#aaa99e']

function MetricCard({ label, value, note, icon, tone, loading, denominator }: {
  label: string; value: string; note: string; icon: IconName; tone: string; loading: boolean; denominator?: string
}) {
  return <article className={`metric-card metric-${tone}`} aria-label={label} aria-busy={loading}>
    <div className="metric-main"><span className="metric-icon"><Icon name={icon} size={22} /></span>
      <div className="metric-copy"><strong className={loading ? 'metric-skeleton' : denominator ? 'metric-with-denominator' : undefined} title={denominator ? `${value} / ${denominator}` : value}>
        {value}{denominator && <span className="metric-denominator"> / {denominator}</span>}</strong><h2>{label}</h2></div>
    </div>
    <p className="metric-note">{note}</p>
  </article>
}

function DepartmentChart({ summary, currency }: { summary: DashboardSummary; currency: string }) {
  const departments = summary.compensation.departments
  const entries = departments.slice(0, 5)
  if (departments.length > 5) entries.push({
    department: 'Other departments',
    employees: departments.slice(5).reduce((sum, entry) => sum + entry.employees, 0),
    total: departments.slice(5).reduce((sum, entry) => sum + entry.total, 0),
  })
  const max = Math.max(...entries.map((entry) => entry.total), 1)
  const ceiling = Math.ceil(max / 10 ** Math.floor(Math.log10(max))) * 10 ** Math.floor(Math.log10(max))

  if (!entries.length) return <div className="chart-empty"><Icon name="chart" size={30} /><strong>Your salary overview starts here</strong><span>Add employees to see salaries by department.</span><Link to="/add">Add employees <Icon name="arrow" size={15} /></Link></div>

  return <div className="salary-chart" aria-label={`Salary totals by department in ${currency}`} role="figure">
    <div className="chart-scale" aria-hidden="true">{[1, .75, .5, .25, 0].map((ratio) => <span key={ratio}>{money(ceiling * ratio, currency, true)}</span>)}</div>
    <div className="chart-columns" role="list">
      {entries.map((entry) => <div className="chart-column" key={entry.department} role="listitem"
        aria-label={`${entry.department}: ${money(entry.total, currency)}, ${entry.employees} employees`}>
        <div className="chart-bar-track"><div className="chart-bar" style={{ height: `${entry.total / ceiling * 100}%` }}
          title={`${entry.department}: ${money(entry.total, currency)}`}><span>{money(entry.total, currency, true)}</span></div></div>
        <span className="chart-column-label" title={entry.department}>{entry.department}</span>
      </div>)}
    </div>
  </div>
}

function TeamOverview({ summary }: { summary: DashboardSummary }) {
  let offset = 0
  const gradient = summary.statuses.map((entry, index) => {
    const start = offset
    offset += entry.employees / summary.employees * 100
    return `${STATUS_COLORS[index % STATUS_COLORS.length]} ${start}% ${offset}%`
  }).join(', ')

  return <div className="team-chart">
    <div className="team-donut" style={{ '--donut-fill': summary.employees ? `conic-gradient(${gradient})` : '#eef1ee' } as CSSProperties}
      role="img" aria-label={summary.employees ? summary.statuses.map((entry) => `${statusLabel(entry.status)}: ${entry.employees}`).join(', ') : 'No employees yet'}>
      <div><strong>{number(summary.employees)}</strong><span>Total employees</span></div>
    </div>
    <ul className="status-legend">{summary.statuses.map((entry, index) => <li key={entry.status}>
      <span className="legend-label"><i style={{ background: STATUS_COLORS[index % STATUS_COLORS.length] }} /><span title={statusLabel(entry.status)}>{statusLabel(entry.status)}</span></span>
      <strong>{number(entry.employees)}</strong>
    </li>)}</ul>
    {!summary.employees && <p className="muted empty-team">Your team will appear here.</p>}
  </div>
}

export default function DashboardOverview({ summary }: { summary: UseQueryResult<DashboardSummary, Error> }) {
  const data = summary.data
  const salary = data?.compensation
  const currency = salary?.currency ?? ''
  const loading = summary.isPending
  const unavailable = loading ? 'Loading overview…' : 'Overview unavailable'
  const scope = data?.country ?? 'Global'
  const hasSalary = !!data?.employees && salary?.total !== null && salary?.average !== null && !!currency
  const estimated = salary?.approximate
  const salaryNote = !data ? unavailable : !data.employees ? 'No salary records yet'
    : hasSalary ? `${scope} · ${currency}${estimated ? ' · Approximate' : ''}` : 'Salary conversion unavailable'
  const compensationUnavailable = !!data?.employees && !hasSalary

  return <>
    {summary.isError && <div className="overview-error" role="status"><span>Couldn’t load the dashboard summary. Your employee list is still available below.</span><button className="link" onClick={() => summary.refetch()}>Try again</button></div>}
    <div className="metric-grid">
      <MetricCard label="Total employees" value={data ? number(data.employees) : '—'} icon="people" tone="green" loading={loading}
        denominator={data?.country ? number(data.organization.employees) : undefined}
        note={data ? data.country ? `In ${data.country} / organization total` : `Across ${number(data.countries)} ${data.countries === 1 ? 'country' : 'countries'}` : unavailable} />
      <MetricCard label="Average salary" value={hasSalary ? `${estimated ? '≈ ' : ''}${money(salary!.average!, currency)}` : '—'} icon="wallet" tone="pink" loading={loading}
        note={salaryNote} />
      <MetricCard label="Total salaries" value={hasSalary ? `${estimated ? '≈ ' : ''}${money(salary!.total!, currency, salary!.total! >= 10000000)}` : '—'} icon="chart" tone="blue" loading={loading}
        note={salaryNote} />
      <MetricCard label="Departments" value={data ? number(data.departments) : '—'} icon="building" tone="yellow" loading={loading}
        note={data ? data.country ? `Teams in ${data.country}` : 'Teams across your organization' : unavailable} />
    </div>
    <div className="overview-grid">
      <section className="overview-panel salary-panel" aria-labelledby="salary-heading">
        <div className="panel-heading"><div><h2 id="salary-heading">Salary overview</h2><p>{scope} · Current salaries by department{currency && ` · ${currency}`}</p></div>
          <Icon name="chart" size={19} />
        </div>
        {compensationUnavailable ? <div className="chart-empty" role="status"><Icon name="chart" size={30} /><strong>Salary conversion unavailable</strong>
          <span>{currency ? `No reference rate for ${salary!.unavailable_currencies.join(', ')}. Totals are hidden to avoid an incomplete estimate.`
            : 'A reporting currency could not be determined for this country.'}</span></div>
          : data ? <DepartmentChart summary={data} currency={currency} /> : <div className={`chart-empty${loading ? ' chart-loading' : ''}`}><Icon name="chart" size={30} /><span>{unavailable}</span></div>}
        <div className="panel-footnote"><span className="legend-dot" />{estimated ? 'Approximate salary totals' : 'Recorded salary totals'}{currency && ` · ${currency}`}<span>{scope}</span></div>
      </section>
      <section className="overview-panel team-panel" aria-labelledby="team-heading">
        <div className="panel-heading"><div><h2 id="team-heading">Team overview</h2><p>{scope} · Employee status</p></div><Icon name="people" size={19} /></div>
        {data ? <TeamOverview summary={data} /> : <div className={`chart-empty${loading ? ' chart-loading' : ''}`}><Icon name="people" size={30} /><span>{unavailable}</span></div>}
        <Link className="panel-footer-link" to="/employees">View all employees <Icon name="arrow" size={16} /></Link>
      </section>
    </div>
    {data && estimated && data.employees > 0 && <p className="exchange-rate-note">Estimates use fixed {salary!.exchange_rates.source} reference rates from {salary!.exchange_rates.date}; not live rates. Employee salary records remain in their original currencies.</p>}
  </>
}
