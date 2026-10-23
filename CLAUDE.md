@AGENTS.md

## Project rules

- This is Next.js 16. Check node_modules/next/dist/docs before using any Next API.
- Demo mode (NEXT_PUBLIC_DEMO_MODE=true) must keep working with no keys. Every live feature needs a demo equivalent in lib/demo.js.
- Database changes go in a new numbered file in supabase/migrations/ (003_, 004_, ...), never by editing schema.sql. Each file starts with a comment saying what it does and that it runs after the previous number.
- The server API (app/api/*) owns all writes. Affiliates must never receive patient contact details, service type, insurance, uploaded documents or any procedure dollar amounts (gross, discount, operation cost, net).
- Placeholder content uses [square brackets], like the existing doctors. Never invent real-looking content.
- Add or update tests in tests/core.test.js for every rule you add. Run npm run lint, npm test and npm run build before finishing (GitHub runs the same three on every push; a red X on a commit means it must not be merged). Tests for server code must run it (see the gift card server test), not only read its source. Update the README sitemap and feature list when pages change.
- Commit at the end of each stage with a clear message.
