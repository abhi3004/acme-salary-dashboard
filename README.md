# Acme Salary Dashboard

The employee grid uses headless TanStack Table v9 and TanStack Virtual. Its
560px scroll viewport contains sticky headers and fixed-height, virtualized rows.
Column widths stay stable as rows enter and leave the viewport; long cell values
are truncated visually and available in the cell's title.

Sorting, filtering, and pagination are processed by the existing API, which caps
pages at 100 rows. Virtualization limits the rendered rows within the current
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
