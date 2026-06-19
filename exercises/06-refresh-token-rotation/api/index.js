const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 06 - refresh-token-rotation API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: Rate Limiting (Backend)
//      - 1.1 The Redis Client
//      - 1.2 The Rate Limiter Middleware
//      - 1.3 Applying the Rate Limiter
// TODO: Step 2: Security Headers (Helmet.js)
// TODO: Step 3: Handling 429 in the Frontend
// TODO: Step 4: Audit Logging (Backend)
//      - What to log
//      - The Audit Log Schema
//      - The Audit Service
//      - Wiring it into Login
//      - Why Audit Logs Are Non-Blocking
// TODO: Step 5: Account Lockout (Brute Force Protection)
//      - The Database Schema
//      - Lockout Logic in the Login Service
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 06 API listening on port ${port}`);
});
