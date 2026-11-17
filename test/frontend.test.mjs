import { test } from 'node:test';
import assert from 'node:assert/strict';

// app-logic.js is a UMD module: in Node it resolves to module.exports.
import logic from '../public/app-logic.js';

const { buildBookRow, renderList, escapeHtml, statusLabel, bookFromResponse } = logic;

const unreadBook = {
  id: 'b1',
  title: 'The Pragmatic Programmer',
  author: 'Andrew Hunt',
  status: 'unread',
  addedAt: '2026-11-15T20:00:00.000Z'
};

const readBook = {
  id: 'b2',
  title: 'Clean Code',
  author: 'Robert C. Martin',
  status: 'read',
  addedAt: '2026-11-15T20:00:00.000Z'
};

test('buildBookRow returns an <li> row with title, author, status, toggle and delete buttons', () => {
  const row = buildBookRow(unreadBook);

  assert.match(row, /^<li\b/);
  assert.match(row, /<\/li>$/);
  assert.match(row, /class="book-row unread"/);
  assert.match(row, /data-id="b1"/);
  assert.match(row, /class="book-title"[^>]*>The Pragmatic Programmer</);
  assert.match(row, /class="book-author"[^>]*>Andrew Hunt</);
  assert.match(row, /class="book-status"[^>]*>Unread</);
  assert.match(row, /class="toggle-btn"/);
  assert.match(row, /data-action="toggle"/);
  assert.match(row, /data-next-status="read"/);
  assert.match(row, />Mark read</);
  assert.match(row, /class="delete-btn"/);
  assert.match(row, /data-action="delete"/);
  assert.match(row, />Delete</);
});

test('buildBookRow reflects read status and offers toggling back to unread', () => {
  const row = buildBookRow(readBook);

  assert.match(row, /class="book-row read"/);
  assert.match(row, /data-status="read"/);
  assert.match(row, /class="book-status"[^>]*>Read</);
  assert.match(row, /data-next-status="unread"/);
  assert.match(row, />Mark unread</);
});

