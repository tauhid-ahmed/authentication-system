const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise 09 - oauth API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
// TODO: Step 1: The Math Behind TOTP (RFC 6238)
// TODO: Step 2: Enabling MFA (Backend)
//      - 2.1 Database Schema
//      - 2.2 Generating the Secret & QR Code
//      - 2.3 Verifying the Setup
// TODO: Step 3: Modifying the Login Flow
// TODO: Step 4: The Final Verify Endpoint
// TODO: Step 5: MFA Backup Codes (Account Recovery)
//      - How Backup Codes Work
//      - 5.1 Database Schema
//      - 5.2 Generating Backup Codes on MFA Enable
//      - 5.3 Using a Backup Code at Login
/* ========================================= */

app.listen(port, () => {
  console.log(`Exercise 09 API listening on port ${port}`);
});
