# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Environment

Create a `.env.local` in the project root with:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_MAPTILER_KEY=your_maptiler_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # used by the local Express server only
VITE_API_BASE=http://localhost:4000

Alternatively, you can use NEXT_PUBLIC_* variable names. The app and server read both:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
API_BASE_URL=http://10.0.2.2:8080/api
```
```

Without these, the app runs in demo mode (no realtime, CSS map fallback).

## Database Setup

Apply the SQL migration pack `db/000_dashboard.sql` in your Supabase SQL editor (or via CLI). It enables PostGIS, creates enums, fixes FKs, adds geography columns, timestamp triggers, helpers/role checks, RLS policies, and views (`vw_users`, `vw_alerts_extended`, `vw_reports_extended`).

Also run `db/storage.policies.sql` to create buckets and basic storage policies.

## Local API Server

Start the local privileged API (requires `SUPABASE_SERVICE_ROLE_KEY`):

```
npm run server
```

Use in the browser via `VITE_API_BASE` (defaults to `http://localhost:4000`).

## Realtime

When `VITE_SUPABASE_*` are set, the app subscribes to `public.reports` and `public.alerts` and bridges changes into the in-memory/localStorage `dataBus` used by the pages.

## Maps

If `VITE_MAPTILER_KEY` is set, the Map page renders MapLibre with MapTiler styles; otherwise it falls back to the existing CSS-based pins.
