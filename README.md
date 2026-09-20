# Acme Salary Dashboard

The dashboard combines a persistent sidebar, organization-wide summary cards,
salary totals by department, a team-status chart, and a compact employee table.
The `/employees` directory retains the full employee columns, while `/add`
supports file imports and manual entry. On small screens the sidebar becomes
a menu that can be dismissed with Escape or by selecting a destination.

Summary data comes from `GET /api/dashboard` in the salary service. Salary cards
and the department chart share a currency selector; values in different currencies
are never combined. Organization-wide summaries are independent of table filters
and pagination and refresh after a completed import. Loading, empty, and failed
summary requests have separate states.

Employee IDs in both tables link to `/employee/:id`. The employee details page
supports edits to personal information, employment status, department, role,
country, joining date, salary, and currency. HR provides their work email for
update attribution and reviews the exact before/after changes in an “Are you
sure?” dialog before any PATCH request is sent. Success and failure toasts report
the outcome; failed updates preserve the draft. Saving refreshes the employee,
directory, filter options, and dashboard summaries. Stale edits are rejected;
the page provides an explicit action to discard edits and reload the latest record.

The employee grid uses headless TanStack Table v9 and TanStack Virtual. Its
560px scroll viewport contains sticky headers and fixed-height, virtualized rows.
Dashboard rows are 62px; full-directory rows are 44px.
Column widths stay stable as rows enter and leave the viewport; long cell values
are truncated visually and available in the cell's title.

Sorting, filtering, and pagination are processed by the existing API, which caps
pages at 10,000 rows. Virtualization limits the rendered rows within the current
page. The stable feature configuration registers only sorting and pagination;
no client processing row models or function registries are necessary. Query and
Table share sorting/pagination atoms, while filters remain dashboard inputs.
No table state is persisted to the browser URL.

Run `npm run build` and `npm run lint` for static checks. Browser regression tests
use a mocked employee API, so no backend is required:

```sh
npx playwright install chromium
npm run test:e2e
```

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
