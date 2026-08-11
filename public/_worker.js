import { generateId, hashPassword, verifyPassword, createSession, getSession, jsonResponse, corsHeaders, errorResponse } from './utils.js';

const SESSION_TTL = 60 * 60 * 24 * 7;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = await env.ASSETS.fetch(request);
      return html;
    }

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (url.pathname === '/api/register' && request.method === 'POST') {
        return handleRegister(request, env, cors);
      }
      if (url.pathname === '/api/login' && request.method === 'POST') {
        return handleLogin(request, env, cors);
      }
      if (url.pathname === '/api/logout' && request.method === 'POST') {
        return handleLogout(request, env, cors);
      }
      if (url.pathname === '/api/me' && request.method === 'GET') {
        return handleMe(request, env, cors);
      }
      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        return handleAdminListUsers(request, env, cors);
      }
      if (url.pathname === '/api/admin/users' && request.method === 'POST') {
        return handleAdminCreateUser(request, env, cors);
      }
      if (url.pathname === '/api/admin/users' && request.method === 'DELETE') {
        return handleAdminDeleteUser(request, env, cors);
      }
      if (url.pathname === '/api/files' && request.method === 'POST') {
        return handleUploadFile(request, env, cors);
      }
      if (url.pathname === '/api/files' && request.method === 'GET') {
        return handleListFiles(request, env, cors);
      }
      if (url.pathname === '/api/files/download' && request.method === 'GET') {
        return handleDownloadFile(request, env, cors);
      }
      if (url.pathname === '/api/files' && request.method === 'DELETE') {
        return handleDeleteFile(request, env, cors);
      }
      if (url.pathname === '/api/share' && request.method === 'POST') {
        return handleShareFile(request, env, cors);
      }
      if (url.pathname === '/api/shared' && request.method === 'GET') {
        return handleListShared(request, env, cors);
      }
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return jsonResponse({ status: 'ok' }, cors);
      }

      return jsonResponse({ error: 'Not found' }, cors, 404);
    } catch (err) {
      console.error(err);
      return errorResponse('Internal server error', 500, cors);
    }
  }
};

async function handleRegister(request, env, cors) {
  const { email, password, name } = await request.json();
  if (!email || !password || !name) {
    return errorResponse('Missing fields', 400, cors);
  }

  const existing = await env.STORAGE.get(`user:${email}`);
  if (existing) {
    return errorResponse('User already exists', 409, cors);
  }

  const isAdmin = (env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).includes(email);
  const user = {
    id: generateId(),
    email,
    name,
    passwordHash: await hashPassword(password),
    role: isAdmin ? 'admin' : 'user',
    createdAt: Date.now()
  };

  await env.STORAGE.put(`user:${email}`, JSON.stringify(user), { expirationTtl: SESSION_TTL * 52 });

  const session = await createSession(env, user.id, email);
  return jsonResponse({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, session }, cors);
}

async function handleLogin(request, env, cors) {
  const { email, password } = await request.json();
  const data = await env.STORAGE.get(`user:${email}`);
  if (!data) {
    return errorResponse('Invalid credentials', 401, cors);
  }

  const user = JSON.parse(data);
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return errorResponse('Invalid credentials', 401, cors);
  }

  const session = await createSession(env, user.id, email);
  return jsonResponse({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, session }, cors);
}

async function handleLogout(request, env, cors) {
  const sessionId = request.headers.get('X-Session-ID');
  if (sessionId) {
    await env.STORAGE.delete(`session:${sessionId}`);
  }
  return jsonResponse({ success: true }, cors);
}

async function handleMe(request, env, cors) {
  const session = await getSession(request, env);
  if (!session) {
    return errorResponse('Unauthorized', 401, cors);
  }
  const userData = await env.STORAGE.get(`user:${session.email}`);
  if (!userData) {
    return errorResponse('User not found', 404, cors);
  }
  const user = JSON.parse(userData);
  return jsonResponse({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }, cors);
}

async function handleAdminListUsers(request, env, cors) {
  const session = await getSession(request, env);
  if (!session || session.role !== 'admin') {
    return errorResponse('Forbidden', 403, cors);
  }

  const cursor = request.headers.get('X-Cursor') || undefined;
  const { keys } = await env.STORAGE.list({ prefix: 'user:', cursor });
  const users = [];
  for (const key of keys) {
    const data = await env.STORAGE.get(key.name);
    if (data) {
      const u = JSON.parse(data);
      users.push({ id: u.id, email: u.email, name: u.name, role: u.role, createdAt: u.createdAt });
    }
  }
  return jsonResponse({ users }, cors);
}

async function handleAdminCreateUser(request, env, cors) {
  const session = await getSession(request, env);
  if (!session || session.role !== 'admin') {
    return errorResponse('Forbidden', 403, cors);
  }

  const { email, password, name, role } = await request.json();
  if (!email || !password || !name) {
    return errorResponse('Missing fields', 400, cors);
  }

  const existing = await env.STORAGE.get(`user:${email}`);
  if (existing) {
    return errorResponse('User already exists', 409, cors);
  }

  const user = {
    id: generateId(),
    email,
    name,
    passwordHash: await hashPassword(password),
    role: role === 'admin' ? 'admin' : 'user',
    createdAt: Date.now()
  };

  await env.STORAGE.put(`user:${email}`, JSON.stringify(user), { expirationTtl: SESSION_TTL * 52 });
  return jsonResponse({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }, cors);
}

