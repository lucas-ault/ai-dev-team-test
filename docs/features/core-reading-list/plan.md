# Feature Plan: core-reading-list — v1 — APPROVED
Project: ai-dev-team-test | Branch: feature/core-reading-list | Base: main@6b0b63c3879161f419eaa5280a90e763d4ee145a
## Stack: Node 22 + Express, vanilla HTML/JS frontend, JSON file persistence (data/books.json, atomic write), node --test
## API contract: GET /api/books?status=, POST /api/books, PATCH /api/books/:id, DELETE /api/books/:id
## Book: {id, title, author, status: "unread"|"read", addedAt}
## Cards: T-1 backend (US-1,2,4) ∥ T-2 frontend (US-1,2) → M-1 integrate → T-3 filter (US-3, downstream)
## Shared files: package.json→T-1, public/→T-2, .gitignore→T-1, src/→T-1
