const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 10 - rbac API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: The Database Schema
// TODO: Step 2: Sending the Verification Email on Signup
// TODO: Step 3: The Verify Email Endpoint
// TODO: Step 4: Enforcing Verification at Login
// TODO: Step 5: Resend Verification Email
// TODO: Step 6: The Frontend Flow
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 10 API listening on port ${port}`);
});
