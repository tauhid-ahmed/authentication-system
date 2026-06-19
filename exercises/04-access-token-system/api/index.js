const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 04 - access-token-system API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: The `authFetchServer` Utility
// TODO: Step 2: Extracting the User Object (Server-Side)
// TODO: Step 3: Protecting the UI with Middleware
//      - The Golden Rule of Next.js Middleware
// TODO: Step 4: The Protected Layout (Server Component)
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 04 API listening on port ${port}`);
});
