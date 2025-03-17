// schemas/chatSchema.js
const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema({
  message: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = chatSchema;
