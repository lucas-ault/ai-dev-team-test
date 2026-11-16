'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const STATUSES = Object.freeze(['unread', 'read']);

/**
 * JSON-file-backed book store.
 * The data directory is injectable so tests can use a temp dir.
 * Writes are atomic: write to a temp file, then rename over the target.
 */
class Store {
  /**
   * @param {string} dataDir directory holding books.json (created if missing)
   * @param {string} [fileName] file name inside dataDir, defaults to "books.json"
   */
  constructor(dataDir, fileName = 'books.json') {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, fileName);
    this.books = [];
  }

  /** Load books from disk. Missing or corrupt-less empty file → empty list. */
  load() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.books = [];
      return this.books;
    }
    const raw = fs.readFileSync(this.filePath, 'utf8');
    this.books = raw.trim() ? JSON.parse(raw) : [];
    if (!Array.isArray(this.books)) {
      throw new Error(`${this.filePath}: expected a JSON array of books`);
    }
    return this.books;
  }

  /** Atomically persist the current book list. */
  save() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    const tmp = path.join(this.dataDir, `.${path.basename(this.filePath)}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(this.books, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, this.filePath);
  }

  list() {
    return this.books;
  }

  /**
   * Filter by status. Only exact "unread"/"read" values filter;
   * anything else (absent, unknown) returns all books.
   * @param {string|undefined} status
   */
  filterByStatus(status) {
    if (!STATUSES.includes(status)) return this.books.slice();
    return this.books.filter((b) => b.status === status);
  }

  getById(id) {
    return this.books.find((b) => b.id === id) || null;
  }

  /**
   * Create a book. Caller must have validated title/author.
   * New books always start with status "unread".
   */
  create(title, author) {
    const book = {
      id: crypto.randomBytes(6).toString('hex'), // 12-hex random id
      title,
      author,
      status: 'unread',
      addedAt: new Date().toISOString(),
    };
    this.books.push(book);
    this.save();
    return book;
  }

  /**
   * Update the status of a book.
   * @returns {{ ok: true, book: object } | { ok: false, reason: 'not-found' | 'invalid-status' }}
   */
  updateStatus(id, status) {
    if (!STATUSES.includes(status)) return { ok: false, reason: 'invalid-status' };
    const book = this.getById(id);
    if (!book) return { ok: false, reason: 'not-found' };
    book.status = status;
    this.save();
    return { ok: true, book };
  }

  /**
   * Delete a book by id.
   * @returns {boolean} true if deleted, false if the id is unknown
   */
  remove(id) {
    const idx = this.books.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    this.books.splice(idx, 1);
    this.save();
    return true;
  }
}

/** A title/author is valid only as a non-empty string with visible content. */
function isValidTextField(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

module.exports = { Store, STATUSES, isValidTextField };