'use strict';

const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const { Store } = require('./store');
const { createBooksRouter } = require('./routes');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const PORT = Number(process.env.PORT) || 3000;

/**
 * Build the configured Express app (does not listen).
 * Exported so tests and other consumers can create instances.
 */
function createApp({ dataDir = DATA_DIR } = {}) {
  const app = express();
  app.use(express.json());

  const store = new Store(dataDir);
  store.load();
  app.use('/api', createBooksRouter(store));

  // Serve the frontend if T-2 has provided a public/ directory.
  const publicDir = path.join(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  return app;
}

/** Start listening. Returns the http server so callers can close it. */
function start({ port = PORT, dataDir } = {}) {
  const app = createApp({ dataDir });
  const server = app.listen(port, () => {
    console.log(`Reading-list API listening on http://localhost:${port}`);
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };