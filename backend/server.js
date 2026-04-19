const express = require('express');
const mariadb = require('mariadb');
const bcrypt = require('bcrypt');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'exampleuser',
  password: process.env.DB_PASSWORD || 'examplepass',
  database: process.env.DB_DATABASE || 'exampledb',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  connectionLimit: 5,
  acquireTimeout: 30000,
  waitForConnections: true,
  enableKeepAlive: true,
  keepAliveInterval: 30000
});

async function getConnectionWithRetry(retries = 15) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await pool.getConnection();
      return conn;
    } catch (err) {
      const isConnectionError = err.code === 'ECONNREFUSED' || err.code === 'ER_CANT_CREATE_THREAD' || err.message.includes('timeout');
      if (isConnectionError && i < retries - 1) {
        console.log(`DB not ready (attempt ${i + 1}/${retries}), retrying in 2s...`, err.message);
        await new Promise(res => setTimeout(res, 2000));
      } else {
        throw err;
      }
    }
  }
  throw new Error('Could not connect to DB after retries');
}

// Initialize database schema
async function initializeDatabase() {
  try {
    const conn = await getConnectionWithRetry();
    
    // Create users table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await conn.query(createTableSQL);
    console.log('✓ Database table "users" initialized successfully');
    conn.release();
  } catch (err) {
    console.error('✗ Failed to initialize database:', err.message);
    throw err;
  }
}

// Example: Register user
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const conn = await getConnectionWithRetry();
    await conn.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
    conn.release();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Example: Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const conn = await getConnectionWithRetry();
    const rows = await conn.query('SELECT * FROM users WHERE username = ?', [username]);
    conn.release();
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Example: Get all users (CRUD Read)
app.get('/api/users', async (req, res) => {
  try {
    const conn = await getConnectionWithRetry();
    const rows = await conn.query('SELECT id, username, created_at FROM users');
    conn.release();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await initializeDatabase();
  } catch (err) {
    console.error('Fatal: Database initialization failed. Exiting...');
    process.exit(1);
  }
});
