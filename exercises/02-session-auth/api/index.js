const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 02 - session-auth API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: The Refresh Endpoint (Backend)
//      - 1.1 The Controller (`auth.controller.ts`)
//      - 1.2 The Service Logic & Replay Attack Detection
// TODO: Step 2: The Fetch Interceptor (Frontend)
//      - 2.1 The Race Condition
//      - 2.2 The Concurrency Lock Implementation
//      - 2.3 The Interceptor Wrapper
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 02 API listening on port ${port}`);
});
