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
  port: process.env.DB_PORT || 3306,
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

  // Get user by ID
  async getUserById(userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  },

  // Get user by email
  async getUserByEmail(email) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching user by email:', error);
      throw error;
    }
  },

  // Update user information
  async updateUser(userId, updateData) {
    try {
      const [result] = await pool.execute(
        'UPDATE users SET ? WHERE id = ?',
        [updateData, userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Delete user
  async deleteUser(userId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM users WHERE id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};

// Conversation operations
const conversationOperations = {
  // Create new conversation
  async createConversation(userId, conversationData) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO conversations (user_id, title, created_at) VALUES (?, ?, NOW())',
        [userId, conversationData.title]
      );
      return { conversationId: result.insertId, success: true };
    } catch (error) {
      console.error('Error creating conversation:', error);
      return { success: false, error: error.message };
    }
  },

  // Get conversation by ID
  async getConversationById(conversationId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM conversations WHERE id = ?',
        [conversationId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  },

  // Get all conversations for user
  async getConversationsByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  },

  // Update conversation
  async updateConversation(conversationId, updateData) {
    try {
      const [result] = await pool.execute(
        'UPDATE conversations SET ? WHERE id = ?',
        [updateData, conversationId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating conversation:', error);
      throw error;
    }
  },

  // Delete conversation
  async deleteConversation(conversationId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM conversations WHERE id = ?',
        [conversationId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting conversation:', error);
      throw error;
    }
  }
};

// Exercise operations
const exerciseOperations = {
  // Create new exercise
  async createExercise(userId, exerciseData) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO exercises (user_id, exercise_type, duration, intensity, created_at) VALUES (?, ?, ?, ?, 
NOW())',
        [userId, exerciseData.exercise_type, exerciseData.duration, exerciseData.intensity]
      );
      return { exerciseId: result.insertId, success: true };
    } catch (error) {
      console.error('Error creating exercise:', error);
      return { success: false, error: error.message };
    }
  },

  // Get exercise by ID
  async getExerciseById(exerciseId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM exercises WHERE id = ?',
        [exerciseId]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching exercise:', error);
      throw error;
    }
  },

  // Get all exercises for user
  async getExercisesByUserId(userId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM exercises WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );
      return rows;
    } catch (error) {
      console.error('Error fetching exercises:', error);
      throw error;
    }
  },

  // Update exercise
  async updateExercise(exerciseId, updateData) {
    try {
      const [result] = await pool.execute(
        'UPDATE exercises SET ? WHERE id = ?',
        [updateData, exerciseId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating exercise:', error);
      throw error;
    }
  },

  // Delete exercise
  async deleteExercise(exerciseId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM exercises WHERE id = ?',
        [exerciseId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting exercise:', error);
      throw error;
    }
  }
};

module.exports = {
  pool,
  testConnection,
  userOperations,
  conversationOperations,
  exerciseOperations
};
