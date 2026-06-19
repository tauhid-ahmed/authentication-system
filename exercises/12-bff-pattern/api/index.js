const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 12 - bff-pattern API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
//      - The Complete Flow, Step by Step
//      - Why This is Secure
//      - The Complete Flow, Step by Step
//      - Key Differences from Backend-First
//      - Architecture Diagram
//      - The Responsibilities Split
//      - Our System vs BFF
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 12 API listening on port ${port}`);
});
