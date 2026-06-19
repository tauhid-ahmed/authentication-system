const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 07 - express-architecture API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: Capturing Device Information (Backend)
//      - 1.1 Updating the Database Schema
//      - 1.2 Saving the Metadata on Login
// TODO: Step 2: Fetching Active Sessions
// TODO: Step 3: Revoking a Session (Remote Logout)
//      - 3.1 The Revoke Endpoint
// TODO: Step 4: The Frontend UI
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 07 API listening on port ${port}`);
});
