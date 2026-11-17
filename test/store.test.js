'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { Store } = require('../src/store');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'books-store-'));
}

test('create assigns 12-hex id, unread status and ISO addedAt', () => {
  const store = new Store(makeTmpDir());
  store.load();
  const book = store.create('Dune', 'Frank Herbert');

  assert.match(book.id, /^[0-9a-f]{12}$/);
  assert.equal(book.title, 'Dune');
  assert.equal(book.author, 'Frank Herbert');
  assert.equal(book.status, 'unread');
  assert.doesNotThrow(() => new Date(book.addedAt));
  assert.match(book.addedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('create persists to data/books.json in the injected directory', () => {
  const dir = makeTmpDir();
  const store = new Store(dir);
  store.load();
  const book = store.create('Dune', 'Frank Herbert');

  const onDisk = JSON.parse(fs.readFileSync(path.join(dir, 'books.json'), 'utf8'));
  assert.deepEqual(onDisk, [book]);
});

test('persistence survives restart: write with one store, read with another', () => {
  const dir = makeTmpDir();
  const first = new Store(dir);
  first.load();
  const a = first.create('Book A', 'Author A');
  first.updateStatus(a.id, 'read');
  first.create('Book B', 'Author B');

  const second = new Store(dir); // simulate a fresh process
  second.load();
  assert.equal(second.list().length, 2);
  assert.equal(second.getById(a.id).status, 'read');
  assert.deepEqual(
    second.list().map((b) => b.title),
    ['Book A', 'Book B'],
  );
});

test('filterByStatus: unread/read filter, absent and unknown return all', () => {
  const store = new Store(makeTmpDir());
  store.load();
  const a = store.create('A', 'X');
  store.create('B', 'Y');
  store.updateStatus(a.id, 'read');

  assert.deepEqual(store.filterByStatus('read').map((b) => b.title), ['A']);
  assert.deepEqual(store.filterByStatus('unread').map((b) => b.title), ['B']);
  assert.equal(store.filterByStatus(undefined).length, 2);
  assert.equal(store.filterByStatus('nonsense').length, 2);
  assert.equal(store.filterByStatus('').length, 2);
});

test('updateStatus rejects invalid status without touching data', () => {
  const store = new Store(makeTmpDir());
  store.load();
  const book = store.create('A', 'X');

  assert.equal(store.updateStatus(book.id, 'bogus').ok, false);
  assert.equal(store.getById(book.id).status, 'unread');
});

test('updateStatus and remove return not-found for unknown ids', () => {
  const store = new Store(makeTmpDir());
  store.load();
  store.create('A', 'X');

  assert.deepEqual(store.updateStatus('deadbeef0000', 'read'), { ok: false, reason: 'not-found' });
  assert.equal(store.remove('deadbeef0000'), false);
});

test('remove deletes the book and persists the change', () => {
  const dir = makeTmpDir();
  const store = new Store(dir);
  store.load();
  const book = store.create('A', 'X');

  assert.equal(store.remove(book.id), true);
  assert.equal(store.list().length, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'books.json'), 'utf8')), []);
});

test('save is atomic: no temp file left behind after writes', () => {
  const dir = makeTmpDir();
  const store = new Store(dir);
  store.load();
  store.create('A', 'X');
  store.create('B', 'Y');

  const leftovers = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
});