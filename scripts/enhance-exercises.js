const fs = require('fs');
const path = require('path');

const milestones = [
  { id: '01', name: 'mvp-auth', docs: 'M1-mvp-auth.md' },
  { id: '02', name: 'session-auth', docs: 'M2-advanced-tokens.md' }, // M2 docs might have a different name, I'll just check if it exists
  { id: '03', name: 'jwt-auth', docs: 'M3-authorization.md' },
  { id: '04', name: 'access-token-system', docs: 'M4-nextjs-integration.md' },
  { id: '05', name: 'refresh-tokens', docs: 'M5-oauth.md' },
  { id: '06', name: 'refresh-token-rotation', docs: 'M6-advanced-security.md' },
  { id: '07', name: 'express-architecture', docs: 'M7-session-management.md' },
  { id: '08', name: 'nextjs-auth-system', docs: 'M8-password-reset.md' },
  { id: '09', name: 'oauth', docs: 'M9-mfa.md' },
  { id: '10', name: 'rbac', docs: 'M10-email-verification.md' },
  { id: '11', name: 'session-management', docs: 'B1-backend-jwt-lifecycle.md' },
  { id: '12', name: 'bff-pattern', docs: 'A2-bff-pattern.md' },
  { id: '13', name: 'security-hardening', docs: 'A4-complete-auth-architecture.md' },
  { id: '14', name: 'observability', docs: 'M0-foundations.md' }
];

const rootDir = path.join(__dirname, '..', 'exercises');
const docsDir = path.join(__dirname, '..', 'docs', 'milestones');

const docsFiles = fs.readdirSync(docsDir);

milestones.forEach((m, idx) => {
  const dirName = `${m.id}-${m.name}`;
  const exercisePath = path.join(rootDir, dirName);
  
  if (!fs.existsSync(exercisePath)) return;

  // Find the exact doc file
  const docFile = docsFiles.find(f => f.startsWith(`M${parseInt(m.id)}-`)) || docsFiles[0];
  const docPath = path.join(docsDir, docFile);
  let docContent = '';
  let todos = [];
  
  if (fs.existsSync(docPath)) {
    docContent = fs.readFileSync(docPath, 'utf8');
    // Extract step headers for TODOs
    const lines = docContent.split('\n');
    lines.forEach(line => {
      if (line.startsWith('## Step')) {
        todos.push(`// TODO: ${line.replace('## ', '').trim()}`);
      } else if (line.startsWith('### ')) {
        todos.push(`//      - ${line.replace('### ', '').trim()}`);
      }
    });
  }

  // Enhance API index.js with TODOs
  const apiPath = path.join(exercisePath, 'api');
  if (fs.existsSync(apiPath)) {
    const todoString = todos.length > 0 ? todos.join('\n') : '// TODO: Implement milestone features here';
    fs.writeFileSync(path.join(apiPath, 'index.js'), `const express = require('express');
const app = express();
const port = 5000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Exercise ${m.id} - ${m.name} API' });
});

/* =========================================
 * EXERCISE INSTRUCTIONS & TODOS
 * ========================================= */
${todoString}
/* ========================================= */

app.listen(port, () => {
  console.log(\`Exercise ${m.id} API listening on port \${port}\`);
});
`);
  }

  // Enhance Web Next.js with Markdown renderer
  const webPath = path.join(exercisePath, 'web');
  const appDirPath = path.join(webPath, 'app');
  if (fs.existsSync(appDirPath)) {
    // Write layout.tsx to import global css
    fs.writeFileSync(path.join(appDirPath, 'layout.tsx'), `import './globals.css';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}`);

    // Write globals.css for Tailwind-like basic styling
    fs.writeFileSync(path.join(appDirPath, 'globals.css'), `
      body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
      .prose { max-width: 65ch; margin: 0 auto; padding: 2rem; }
      .prose h1 { font-size: 2.25rem; font-weight: bold; margin-bottom: 1rem; }
      .prose h2 { font-size: 1.5rem; font-weight: bold; margin-top: 2rem; margin-bottom: 1rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.5rem; }
      .prose h3 { font-size: 1.25rem; font-weight: bold; margin-top: 1.5rem; margin-bottom: 0.5rem; }
      .prose p { margin-bottom: 1rem; line-height: 1.6; }
      .prose pre { background: #1f2937; color: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; margin-bottom: 1rem; }
      .prose code { background: #e5e7eb; padding: 0.2rem 0.4rem; border-radius: 0.25rem; font-size: 0.875em; }
      .prose pre code { background: transparent; padding: 0; }
      .prose blockquote { border-left: 4px solid #d1d5db; padding-left: 1rem; color: #4b5563; font-style: italic; margin-bottom: 1rem; }
      .prose ul, .prose ol { margin-bottom: 1rem; padding-left: 1.5rem; }
      .prose li { margin-bottom: 0.5rem; }
    `);

    fs.writeFileSync(path.join(appDirPath, 'page.tsx'), `import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default async function Page() {
  const docPath = path.join(process.cwd(), '../../../docs/milestones/${docFile}');
  let content = 'Documentation not found.';
  try {
    content = fs.readFileSync(docPath, 'utf8');
  } catch (e) {
    console.error(e);
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-indigo-600 text-white p-6 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Exercise ${m.id}: ${m.name}</h1>
          <span className="bg-indigo-800 px-3 py-1 rounded-full text-sm">Practice Module</span>
        </div>
      </div>
      
      <main className="max-w-4xl mx-auto mt-8 grid grid-cols-1 gap-8 px-4 pb-20">
        <section className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 prose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </section>
      </main>
    </div>
  );
}
`);
  }
});

console.log('Successfully enhanced exercises with UI and TODOs!');
