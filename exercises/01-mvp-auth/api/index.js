const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 01 - mvp-auth API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: The Database Schema
// TODO: Step 2: The Signup Flow
//      - 2.1 Check if the user exists
//      - 2.2 Hash the password
//      - 2.3 Save to the database
// TODO: Step 3: The Login Flow
//      - 3.1 Find the user
//      - 3.2 Verify the password
//      - 3.3 Issue the Tokens
//      - 3.4 Return Tokens by Client Type (The Controller)
// TODO: Step 4: The `/me` Endpoint (Verifying the Token)
//      - 4.1 The Authenticate Middleware
//      - 4.2 The Route Handler
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 01 API listening on port ${port}`);
});
