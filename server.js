import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDirectory = join(root, 'data');
const dataFile = join(dataDirectory, 'tasks.json');
const port = Number(process.env.PORT) || 3000;
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

async function loadTasks() {
  try {
    return JSON.parse(await readFile(dataFile, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveTasks(tasks) {
  await mkdir(dataDirectory, { recursive: true });
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(tasks, null, 2)}\n`);
  await rename(temporaryFile, dataFile);
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error('Request body is too large');
  }
  return JSON.parse(body || '{}');
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = normalize(join(root, requestedPath));
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes[extname(filePath)] ?? 'application/octet-stream',
    });
    response.end(content);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);

  try {
    if (url.pathname === '/api/tasks' && request.method === 'GET') {
      sendJson(response, 200, await loadTasks());
      return;
    }

    if (url.pathname === '/api/tasks' && request.method === 'POST') {
      const { title } = await readJson(request);
      if (typeof title !== 'string' || !title.trim()) {
        sendJson(response, 400, { error: 'A task title is required.' });
        return;
      }

      const tasks = await loadTasks();
      const task = {
        id: randomUUID(),
        title: title.trim().slice(0, 200),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      tasks.unshift(task);
      await saveTasks(tasks);
      sendJson(response, 201, task);
      return;
    }

    if (url.pathname === '/api/tasks/completed' && request.method === 'DELETE') {
      const tasks = await loadTasks();
      const remainingTasks = tasks.filter((task) => !task.completed);
      if (remainingTasks.length !== tasks.length) await saveTasks(remainingTasks);
      response.writeHead(204).end();
      return;
    }

    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === 'PATCH') {
      const { completed } = await readJson(request);
      if (typeof completed !== 'boolean') {
        sendJson(response, 400, { error: 'Completed must be true or false.' });
        return;
      }

      const tasks = await loadTasks();
      const task = tasks.find((item) => item.id === taskMatch[1]);
      if (!task) {
        sendJson(response, 404, { error: 'Task not found.' });
        return;
      }
      task.completed = completed;
      await saveTasks(tasks);
      sendJson(response, 200, task);
      return;
    }

    if (taskMatch && request.method === 'DELETE') {
      const tasks = await loadTasks();
      const remainingTasks = tasks.filter((item) => item.id !== taskMatch[1]);
      if (remainingTasks.length === tasks.length) {
        sendJson(response, 404, { error: 'Task not found.' });
        return;
      }
      await saveTasks(remainingTasks);
      response.writeHead(204).end();
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'Not found.' });
      return;
    }

    await serveStatic(url.pathname, response);
  } catch (error) {
    const isBadRequest = error instanceof SyntaxError || error.message === 'Request body is too large';
    sendJson(response, isBadRequest ? 400 : 500, {
      error: isBadRequest ? 'Invalid request body.' : 'The server could not complete the request.',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`To Do app running at http://localhost:${port}`);
});