/**
 * Reno Dev Space Socket.IO Relay Server
 *
 * Handles:
 * - Chat messages (per-room persistence)
 * - Real-time message sync
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// ============================================
// Configuration
// ============================================

const PORT = process.env.PORT || 8080;

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://cwcorella-git.github.io',
];

// ============================================
// Database Setup (sql.js - pure JavaScript SQLite)
// ============================================

let db = null;
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'chat.db');

async function initDatabase() {
  const SQL = await initSqlJs();

  try {
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(fileBuffer);
      console.log('[Relay Server] Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('[Relay Server] Created new database');
    }
  } catch (err) {
    console.warn('[Relay Server] Could not load database, creating new:', err.message);
    db = new SQL.Database();
  }

  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      room TEXT NOT NULL,
      text TEXT NOT NULL,
      username TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room);
    CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
  `);

  // Save database periodically
  setInterval(() => {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbPath, buffer);
    } catch (err) {
      console.error('[Relay Server] Failed to save database:', err.message);
    }
  }, 30000); // Save every 30 seconds

  console.log('[Relay Server] Database initialized');
}

// ============================================
// Message Functions
// ============================================

function getMessages(room, limit = 100) {
  const stmt = db.prepare(`
    SELECT id, room, text, username, timestamp
    FROM messages
    WHERE room = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  stmt.bind([room, limit]);

  const messages = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    messages.push(row);
  }
  stmt.free();

  return messages.reverse();
}

function saveMessage(message) {
  try {
    db.run(
      `INSERT OR REPLACE INTO messages (id, room, text, username, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [message.id, message.room, message.text, message.username, message.timestamp]
    );
    return true;
  } catch (err) {
    console.error('[Relay Server] Failed to save message:', err.message);
    return false;
  }
}

function deleteMessage(messageId, username) {
  try {
    // Only allow users to delete their own messages
    db.run(
      `DELETE FROM messages WHERE id = ? AND username = ?`,
      [messageId, username]
    );
    return true;
  } catch (err) {
    console.error('[Relay Server] Failed to delete message:', err.message);
    return false;
  }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// Socket.IO Server
// ============================================

async function startServer() {
  await initDatabase();

  const httpServer = createServer((req, res) => {
    // Health check endpoint
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        if (ALLOWED_ORIGINS.includes(origin) || origin.includes('github.io') || origin.includes('localhost')) {
          callback(null, true);
        } else {
          console.log('[Relay Server] Blocked origin:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Relay Server] Client connected: ${socket.id}`);

    // Join a room
    socket.on('join_room', ({ room }) => {
      socket.join(room);
      console.log(`[Relay Server] ${socket.id} joined room: ${room}`);

      // Send message history
      const messages = getMessages(room);
      socket.emit('message_history', { messages });
    });

    // Send a message
    socket.on('send_message', ({ room, text, username }) => {
      const message = {
        id: generateId(),
        room,
        text,
        username,
        timestamp: Date.now()
      };

      if (saveMessage(message)) {
        // Broadcast to all users in the room (including sender)
        io.to(room).emit('new_message', { message });
        console.log(`[Relay Server] Message in ${room} from ${username}`);
      } else {
        socket.emit('error', { code: 'SAVE_FAILED', message: 'Failed to save message' });
      }
    });

    // Delete a message
    socket.on('delete_message', ({ room, messageId, username }) => {
      if (deleteMessage(messageId, username)) {
        io.to(room).emit('message_deleted', { messageId });
        console.log(`[Relay Server] Message deleted: ${messageId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Relay Server] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(PORT, () => {
    console.log(`[Relay Server] Running on port ${PORT}`);
    console.log(`[Relay Server] Allowed origins:`, ALLOWED_ORIGINS);
  });
}

startServer().catch(console.error);
