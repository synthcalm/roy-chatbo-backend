/* Updated style.css for Roy Chatbot UI - Revised for Poetic Batty Voice */

body {
  margin: 0;
  font-family: 'Courier New', monospace;
  background-color: black;
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.container {
  width: 90%;
  max-width: 600px;
  padding: 10px;
  border: 2px solid cyan;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
}

canvas {
  background-color: black;
  background-image: linear-gradient(to right, rgba(0, 255, 255, 0.3) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(0, 255, 255, 0.3) 1px, transparent 1px);
  background-size: 20px 20px;
  border: 1px solid cyan;
}

#messages {
  height: 150px;
  overflow-y: auto;
  border: 1px solid cyan;
  padding: 8px;
  font-size: 14px;
  line-height: 1.6;
}

#messages p.roy strong {
  color: cyan;
}

#messages p.user strong {
  color: white;
}

.input-area {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: stretch;
  width: 100%;
}

#user-input {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid cyan;
  background: black;
  color: yellow;
  font-family: 'Courier New', monospace;
  height: 96px;
  box-sizing: border-box;
}

select.button, button.button {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  padding: 10px 18px;
  background: black;
  color: cyan;
  border: 2px solid cyan;
  border-radius: 6px;
  cursor: pointer;
  height: 44px;
  flex: 1;
  transition: all 0.2s ease-in-out;
}

button.button.active {
  background-color: red;
  color: white;
  border-color: red;
}

.button-group {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
}

.title-bar {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: yellow;
  margin-bottom: 10px;
}

@media (max-width: 768px) {
  .container {
    width: 95%;
  }
  #messages {
    font-size: 13px;
  }
  select.button, button.button {
    font-size: 12px;
    padding: 8px;
  }
  #user-input {
    font-size: 14px;
  }
}
