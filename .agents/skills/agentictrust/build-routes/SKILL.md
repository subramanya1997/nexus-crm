---
name: build-routes
description: >-
  Explores a web application's codebase, documentation, or live site to discover
  all navigable routes and produce a routes.csv file for Agentic Trust navigation.
  Use when the user asks to build, generate, create, or update a routes.csv, route
  map, sitemap, or navigation inventory for a client application.
---

# Build routes.csv

Generate a `routes.csv` for a client application by exploring its documentation,
source code, or live UI. The CSV is uploaded to Agentic Trust's Navigation feature
so the agent can direct users to the right pages.

## Output format

```
name,path,description,parameters
dashboard_home,/dashboard,Main dashboard overview,
user_detail,/users/:userId,Individual user profile,userId:string
```

| Column | Rules |
|--------|-------|
| `name` | snake_case, unique, descriptive (e.g. `settings_general`, `test_case_detail`) |
| `path` | URL path with `:param` placeholders for dynamic segments |
| `description` | One-line plain-English summary of what the page shows or does |
| `parameters` | Semi-colon-separated `paramName:type` pairs; empty if no dynamic segments |

- Header row is always `name,path,description,parameters`
- No quoting unless a field contains a comma
- No trailing blank line
- Group related routes together (e.g. all dashboard_* routes, then all settings_*)

## Discovery workflow

### Step 1 — Locate the client folder

Look for `clients/<ClientName>/` in the workspace. If it doesn't exist yet, ask the
user for the client name and create the folder.

### Step 2 — Gather route sources (use all that apply)

Sources are listed from highest to lowest signal. Use every source you can find;
cross-reference them against each other to build the most complete list.

#### A. Documentation file (`docs.md`)

Read `clients/<ClientName>/docs.md`. Scan for:
- Navigation sections, sidebar menus, and breadcrumb references
- URL patterns (`/dashboard`, `/settings/...`, `/td/:workspaceId/cases`)
- Page descriptions in feature overviews
- Any "Routes", "Pages", "Navigation", or "Sitemap" headings

#### B. Workflow files (`workflows/*.md`)

Read every workflow markdown in `clients/<ClientName>/workflows/`. Each workflow
typically references one or more routes in its steps (e.g. "Navigate to `/td/:workspaceId/plans`").
Extract every route mentioned and merge them into your list.

#### C. Source code (if available)

Search the workspace for the client's frontend source:
- **Next.js / App Router**: `app/**/page.tsx` files — each directory maps to a route
- **React Router**: grep for `<Route path=`, `createBrowserRouter`, route config arrays
- **Vue Router**: grep for `routes:` arrays in router config files
- **Angular**: grep for `RouterModule.forRoot`, `Routes` type arrays
- **Generic**: grep for URL path patterns across the codebase

#### D. Live browser exploration (if the app is running)

If the user provides a URL or the app is running locally:
1. Navigate to the app's root
2. Take a snapshot and identify navigation elements (sidebar, navbar, tabs, menus)
3. Click through each navigation item, recording the resulting URL path
4. Look for sub-navigation, tabs, and settings pages
5. Record dynamic-segment patterns (IDs in URLs become `:paramName` placeholders)

#### E. Existing routes.csv

If a `routes.csv` already exists, read it as a baseline. Preserve existing entries
unless they are clearly stale, and append newly discovered routes.

### Step 3 — Deduplicate and organize

1. Merge routes from all sources
2. Remove exact duplicates (same path)
3. For near-duplicates (same page, slightly different paths), keep the canonical one
4. Sort routes into logical groups:
   - Top-level / dashboard pages first
   - Feature area pages next (test cases, plans, suites, etc.)
   - Settings / admin pages last
5. Assign a unique `name` to each route following snake_case naming

### Step 4 — Write the CSV

Write the final CSV to `clients/<ClientName>/routes.csv`.

### Step 5 — Validate

After writing, re-read the file and verify:
- [ ] Header is exactly `name,path,description,parameters`
- [ ] Every `name` is unique
- [ ] Every `path` starts with `/`
- [ ] Dynamic segments use `:paramName` syntax
- [ ] Parameters column matches the `:param` placeholders in the path
- [ ] No blank lines in the middle of the file

Report the total route count and any issues found.

## Reference examples

See these existing routes.csv files for format conventions:
- `clients/ContextQA/routes.csv` — medium-complexity SPA
- `clients/auth0/routes.csv` — large enterprise dashboard with nested routes

## Tips

- Prefer breadth over depth — capture every navigable page, including sub-tabs and
  modals that have their own URL.
- When in doubt about a parameter type, default to `string`.
- If the app uses hash routing (`/#/path`), strip the `#` and record just the path portion.
- For apps with role-gated pages, include all pages regardless of role; add a note in
  the description (e.g. "Admin-only user management").
