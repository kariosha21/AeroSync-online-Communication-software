const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'super-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- PURE JS FILE DATABASE SYSTEM (SQLite Parity Mock) ---
class MockDatabase {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { users: [] };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(fileContent);
      } else {
        this.save();
      }
    } catch (err) {
      console.error("Error loading JSON database file, initializing empty:", err);
      this.data = { users: [] };
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error("Error writing JSON database file:", err);
    }
  }

  run(query, callback) {
    // Mock table creation queries
    if (callback) callback(null);
  }

  prepare(query) {
    const self = this;
    return {
      run: function(username, email, password, callback) {
        self.load();
        
        // UNIQUE check logic
        const exists = self.data.users.find(u => u.username === username || u.email === email);
        if (exists) {
          const err = new Error("UNIQUE constraint failed: Username or Email already exists");
          if (callback) callback.call({ lastID: null }, err);
          return;
        }

        const id = self.data.users.length + 1;
        const newUser = {
          id,
          username,
          email,
          password,
          created_at: new Date().toISOString()
        };

        self.data.users.push(newUser);
        self.save();

        if (callback) callback.call({ lastID: id }, null);
      },
      finalize: function() {
        // no-op
      }
    };
  }

  get(query, params, callback) {
    this.load();
    let user = null;
    
    if (query.includes('email = ?')) {
      const email = params[0];
      user = this.data.users.find(u => u.email === email);
    } else if (query.includes('id = ?')) {
      const id = params[0];
      user = this.data.users.find(u => u.id === id);
    }

    if (callback) {
      callback(null, user);
    }
  }
}

// Initialize database
const db = new MockDatabase(path.join(__dirname, 'database.json'));

// Middleware to verify JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied. Token missing.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

// --- AUTHENTICATION ROUTES ---

// Register Endpoint
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Hash password
  bcrypt.hash(password, 10, (err, hashedPassword) => {
    if (err) return res.status(500).json({ error: 'Password encryption failed' });

    const stmt = db.prepare(`INSERT INTO users (username, email, password) VALUES (?, ?, ?)`);
    stmt.run(username, email, hashedPassword, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username or Email already exists' });
        }
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ message: 'User registered successfully' });
    });
    stmt.finalize();
  });
});

// Login Endpoint
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    bcrypt.compare(password, user.password, (err, result) => {
      if (err) return res.status(500).json({ error: 'Authentication error' });
      if (!result) return res.status(400).json({ error: 'Invalid email or password' });

      // Generate JWT Token
      const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, username: user.username });
    });
  });
});

// Get User Profile
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get(`SELECT id, username, email, created_at FROM users WHERE id = ?`, [req.user.id],
