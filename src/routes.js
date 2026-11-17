'use strict';

const express = require('express');
const { STATUSES, isValidTextField } = require('./store');

/**
 * Build the /api/books router backed by the given store.
 * @param {import('./store').Store} store
 */
function createBooksRouter(store) {
  const router = express.Router();

  // GET /api/books?status=unread|read
  // Absent or unknown status values return all books.
  router.get('/books', (req, res) => {
    res.json(store.filterByStatus(req.query.status));
  });

  // POST /api/books {title, author}
  router.post('/books', (req, res) => {
    const { title, author } = req.body || {};
    if (!isValidTextField(title) || !isValidTextField(author)) {
      return res.status(400).json({
        error: 'Both "title" and "author" are required and must be non-empty strings.',
      });
    }
    const book = store.create(title.trim(), author.trim());
    return res.status(201).json({ book });
  });

  // PATCH /api/books/:id {status}
  router.patch('/books/:id', (req, res) => {
    const { status } = req.body || {};
    if (!STATUSES.includes(status)) {
      return res.status(400).json({
        error: `"status" must be one of: ${STATUSES.join(', ')}.`,
      });
    }
    const result = store.updateStatus(req.params.id, status);
    if (!result.ok) {
      if (result.reason === 'invalid-status') {
        return res.status(400).json({ error: 'Invalid status.' });
      }
      return res.status(404).json({ error: 'Book not found.' });
    }
    return res.json({ book: result.book });
  });

  // DELETE /api/books/:id
  router.delete('/books/:id', (req, res) => {
    if (store.remove(req.params.id)) return res.status(204).end();
    return res.status(404).json({ error: 'Book not found.' });
  });

  return router;
}

module.exports = { createBooksRouter };