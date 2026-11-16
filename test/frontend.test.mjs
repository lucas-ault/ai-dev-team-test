import { test } from 'node:test';
import assert from 'node:assert/strict';

// app-logic.js is a UMD module: in Node it resolves to module.exports.
import logic from '../public/app-logic.js';

const { buildBookRow, renderList, escapeHtml, statusLabel } = logic;

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
