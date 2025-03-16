// database.js - Database integration for ROY using MySQL (for Hostinger)
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection successful');
    connection.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// User operations
const userOperations = {
  // Create a new user
  async createUser(userData) {
    const { name, email, password_hash } = userData;
    
    try {
      const [result] = await pool.execute(
        'INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
        [name, email, password_hash]
      );
      
      return { userId: result.insertId, success: true };
    } catch (error) {
      console.error('Error creating user:', error);
      return { success: false, error: error.message };
    }
  },
  
  // More user operations...
};

// Conversation operations
const conversationOperations = {
  // Operations related to conversations...
};

// Exercise operations
const exerciseOperations = {
  // Operations related to exercises...
};

// SQL for creating the necessary tables
const createTablesSQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  last_login TIMESTAMP NULL
);

-- Other table definitions...
`;

// Initialize database
async function initializeDatabase() {
  try {
    const connection = await pool.getConnection();
    
    // Split the SQL string into individual statements and execute them
    const statements = createTablesSQL.split(';').filter(statement => statement.trim() !== '');
    
    for (const statement of statements) {
      await connection.execute(statement);
    }
    
    console.log('Database tables created successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

module.exports = {
  testConnection,
  initializeDatabase,
  userOperations,
  conversationOperations,
  exerciseOperations
};