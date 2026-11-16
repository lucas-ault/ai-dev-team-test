'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Store } = require('../src/store');
const { createBooksRouter } = require('../src/routes');

// Minimal harness: real Express router driven through fetch via a local server.
const express = require('express');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'books-api-'));
}

async function withServer(fn) {
  const dataDir = makeTmpDir();
  const app = express();
  app.use(express.json());
  const store = new Store(dataDir);
  store.load();
  app.use('/api', createBooksRouter(store));
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    await fn(base, store, dataDir);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function post(base, body) {
  const res = await fetch(`${base}/books`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, body: res.status === 204 ? null : await res.json().catch(() => null) };
}

test('POST valid book → 201 with unread book; nothing extra persisted on invalid', async () => {
  await withServer(async (base, store, dataDir) => {
    const { res, body } = await post(base, { title: 'Dune', author: 'Frank Herbert' });
    assert.equal(res.status, 201);
    assert.equal(body.book.title, 'Dune');
    assert.equal(body.book.status, 'unread');
    assert.match(body.book.id, /^[0-9a-f]{12}$/);

    // invalid POSTs are rejected and do not persist anything
    for (const bad of [{ title: '', author: 'X' }, { title: 'X' }, { author: 'Y' }, { title: '   ', author: 'Y' }]) {
      const r = await post(base, bad);
      assert.equal(r.res.status, 400);
      assert.ok(r.body.error, '400 response carries an error message');
    }
    const onDisk = JSON.parse(fs.readFileSync(path.join(dataDir, 'books.json'), 'utf8'));
    assert.equal(onDisk.length, 1);
    assert.equal(store.list().length, 1);
  });
});

test('GET /books returns all; ?status=unread|read filters; unknown → all', async () => {
  await withServer(async (base) => {
    await post(base, { title: 'Read Book', author: 'A' });
    await post(base, { title: 'Unread Book', author: 'B' });

    let res = await fetch(`${base}/books`);
    assert.equal(res.status, 200);
    let all = await res.json();
    assert.equal(all.length, 2);
    assert.ok(Array.isArray(all));

    const read = all.find((b) => b.title === 'Read Book');
    const patchRes = await fetch(`${base}/books/${read.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    });
    assert.equal(patchRes.status, 200);
    const patched = (await patchRes.json()).book;
    assert.equal(patched.status, 'read');

    res = await fetch(`${base}/books?status=read`);
    assert.deepEqual((await res.json()).map((b) => b.title), ['Read Book']);
    res = await fetch(`${base}/books?status=unread`);
    assert.deepEqual((await res.json()).map((b) => b.title), ['Unread Book']);
    res = await fetch(`${base}/books?status=bogus`);
    assert.equal((await res.json()).length, 2);
    res = await fetch(`${base}/books?status=`);
    assert.equal((await res.json()).length, 2);
  });
});

test('?status= with mixed-status fixtures (2 unread + 1 read) returns exact partitions', async () => {
  await withServer(async (base) => {
    // 2 unread + 1 read: create three books, mark one read.
    const created = [];
    for (const [title, author] of [
      ['Unread One', 'A'],
      ['Read One', 'B'],
      ['Unread Two', 'C'],
    ]) {
      const { body } = await post(base, { title, author });
      assert.equal(body.book.status, 'unread');
      created.push(body.book);
    }
    const toRead = created.find((b) => b.title === 'Read One');
    const patchRes = await fetch(`${base}/books/${toRead.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    });
    assert.equal(patchRes.status, 200);

    // ?status=unread → exactly the two unread books
    let res = await fetch(`${base}/books?status=unread`);
    assert.equal(res.status, 200);
    let unread = await res.json();
    assert.equal(unread.length, 2);
    assert.deepEqual(unread.map((b) => b.title).sort(), ['Unread One', 'Unread Two']);
    for (const b of unread) assert.equal(b.status, 'unread');

    // ?status=read → exactly the one read book
    res = await fetch(`${base}/books?status=read`);
    assert.equal(res.status, 200);
    const read = await res.json();
    assert.equal(read.length, 1);
    assert.equal(read[0].title, 'Read One');
    assert.equal(read[0].status, 'read');

    // No filter → all three; ids never leak across partitions
    res = await fetch(`${base}/books`);
    const all = await res.json();
    assert.equal(all.length, 3);
    const unreadIds = new Set(unread.map((b) => b.id));
    for (const b of read) assert.ok(!unreadIds.has(b.id), 'read/unread partitions are disjoint');
  });
});

test('PATCH: invalid status → 400, unknown id → 404, valid update returns book', async () => {
  await withServer(async (base) => {
    const { body } = await post(base, { title: 'T', author: 'A' });
    const id = body.book.id;

    let res = await fetch(`${base}/books/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'bogus' }),
    });
    assert.equal(res.status, 400);

    res = await fetch(`${base}/books/deadbeef0000`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    });
    assert.equal(res.status, 404);

    res = await fetch(`${base}/books/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'read' }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).book.status, 'read');
  });
});

test('DELETE: existing id → 204, unknown id → 404', async () => {
  await withServer(async (base) => {
    const { body } = await post(base, { title: 'T', author: 'A' });
    const id = body.book.id;

    let res = await fetch(`${base}/books/${id}`, { method: 'DELETE' });
    assert.equal(res.status, 204);
    assert.equal(await res.text(), '');

    res = await fetch(`${base}/books/${id}`, { method: 'DELETE' });
    assert.equal(res.status, 404);
  });
});

test('API writes persist to disk and survive a restart of the app', async () => {
  const dataDir = makeTmpDir();
  const { createApp } = require('../src/server');

  const buildServer = () =>
    new Promise((resolve) => {
      const server = createApp({ dataDir }).listen(0);
      server.once('listening', () => resolve(server));
    });

  const first = await buildServer();
  const base1 = `http://127.0.0.1:${first.address().port}/api`;
  const { body } = await post(base1, { title: 'Persisted', author: 'Me' });
  const id = body.book.id;
  await new Promise((resolve) => first.close(resolve));

  const second = await buildServer(); // fresh app, same data dir
  const base2 = `http://127.0.0.1:${second.address().port}/api`;
  const res = await fetch(`${base2}/books`);
  const books = await res.json();
  assert.equal(books.length, 1);
  assert.equal(books[0].id, id);
  assert.equal(books[0].title, 'Persisted');
  await new Promise((resolve) => second.close(resolve));
});