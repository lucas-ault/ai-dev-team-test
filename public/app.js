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
  var filterBar = document.getElementById('filter-bar');

  /** Local mirror of the server's book list; re-rendered on every change. */
  var books = [];

  /** Currently active status filter: 'all' | 'unread' | 'read'. */
  var currentFilter = 'all';

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
    books = await request(
      logic.buildBooksUrl(API_URL, currentFilter),
      { method: 'GET' },
      'Failed to load books.'
    );
    renderBooks();
  }

  /** Re-render the list from the local mirror under the current filter. */
  function renderBooks() {
    var emptyMessage = currentFilter === 'all'
      ? undefined
      : 'No ' + currentFilter + ' books.';
    logic.renderList(books, listEl, emptyMessage);
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
    // New books are always unread, so they only join the local mirror
    // when the current filter would show them; otherwise re-fetch.
    if (currentFilter === 'all') {
      books.push(logic.bookFromResponse(book));
      renderBooks();
    } else {
      await loadBooks();
    }
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
      var updated = logic.bookFromResponse(book);
      var index = books.findIndex(function (b) { return String(b.id) === String(id); });
      if (index !== -1) {
        books[index] = updated;
      }
    } catch (err) {
      // Book may have been deleted elsewhere; resync from the server.
      await loadBooks();
      showError(err.message);
      return;
    }
    // A toggle can move a book out of the active filter (e.g. marking a
    // book read while the Unread filter is on) — re-fetch in that case.
    if (currentFilter !== 'all' && currentFilter !== updated.status) {
      await loadBooks();
      return;
    }
    renderBooks();
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

  // Filter bar: clicking a button switches the active filter, re-renders
  // the bar (moving the active indicator), and re-fetches from the API.
  filterBar.addEventListener('click', function (event) {
    var button = event.target.closest('button[data-filter]');
    if (!button) return;
    var filter = logic.normalizeFilter(button.getAttribute('data-filter'));
    if (filter === currentFilter) return;
    currentFilter = filter;
    logic.renderFilterBar(currentFilter, filterBar);
    loadBooks().catch(function (err) {
      showError(err.message);
    });
  });

  logic.renderFilterBar(currentFilter, filterBar);

  loadBooks().catch(function (err) {
    showError(err.message);
  });
})();