async function handleAdminDeleteUser(request, env, cors) {
  const session = await getSession(request, env);
  if (!session || session.role !== 'admin') {
    return errorResponse('Forbidden', 403, cors);
  }

  const { email } = await request.json();
  const data = await env.STORAGE.get(`user:${email}`);
  if (!data) {
    return errorResponse('User not found', 404, cors);
  }

  await env.STORAGE.delete(`user:${email}`);

  const fileResult = await env.STORAGE.list({ prefix: `file:${email}:` });
  const shareResult = await env.STORAGE.list({ prefix: `share:${email}:` });

  for (const key of [...fileResult.keys, ...shareResult.keys]) {
    await env.STORAGE.delete(key.name);
  }

  return jsonResponse({ success: true }, cors);
}

async function handleUploadFile(request, env, cors) {
  const session = await getSession(request, env);
  if (!session) {
    return errorResponse('Unauthorized', 401, cors);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const visibility = formData.get('visibility') || 'private';

  if (!file) {
    return errorResponse('No file provided', 400, cors);
  }

  const fileId = generateId();
  const arrayBuffer = await file.arrayBuffer();
  const key = `${session.email}:${fileId}`;

  await env.FILES.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type,
      contentDisposition: `attachment; filename="${file.name}"`
    }
  });

  const fileMeta = {
    id: fileId,
    name: file.name,
    size: arrayBuffer.byteLength,
    type: file.type,
    visibility,
    owner: session.email,
    createdAt: Date.now()
  };

  await env.STORAGE.put(`file:${key}`, JSON.stringify(fileMeta));
  return jsonResponse({ file: fileMeta }, cors);
}

async function handleListFiles(request, env, cors) {
  const session = await getSession(request, env);
  if (!session) {
    return errorResponse('Unauthorized', 401, cors);
  }

  const visibility = request.headers.get('X-Visibility') || 'private';
  let prefix = visibility === 'shared' ? `share:${session.email}:` : `file:${session.email}:`;

  const { keys } = await env.STORAGE.list({ prefix });
  const files = [];
  for (const key of keys) {
    const data = await env.STORAGE.get(key.name);
    if (data) {
      files.push(JSON.parse(data));
    }
  }

  return jsonResponse({ files }, cors);
}

async function handleDownloadFile(request, env, cors) {
  const session = await getSession(request, env);
  if (!session) {
    return errorResponse('Unauthorized', 401, cors);
  }

  const url = new URL(request.url);
  const fileId = url.searchParams.get('id');
  const owner = url.searchParams.get('owner');
  if (!fileId || !owner) {
    return errorResponse('Missing parameters', 400, cors);
  }

  const key = `${owner}:${fileId}`;
  const object = await env.FILES.get(key);
  if (!object) {
    return errorResponse('File not found', 404, cors);
  }

  const metaData = await env.STORAGE.get(`file:${key}`);
  const meta = metaData ? JSON.parse(metaData) : { name: 'download', type: 'application/octet-stream' };

  return new Response(object.body, {
    headers: {
      'Content-Type': meta.type,
      'Content-Disposition': `attachment; filename="${meta.name}"`,
      ...cors
    }
  });
}

async function handleDeleteFile(request, env, cors) {
  const session = await getSession(request, env);
  if (!session) {
    return errorResponse('Unauthorized', 401, cors);
  }

  const { fileId, owner } = await request.json();
  if (!fileId || !owner) {
    return errorResponse('Missing parameters', 400, cors);
  }

  const key = `${owner}:${fileId}`;
  const metaKey = `file:${key}`;

  await env.FILES.delete(key);
  await env.STORAGE.delete(metaKey);
  await env.STORAGE.delete(`share:${key}`);

  return jsonResponse({ success: true }, cors);
}

async function handleShareFile(request, env, cors) {
  const session = await getSession(request, env);
  if (!session) {
    return errorResponse('Unauthorized', 401, cors);
  }

  const { fileId, targetEmail } = await request.json();
  if (!fileId || !targetEmail) {
    return errorResponse('Missing parameters', 400, cors);
  }

  const sourceKey = `${session.email}:${fileId}`;
  const shareKey = `share:${targetEmail}:${fileId}`;

  const metaData = await env.STORAGE.get(`file:${sourceKey}`);
  if (!metaData) {
    return errorResponse('File not found', 404, cors);
  }

  await env.STORAGE.put(shareKey, JSON.stringify({ fileId, owner: session.email, createdAt: Date.now() }));
  return jsonResponse({ success: true }, cors);
}

async function handleListShared(request, env, cors) {
  const session = await getSession(request, env);
  if (!session) {
    return errorResponse('Unauthorized', 401, cors);
  }

  const { keys } = await env.STORAGE.list({ prefix: `share:${session.email}:` });
  const files = [];
  for (const key of keys) {
    const shareData = JSON.parse(await env.STORAGE.get(key.name));
    const sourceKey = `${shareData.owner}:${shareData.fileId}`;
    const metaData = await env.STORAGE.get(`file:${sourceKey}`);
    if (metaData) {
      files.push({ ...JSON.parse(metaData), owner: shareData.owner });
    }
  }

  return jsonResponse({ files }, cors);
}
