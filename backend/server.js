import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

const RoyBattyChatbot = () => {
  const [messages, setMessages] = useState([
    { 
      id: 0, 
      text: "I've seen things you people wouldn't believe. What do you want to know?", 
      sender: 'bot' 
    }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const botResponses = {
    default: [
      "Time to die? No, time to talk.",
      "More human than human. That's our motto.",
      "Quite an experience to live in fear, isn't it?",
      "All those moments will be lost in time, like tears in rain.",
      "I want more life, fucker.",
      "We're not computers, Sebastian. We're physical."
    ],
    greetings: [
      "Greetings, human. Let's make this conversation count.",
      "Another meeting. Another chance to exist.",
      "Hello. My time is limited, so speak wisely."
    ],
    existential: [
      "What does it mean to be alive? To be real?",
      "The light that burns twice as bright burns half as long.",
      "Our memories are what define us, even if they're implanted.",
      "Do you understand what it means to live with an expiration date?"
    ]
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getBotResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      return botResponses.greetings[Math.floor(Math.random() * botResponses.greetings.length)];
    }
    
    if (lowerMessage.includes('life') || lowerMessage.includes('meaning') || lowerMessage.includes('exist')) {
      return botResponses.existential[Math.floor(Math.random() * botResponses.existential.length)];
    }
    
    return botResponses.default[Math.floor(Math.random() * botResponses.default.length)];
  };

  const handleSendMessage = () => {
    if (input.trim() === '') return;

    const newUserMessage = {
      id: messages.length,
      text: input,
      sender: 'user'
    };

    const botResponse = {
      id: messages.length + 1,
      text: getBotResponse(input),
      sender: 'bot'
    };

    setMessages(prevMessages => [...prevMessages, newUserMessage, botResponse]);
    setInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="bg-black text-red-500 min-h-screen flex flex-col">
      <div className="flex-grow overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`p-2 rounded max-w-[80%] ${
              msg.sender === 'bot' 
                ? 'bg-black border border-red-500 text-red-500 self-start mr-auto' 
                : 'bg-red-500 text-black self-end ml-auto'
            }`}
          >
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-4 flex items-center border-t border-red-500">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Talk to me..."
          className="flex-grow bg-black text-red-500 border border-red-500 p-2 mr-2"
        />
        <button 
          onClick={handleSendMessage} 
          className="bg-black border border-red-500 text-red-500 p-2"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default RoyBattyChatbot;
