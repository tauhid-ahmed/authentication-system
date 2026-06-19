const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 05 - refresh-tokens API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: Initiating the Flow (Frontend)
// TODO: Step 2: The Login Endpoint & CSRF Protection (Backend)
// TODO: Step 3: The Callback Endpoint
//      - 3.1 Validate the State
//      - 3.2 Exchange the Code for Tokens
//      - 3.3 Get the User Profile
// TODO: Step 4: Account Linking & Token Issuance
// TODO: Step 5: PKCE — The Extra Layer for Public Clients
//      - How it works
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 05 API listening on port ${port}`);
});
