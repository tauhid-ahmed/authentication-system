const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 03 - jwt-auth API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: The Database Role Enum
// TODO: Step 2: Backend API Protection
//      - 2.1 The `requireRole` Middleware
//      - 2.2 Applying the Middleware to Routes
// TODO: Step 3: Frontend UI Protection
//      - 3.1 The User Object in Memory
//      - 3.2 Conditionally Rendering UI in Server Components
//      - 3.3 Protecting Whole Pages (Next.js)
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 03 API listening on port ${port}`);
});