test('buildBookRow escapes HTML in book fields', () => {
  const row = buildBookRow({
    id: 'x<1>',
    title: '<script>alert("pwn")</script>',
    author: "O'Brien & Sons",
    status: 'unread'
  });

  assert.ok(!row.includes('<script>alert'));
  assert.match(row, /&lt;script&gt;alert\(&quot;pwn&quot;\)&lt;\/script&gt;/);
  assert.match(row, /O&#39;Brien &amp; Sons/);
  assert.match(row, /data-id="x&lt;1&gt;"/);
});

test('renderList renders one row per book into the container', () => {
  const container = { innerHTML: '' };
  const html = renderList([unreadBook, readBook], container);

  const rows = html.match(/<li class="book-row/g) || [];
  assert.equal(rows.length, 2);
  assert.equal(container.innerHTML, html);
  assert.ok(container.innerHTML.includes('The Pragmatic Programmer'));
  assert.ok(container.innerHTML.includes('Clean Code'));
});

test('renderList with an empty list shows an empty-state message', () => {
  const container = { innerHTML: 'stale' };
  const html = renderList([], container);

  assert.match(html, /class="empty-state"/);
  assert.match(html, /No books yet/);
  assert.equal(container.innerHTML, html);
});

test('renderList tolerates a missing or non-array books argument', () => {
  const container = { innerHTML: '' };
  const html = renderList(null, container);

  assert.match(html, /class="empty-state"/);
  assert.equal(container.innerHTML, html);
});

test('renderList returns the HTML even when no container is given', () => {
  const html = renderList([unreadBook], null);
  assert.match(html, /data-id="b1"/);
});

test('statusLabel maps statuses to human-readable labels', () => {
  assert.equal(statusLabel('read'), 'Read');
  assert.equal(statusLabel('unread'), 'Unread');
  assert.equal(statusLabel('bogus'), 'Unread');
});

test('escapeHtml neutralises markup-significant characters', () => {
  assert.equal(escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
});

test('bookFromResponse unwraps the contract\'s { book: {...} } response shape', () => {
  // Exact shape T-1's server returns for POST 201 and PATCH 200.
  const wrapped = { book: { ...unreadBook } };
  const unwrapped = bookFromResponse(wrapped);

  assert.deepEqual(unwrapped, unreadBook);
  assert.notEqual(unwrapped, wrapped);
  // Regression guard: a wrapped response rendered directly produced
  // data-id="undefined" and broke toggle/delete.
  const row = buildBookRow(unwrapped);
  assert.match(row, /data-id="b1"/);
  assert.match(row, /class="book-title"[^>]*>The Pragmatic Programmer</);
});

test('bookFromResponse passes through bare book objects unchanged', () => {
  assert.deepEqual(bookFromResponse({ ...readBook }), readBook);
});

test('bookFromResponse tolerates null/undefined data', () => {
  assert.equal(bookFromResponse(null), null);
  assert.equal(bookFromResponse(undefined), undefined);
});

test('bookFromResponse does not treat a GET list array as a wrapper', () => {
  const list = [unreadBook, readBook];
  assert.deepEqual(bookFromResponse(list), list);
});

const { normalizeFilter, buildBooksUrl, renderFilterBar } = logic;

test('normalizeFilter accepts valid filters and falls back to "all"', () => {
  assert.equal(normalizeFilter('all'), 'all');
  assert.equal(normalizeFilter('unread'), 'unread');
  assert.equal(normalizeFilter('read'), 'read');
  assert.equal(normalizeFilter('bogus'), 'all');
  assert.equal(normalizeFilter(undefined), 'all');
  assert.equal(normalizeFilter(''), 'all');
});

test('buildBooksUrl appends ?status= for unread/read and none for all', () => {
  assert.equal(buildBooksUrl('/api/books', 'all'), '/api/books');
  assert.equal(buildBooksUrl('/api/books', 'unread'), '/api/books?status=unread');
  assert.equal(buildBooksUrl('/api/books', 'read'), '/api/books?status=read');
  // Unknown filters normalize to 'all' → no query param.
  assert.equal(buildBooksUrl('/api/books', 'bogus'), '/api/books');
});

test('renderFilterBar renders All/Unread/Read buttons with data-filter attrs', () => {
  const html = renderFilterBar('all');

  assert.match(html, /class="filter-btn active"[^>]*data-filter="all"[^>]*>All</);
  assert.match(html, /class="filter-btn"[^>]*data-filter="unread"[^>]*>Unread</);
  assert.match(html, /class="filter-btn"[^>]*data-filter="read"[^>]*>Read</);
  const buttons = html.match(/<button type="button" class="filter-btn/g) || [];
  assert.equal(buttons.length, 3);
});

test('renderFilterBar marks only the active filter with .active and aria-pressed', () => {
  const html = renderFilterBar('unread');

  // Exactly one active button, and it is the unread one.
  const active = html.match(/class="filter-btn active"/g) || [];
  assert.equal(active.length, 1);
  assert.match(html, /class="filter-btn active"[^>]*data-filter="unread"/);
  assert.match(html, /data-filter="unread"[^>]*aria-pressed="true"/);
  assert.match(html, /data-filter="all"[^>]*aria-pressed="false"/);
  assert.match(html, /data-filter="read"[^>]*aria-pressed="false"/);

  // Moving the active filter moves the indicator.
  const readActive = renderFilterBar('read');
  assert.match(readActive, /class="filter-btn active"[^>]*data-filter="read"/);
  assert.ok(!readActive.includes('data-filter="unread" aria-pressed="true"'));
});

test('renderFilterBar writes into a container and tolerates unknown filters', () => {
  const container = { innerHTML: '' };
  const html = renderFilterBar('nonsense', container);
  assert.equal(container.innerHTML, html);
  // Unknown → 'all' is active by default.
  assert.match(html, /class="filter-btn active"[^>]*data-filter="all"/);
});

test('renderList uses the caller-supplied empty message when a filter is active', () => {
  const container = { innerHTML: '' };
  const html = renderList([], container, 'No unread books.');
  assert.match(html, /class="empty-state"/);
  assert.match(html, /No unread books\./);
  assert.ok(!html.includes('No books yet'));
  // Default message unchanged when none is supplied.
  assert.match(renderList([], container), /No books yet\. Add one above!/);
});
