import { io } from 'socket.io-client';

const API = 'http://localhost:3001';
const ORIGIN = 'http://localhost:5173';
const PASS = 'devpass123';

function fail(message, extra) {
  console.error(`FAIL: ${message}`);
  if (extra !== undefined) console.error(extra);
  process.exit(1);
}

function ok(message) {
  console.log(`OK: ${message}`);
}

async function json(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function loginOrRegister({ email, password, name }) {
  try {
    return await json('POST', '/api/auth/login', { body: { email, password } });
  } catch {
    return json('POST', '/api/auth/register', { body: { email, password, name } });
  }
}

function wait(socket, event, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    function onEvent(payload) {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, onEvent);
  });
}

function connectUser(user) {
  return new Promise((resolve, reject) => {
    const socket = io(API, {
      transports: ['websocket'],
      extraHeaders: { Origin: ORIGIN },
    });
    const timer = setTimeout(() => reject(new Error(`connect timeout for ${user.email}`)), 5000);
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
  }).then(async (socket) => {
    const statePromise = wait(socket, 'board-state');
    socket.emit('join-board', {
      boardId: user.boardId,
      user: { id: user.id, name: user.name, email: user.email },
    });
    const state = await statePromise;
    return { socket, state };
  });
}

const strokeId = `stroke-${Date.now()}`;

try {
  const ownerAuth = await loginOrRegister({
    email: 'slide@example.com',
    password: PASS,
    name: 'Slide User',
  });
  const editorAuth = await loginOrRegister({
    email: 'editor@example.com',
    password: PASS,
    name: 'Editor User',
  });
  const viewerAuth = await loginOrRegister({
    email: 'viewer@example.com',
    password: PASS,
    name: 'Viewer User',
  });

  const board = await json('POST', '/api/boards', {
    token: ownerAuth.token,
    body: { title: `Two-client probe ${Date.now()}` },
  });

  await json('POST', `/api/boards/${board.id}/collaborators`, {
    token: ownerAuth.token,
    body: { email: editorAuth.user.email, permission: 'edit' },
  });
  await json('POST', `/api/boards/${board.id}/collaborators`, {
    token: ownerAuth.token,
    body: { email: viewerAuth.user.email, permission: 'view' },
  });

  const owner = { ...ownerAuth.user, boardId: board.id };
  const editor = { ...editorAuth.user, boardId: board.id };
  const viewer = { ...viewerAuth.user, boardId: board.id };

  const a = await connectUser(owner);
  const b = await connectUser(editor);
  ok(`both joined board ${board.id}`);

  const cursorPromise = wait(b.socket, 'cursor-update');
  a.socket.emit('cursor-move', { boardId: board.id, x: 120, y: 80 });
  const cursor = await cursorPromise;
  if (cursor.x !== 120 || cursor.y !== 80) fail('cursor coordinates', cursor);
  if (cursor.userId !== owner.id) fail('cursor userId', cursor);
  ok('cursor broadcast');

  const addedPromise = wait(b.socket, 'element-added');
  a.socket.emit('drawing-start', {
    boardId: board.id,
    element: {
      id: strokeId,
      type: 'pen',
      points: [{ x: 10, y: 10 }, { x: 12, y: 12 }],
      color: '#111111',
      strokeWidth: 3,
    },
  });
  const added = await addedPromise;
  if (added.element?.id !== strokeId) fail('element-added id', added);
  ok('preview drawing-start');

  const updatedPromise = wait(b.socket, 'element-updated');
  a.socket.emit('drawing-update', {
    boardId: board.id,
    elementId: strokeId,
    updates: { points: [{ x: 10, y: 10 }, { x: 40, y: 50 }] },
  });
  const updated = await updatedPromise;
  if (updated.elementId !== strokeId) fail('element-updated id', updated);
  ok('preview drawing-update');

  a.socket.emit('drawing-commit', { boardId: board.id });
  const flushed = wait(a.socket, 'board-flushed', 6000);
  a.socket.emit('flush-board', { boardId: board.id });
  await flushed;
  ok('commit + flush');

  const undoneOnB = wait(b.socket, 'undo-applied');
  const undoneOnA = wait(a.socket, 'undo-applied');
  a.socket.emit('undo', { boardId: board.id });
  const undoB = await undoneOnB;
  const undoA = await undoneOnA;
  if (undoB.action !== 'delete' || undoB.elementId !== strokeId) fail('editor undo-applied', undoB);
  if (undoA.action !== 'delete' || undoA.canRedo !== true) fail('owner undo-applied', undoA);
  ok('collaborative undo');

  const redoneOnB = wait(b.socket, 'redo-applied');
  a.socket.emit('redo', { boardId: board.id });
  const redoB = await redoneOnB;
  if (redoB.action !== 'add' || redoB.element?.id !== strokeId) fail('editor redo-applied', redoB);
  if (redoB.canUndo !== true) fail('redo did not restore undo stack', redoB);
  ok('collaborative redo');

  a.socket.emit('leave-board');
  b.socket.emit('leave-board');
  await new Promise((r) => setTimeout(r, 400));
  a.socket.disconnect();
  b.socket.disconnect();

  const persisted = await json('GET', `/api/boards/${board.id}`, { token: ownerAuth.token });
  const drawing = (persisted.drawings || []).find((d) => d.id === strokeId || d.client_id === strokeId);
  if (!drawing) fail('stroke missing from Mongo after leave', persisted.drawings);
  ok('stroke persisted after leave');

  const c = await connectUser(editor);
  const live = [...(c.state.drawings || []), ...(c.state.elements || [])];
  if (!live.some((el) => el.id === strokeId || el.client_id === strokeId)) {
    fail('hydrate after rejoin missing stroke', c.state);
  }
  ok('hydrate after rejoin');

  const v = await connectUser(viewer);
  const sneak = wait(c.socket, 'element-added', 1500).then(
    (payload) => ({ leaked: true, payload }),
    () => ({ leaked: false })
  );
  v.socket.emit('drawing-start', {
    boardId: board.id,
    element: {
      id: `viewer-${Date.now()}`,
      type: 'pen',
      points: [{ x: 1, y: 1 }, { x: 2, y: 2 }],
      color: '#ff0000',
      strokeWidth: 2,
    },
  });
  const viewerResult = await sneak;
  if (viewerResult.leaked) fail('viewer drawing leaked to editor', viewerResult.payload);
  ok('viewer cannot start a stroke');

  c.socket.disconnect();
  v.socket.disconnect();
  console.log('PASS two-client collab');
} catch (error) {
  fail(error.message || String(error), error);
}
