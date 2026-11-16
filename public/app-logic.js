/* Pure rendering logic for the reading-list UI.
 *
 * Exposed as a UMD module so it can be:
 *   - loaded in the browser via <script> (window.AppLogic), and
 *   - imported by node --test regardless of whether package.json
 *     sets "type": "module" (CommonJS export).
 *
 * buildBookRow(book) and renderList(books, container) are pure with
 * respect to their inputs: buildBookRow returns an HTML string, and
 * renderList only writes to the container it is given (so tests can
 * pass a plain `{ innerHTML: '' }` mock instead of a real DOM).
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AppLogic = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Escape a string for safe interpolation into HTML.
   */
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Human-readable status label for a book.
   */
  function statusLabel(status) {
    return status === 'read' ? 'Read' : 'Unread';
  }

  /**
   * Build the HTML for a single book row (an <li>).
   * Pure function: returns a string, touches no DOM.
   */
  function buildBookRow(book) {
    var status = book.status === 'read' ? 'read' : 'unread';
    var nextStatus = status === 'read' ? 'unread' : 'read';
    var id = escapeHtml(book.id);
    var toggleLabel = status === 'read' ? 'Mark unread' : 'Mark read';

    return (
      '<li class="book-row ' + status + '" data-id="' + id + '" data-status="' + status + '">' +
        '<span class="book-title">' + escapeHtml(book.title) + '</span>' +
        '<span class="book-author">' + escapeHtml(book.author) + '</span>' +
        '<span class="book-status">' + escapeHtml(statusLabel(status)) + '</span>' +
        '<button type="button" class="toggle-btn" data-action="toggle"' +
          ' data-id="' + id + '" data-next-status="' + nextStatus + '">' +
          toggleLabel +
        '</button>' +
        '<button type="button" class="delete-btn" data-action="delete" data-id="' + id + '">' +
          'Delete' +
        '</button>' +
      '</li>'
    );
  }

  /**
   * Render the list of books into a container element.
   * Returns the generated HTML string; only mutates `container.innerHTML`.
   */
  function renderList(books, container) {
    var html;
    if (!Array.isArray(books) || books.length === 0) {
      html = '<li class="empty-state">No books yet. Add one above!</li>';
    } else {
      html = books.map(buildBookRow).join('');
    }
    if (container) {
      container.innerHTML = html;
    }
    return html;
  }

  return {
    escapeHtml: escapeHtml,
    statusLabel: statusLabel,
    buildBookRow: buildBookRow,
    renderList: renderList
  };
}));
