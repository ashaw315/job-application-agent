import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3456;

/**
 * Simple fixture server for testing runner automation
 * Serves static HTML forms that simulate Greenhouse ATS
 */
const server = createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  const routes: Record<string, string> = {
    '/': 'simple-form.html',
    '/jobs/simple-form': 'simple-form.html',
    '/jobs/complete-form': 'complete-form.html',
    '/jobs/no-cover-letter': 'no-cover-letter-form.html',
    '/jobs/ambiguous-form': 'ambiguous-form.html',
    '/jobs/no-resume': 'no-resume-form.html',
  };

  const filename = routes[req.url || ''];

  if (filename) {
    try {
      const htmlPath = join(__dirname, filename);
      const html = await readFile(htmlPath, 'utf-8');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      console.error(`Error serving ${filename}:`, error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
    return;
  }

  // 404 for other routes
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`🧪 Fixture server running at http://localhost:${PORT}`);
  console.log(`   Simple form: http://localhost:${PORT}/jobs/simple-form`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
