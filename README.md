# Unison

**Many teams. One voice.**

**Live demo:** https://ayushi-unison.vercel.app

Unison is a template management product for organizations where many internal teams talk to the same people. A contributor is recruited by Sourcing, prepared by Enablement, reviewed by Quality, and paid by Payments. Each team writes its own messages in its own tools, so tone, branding, and required information drift. Unison gives every team one shared library of templates and reusable partials, with required-partial rules that keep every message consistent.

This is a portfolio product by Ayushi Gupta, built with Claude Code. Meridian Works is a fictional company, and all data is sample data.

## What's in the demo

- **Library**: every template across teams, with owner, type, project, and status.
- **Partials**: shared headers, footers, and content blocks, edited once and reused everywhere.
- **Required partials**: rules such as "every Payments message includes the payout-support block," applied globally or per team.
- **Projects**: templates scoped to the work programs contributors join.
- **Roles**: admin, editor, and viewer, chosen on the demo entry page.

## For reviewers

- Open the app with `?states=1` (for example `/templates?states=1`) to preview loading, error, and empty states. `?states=0` hides the switcher again.
- Changes are saved in your browser. Use **Reset demo** in the banner to restore the sample data.

## Run locally

```bash
npm install
npm run dev
```

## Configuration

Author credit and the case-study link live in `src/config/portfolio.ts`. The case-study link stays hidden until `CASE_STUDY_URL` is set.

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7. Icons by [Lucide](https://lucide.dev); type set in [Geist](https://vercel.com/font).
