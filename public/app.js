/* Frontend wiring: fetch calls to the API + event handling.
 * Pure rendering lives in app-logic.js (window.AppLogic).
 */
(function () {
  'use strict';

  var API_URL = '/api/books';
  var logic = window.AppLogic;

  var form = document.getElementById('add-book-form');
  var titleInput = document.getElementById('title-input');
  var authorInput = document.getElementById('author-input');
  var errorBox = document.getElementById('error-message');
  var listEl = document.getElementById('book-list');

  /** Local mirror of the server's book list; re-rendered on every change. */
  var books = [];

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    errorBox.textContent = '';
    errorBox.hidden = true;
  }

  /**
   * Extract a human-readable error message from a failed response,
   * using whatever the API put in its JSON body.
   */
  function errorFromResponse(data, fallback) {
    if (data && (data.error || data.message)) {
      return data.error || data.message;
    }
    return fallback;
  }

  async function request(url, options, fallbackMessage) {
    var res = await fetch(url, options);
    var data = null;
    if (res.status !== 204) {
      try {
        data = await res.json();
      } catch (err) {
        data = null;
      }
    }
    if (!res.ok) {
      throw new Error(errorFromResponse(data, fallbackMessage || ('Request failed (' + res.status + ')')));
    }
    return data;
  }

  async function loadBooks() {
    books = await request(API_URL, { method: 'GET' }, 'Failed to load books.');
    logic.renderList(books, listEl);
  }

  async function addBook(event) {
    event.preventDefault();
    clearError();
    var title = titleInput.value.trim();
    var author = authorInput.value.trim();

    var book;
    try {
      // Deliberately POST even when fields are blank so the server's
      // 400 response is what surfaces to the user.
      book = await request(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title, author: author })
      }, 'Failed to add book.');
    } catch (err) {
      showError(err.message);
      return;
    }

    // Per the API contract, POST returns { book: {...} } — unwrap it.
    books.push(logic.bookFromResponse(book));
    logic.renderList(books, listEl);
    titleInput.value = '';
    authorInput.value = '';
    titleInput.focus();
  }

  async function toggleBook(id, nextStatus) {
    clearError();
    try {
      var book = await request(API_URL + '/' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      }, 'Failed to update book.');
      var index = books.findIndex(function (b) { return String(b.id) === String(id); });
      if (index !== -1) {
        // Per the API contract, PATCH returns { book: {...} } — unwrap it.
        books[index] = logic.bookFromResponse(book);
      }
    } catch (err) {
      // Book may have been deleted elsewhere; resync from the server.
      await loadBooks();
      showError(err.message);
      return;
    }
    logic.renderList(books, listEl);
  }

  async function deleteBook(id) {
    clearError();
    try {
      await request(API_URL + '/' + encodeURIComponent(id), {
        method: 'DELETE'
      }, 'Failed to delete book.');
    } catch (err) {
      await loadBooks();
      showError(err.message);
      return;
    }
    books = books.filter(function (b) { return String(b.id) !== String(id); });
    logic.renderList(books, listEl);
  }

  // Event delegation: one listener on the list handles toggle + delete
  // for every row, present and future.
  listEl.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-action]');
    if (!button) return;
    var id = button.getAttribute('data-id');
    if (button.getAttribute('data-action') === 'toggle') {
      toggleBook(id, button.getAttribute('data-next-status'));
    } else if (button.getAttribute('data-action') === 'delete') {
      deleteBook(id);
    }
  });

  form.addEventListener('submit', addBook);

  loadBooks().catch(function (err) {
    showError(err.message);
  });
})();
