const fs = require('fs');
const path = require('path');

const milestones = [
  { id: '01', name: 'mvp-auth' },
  { id: '02', name: 'session-auth' },
  { id: '03', name: 'jwt-auth' },
  { id: '04', name: 'access-token-system' },
  { id: '05', name: 'refresh-tokens' },
  { id: '06', name: 'refresh-token-rotation' },
  { id: '07', name: 'express-architecture' },
  { id: '08', name: 'nextjs-auth-system' },
  { id: '09', name: 'oauth' },
  { id: '10', name: 'rbac' },
  { id: '11', name: 'session-management' },
  { id: '12', name: 'bff-pattern' },
  { id: '13', name: 'security-hardening' },
  { id: '14', name: 'observability' }
];

const rootDir = path.join(__dirname, '..', 'exercises');

if (!fs.existsSync(rootDir)) {
  fs.mkdirSync(rootDir, { recursive: true });
}

milestones.forEach(m => {
  const dirName = `${m.id}-${m.name}`;
  const exercisePath = path.join(rootDir, dirName);
  
  if (!fs.existsSync(exercisePath)) {
    fs.mkdirSync(exercisePath, { recursive: true });
  }

  // Create api
  const apiPath = path.join(exercisePath, 'api');
  if (!fs.existsSync(apiPath)) {
    fs.mkdirSync(apiPath, { recursive: true });
    fs.writeFileSync(path.join(apiPath, 'package.json'), JSON.stringify({
      name: `@exercise-${m.id}/api`,
      version: "1.0.0",
      description: `Starter API for ${m.name}`,
      main: "index.js",
      scripts: {
        "dev": "nodemon index.js"
      },
      dependencies: {
        "express": "^4.18.2"
      }
    }, null, 2));
    
    // Add a basic index.js
    fs.writeFileSync(path.join(apiPath, 'index.js'), `const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise ${m.id} - ${m.name} API' });
});

// TODO: Implement milestone features here

app.listen(port, () => {
  console.log(\`Exercise ${m.id} API listening on port \${port}\`);
});
`);
  }

  // Create web
  const webPath = path.join(exercisePath, 'web');
  if (!fs.existsSync(webPath)) {
    fs.mkdirSync(webPath, { recursive: true });
    fs.writeFileSync(path.join(webPath, 'package.json'), JSON.stringify({
      name: `@exercise-${m.id}/web`,
      version: "1.0.0",
      description: `Starter Web for ${m.name}`,
      scripts: {
        "dev": "next dev"
      },
      dependencies: {
        "next": "15.0.0",
        "react": "^18.2.0",
        "react-dom": "^18.2.0"
      }
    }, null, 2));
    
    // Add a basic Next.js page
    const appDirPath = path.join(webPath, 'app');
    fs.mkdirSync(appDirPath, { recursive: true });
    fs.writeFileSync(path.join(appDirPath, 'page.tsx'), `export default function Page() {
  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>Exercise ${m.id} - ${m.name}</h1>
      <p>Start building your frontend here!</p>
    </div>
  );
}
`);
  }

  // Create README
  fs.writeFileSync(path.join(exercisePath, 'README.md'), `# Exercise ${m.id}: ${m.name}

Welcome to the practice repository for **Milestone ${m.id}**!

## Getting Started
1. Review the requirements in \`../../docs/milestones/M${parseInt(m.id)}-${m.name}.md\`
2. Start the API using \`pnpm --filter @exercise-${m.id}/api dev\`
3. Start the Web UI using \`pnpm --filter @exercise-${m.id}/web dev\`
4. Happy coding!
`);
});

console.log('Successfully scaffolded exercises!');
