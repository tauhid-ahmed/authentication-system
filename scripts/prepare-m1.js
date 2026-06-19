const fs = require('fs');
const path = require('path');

// 1. Clear API Auth Service to leave TODOs
const apiAuthDir = path.join(__dirname, '..', 'apps', 'api', 'src', 'modules', 'auth');
if (fs.existsSync(apiAuthDir)) {
  fs.writeFileSync(path.join(apiAuthDir, 'auth.service.ts'), `// M1 MVP AUTH - Practice File
// Refer to docs/milestones/M1-mvp-auth.md for instructions!

export const authService = {
  // TODO: Step 2: The Signup Flow
  async signup(input: any) {
    // 2.1 Check if the user exists
    // 2.2 Hash the password
    // 2.3 Save to the database
  },

  // TODO: Step 3: The Login Flow
  async login(input: any) {
    // 3.1 Find the user
    // 3.2 Verify the password
    // 3.3 Issue the Tokens
  }
};
`);

  fs.writeFileSync(path.join(apiAuthDir, 'auth.controller.ts'), `// M1 MVP AUTH - Practice File

export const authController = {
  async signup(req, res) {
    // Call authService.signup and return result
  },

  // TODO: 3.4 Return Tokens by Client Type
  async login(req, res) {
    // Call authService.login
    // Set cookies for browsers, return body tokens for others
  },

  // TODO: Step 4: The /me Endpoint
  async getMe(req, res) {
    // Return req.user
  }
};
`);
}

// 2. Clear out the API middlewares
const apiMiddlewaresDir = path.join(__dirname, '..', 'apps', 'api', 'src', 'middlewares');
if (fs.existsSync(apiMiddlewaresDir)) {
  fs.writeFileSync(path.join(apiMiddlewaresDir, 'authenticate.ts'), `// M1 MVP AUTH - Practice File

export function authenticate(req, res, next) {
  // TODO: 4.1 The Authenticate Middleware
  // 1. Grab token from cookie or header
  // 2. Verify JWT signature
  // 3. Attach decoded payload to req.user
  // 4. Call next()
}
`);
}

// 3. Clear the Web App
const webAppDir = path.join(__dirname, '..', 'apps', 'web', 'app');
if (fs.existsSync(webAppDir)) {
  fs.writeFileSync(path.join(webAppDir, 'page.tsx'), `export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Milestone 1 Practice</h1>
      <p className="text-gray-600 max-w-md text-center">
        This is your empty workspace! Start building your frontend login and signup pages here.
      </p>
    </div>
  );
}
`);
}

console.log('Successfully prepared apps for M1 practice!');
