# Acme Salary Dashboard

The frontend for the Acme salary management workspace. It gives HR teams one
place to view employees, salaries, payroll, imports, approvals, users, and audit
activity. The application is permission-aware and talks to the backend through
same-origin `/api` requests.

## A. Run the project and set up the environment

### Requirements

- Node.js 22.13 or newer (Node.js 24 is recommended)
- npm
- The backend API running on `http://localhost:3000`
- Redis and the backend import worker if you want to upload employee files

Install and start the frontend:

```sh
npm install
npm run dev
```

Vite prints the local URL, normally `http://localhost:5173`.

For the full local system, go to the parent `Salary-Management-Software`
directory and run:

```sh
npm run dev
```

That command starts the frontend, backend, and import worker together. Redis
must already be running.

### Environment setup

The browser always calls `/api`. Vite forwards those requests to the target in
the selected environment file:

```dotenv
# .env.development
API_PROXY_TARGET=http://localhost:3000
```

Use `.env.development.local` for a personal local override. To use the deployed
API while running the frontend locally:

```sh
npm run dev -- --mode production
```

Do not put passwords, tokens, or other secrets in a Vite environment variable.
Values exposed with a `VITE_` prefix are shipped to the browser. A production
static host must also proxy `/api/*` to the backend so authentication cookies
stay on the same site. The included `vercel.json` provides this rewrite for the
current Vercel deployment.

## B. Tech stack

- React 19 and TypeScript
- Vite 8 for development and production builds
- React Router for page routing
- TanStack Query for server data and caching
- TanStack Table and TanStack Virtual for large employee lists
- jsPDF for client-side PDF work
- Plain CSS with responsive layouts
- Playwright for browser tests
- Oxlint for linting

## C. Credentials

The frontend does not keep its own credentials. Sign in with an account created
by the backend.

For a new local backend, the example administrator is:

```text
Email: admin@acme.test
Password: ChangeMe123!
```

These are development defaults only. Change `ADMIN_EMAIL` and
`ADMIN_PASSWORD` in the backend `.env` before sharing or deploying the app.
The password must contain at least 12 characters. Never commit a real password.

## D. Authentication setup

The login form sends the email and password to the backend. After a successful
login, the backend sets an HTTP-only `acme_session` cookie that lasts for 12
hours. The cookie uses `SameSite=Strict` and is marked `Secure` in production.

The frontend uses the current user's permissions to show relevant navigation and
pages. The backend still checks every protected API request; hiding a frontend
button is not a security boundary.

Administrators can create users from the **Users** page. An invitation is valid
for seven days and lets the invited user choose a password. There is currently no
email delivery, password-reset flow, SSO, or self-service registration.

## E. Main functions and purpose

- Dashboard totals, employee counts, department charts, and status summaries
- Global or country-level salary reporting
- Searchable, sortable, virtualized employee directory
- Employee profile, status, salary, and payroll history views
- CSV or XLS employee imports with progress reporting
- Salary and profile change requests with PDF proof
- Payroll periods, adjustments, approvals, and payment history
- User invitations and permission-based access
- Read-only notifications and audit activity
- Responsive navigation for desktop, tablet, and mobile screens

Currency conversion uses a fixed backend exchange-rate snapshot for reporting.
It is an estimate and must not be used to settle payroll.

## F. AI skills used

The following Codex skills were installed as development guidance:

- `javascript-testing-patterns` — unit and integration test practices
- `e2e-testing-patterns` — reliable Playwright tests
- `web-design-guidelines` — accessibility and interface reviews
- `responsive-design` — mobile and responsive layout guidance
- `security-best-practices` — React and Express security reviews

These skills are not runtime dependencies and their presence does not mean the
application has passed an accessibility or security audit. Installation sources,
pinned revisions, and the usage record are in
[`docs/AI_SKILLS.md`](docs/AI_SKILLS.md).

## G. Tests and simple CI/CD

Run the local checks:

```sh
npm run test:config
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright suite mocks the employee API, so it does not require a running
backend. The configuration tests verify proxy mode loading and URL validation.

There is no GitHub Actions workflow checked in today. A simple CI job should run
on pull requests and execute these steps:

1. Check out the repository.
2. Set up Node.js 24 with npm caching.
3. Run `npm ci`.
4. Run `npm run test:config`, `npm run lint`, and `npm run build`.
5. Install Playwright Chromium and run `npm run test:e2e`.

For delivery, connect the frontend repository to Vercel and use `npm run build`
with `dist` as the output directory. Deploy only after CI passes. Keep the
`/api/*` rewrite pointed at the matching backend environment and verify login
after deployment.
