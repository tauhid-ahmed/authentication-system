const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 08 - nextjs-auth-system API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: The Database Schema
// TODO: Step 2: The "Forgot Password" Endpoint
//      - 2.1 The Enumeration Defense
//      - 2.2 Generating the Token
//      - 2.3 Sending the Email
// TODO: Step 3: The "Reset Password" Endpoint
//      - 3.1 Validate the Token
//      - 3.2 Update Password & Mark Token Used
//      - 3.3 The Final Security Step: Revoke All Sessions
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 08 API listening on port ${port}`);
});
