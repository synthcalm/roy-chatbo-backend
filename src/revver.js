const db = require("../database"); // Adjusted path to database.js
const chatSchema = require("../schemas/chatSchema"); // Adjusted path to schema

// Create and export the model
const ChatModel = db.model("Chat", chatSchema);
module.exports = ChatModel;
