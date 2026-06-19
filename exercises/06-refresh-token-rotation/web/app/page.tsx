import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default async function Page() {
  const docPath = path.join(process.cwd(), '../../../docs/milestones/M6-advanced-security.md');
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
          <h1 className="text-2xl font-bold">Exercise 06: refresh-token-rotation</h1>
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
