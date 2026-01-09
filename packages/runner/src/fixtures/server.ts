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

  // Route to simple form
  if (req.url === '/jobs/simple-form' || req.url === '/') {
    try {
      const htmlPath = join(__dirname, 'simple-form.html');
      const html = await readFile(htmlPath, 'utf-8');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      console.error('Error serving simple-form.html:', error);
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
