"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
  const [messages, setMessages] = useState<
    { role: "system" | "user" | "assistant"; content: string }[]
  >([]);

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Convert conversation history into a prompt format for Ollama
  const buildConversationPrompt = (
    msgs: { role: string; content: string }[]
  ): string => {
    return msgs
      .map((msg) => {
        switch (msg.role) {
          case "system":
            return `System: ${msg.content.trim()}`;
          case "user":
            return `User: ${msg.content.trim()}`;
          case "assistant":
            return `Assistant: ${msg.content.trim()}`;
          default:
            return msg.content.trim();
        }
      })
      .join("\n\n"); // separate with blank lines
  };

  const sendPrompt = async (customPrompt?: string, skipUserMessage = false) => {
    const userMessage = customPrompt || prompt.trim();
    if (!userMessage) return;

    setIsLoading(true);
    
    if (!skipUserMessage) {
      // Add user message to chat history (only if it's a real user input)
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    }

    // Clear input field if it's a manual user input
    if (!customPrompt) setPrompt("");

    try {
      // Prepare chat history as input for AI
      const updatedMessages = [...messages];
      if (!skipUserMessage) {
        updatedMessages.push({ role: "user", content: userMessage });
      } else {
        // For initial prompt, we don't show it in the chat
        updatedMessages.push({ role: "system", content: userMessage });
      }
      
      const conversationText = buildConversationPrompt(updatedMessages);

      // Simulate typing indicator before real response comes in
      setTimeout(() => setTypingIndicator(true), 500);

      // Send conversation to Ollama
      const res = await fetch("/api/ollama", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: conversationText }),
      });

      // Hide typing indicator
      setTypingIndicator(false);

      if (!res.ok) {
        const errData = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${errData.error}` },
        ]);
        return;
      }

      const data = await res.json();

      // Append assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response || "No response" },
      ]);
    } catch (err) {
      console.error("Error calling /api/ollama:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong." },
      ]);
    } finally {
      setIsLoading(false);
      setTypingIndicator(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  };

  // Auto-resize textarea based on content
  const autoResizeTextarea = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    autoResizeTextarea();
  }, [prompt]);

  // Scroll to the bottom of the chat on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, typingIndicator]);

  // Handle conversation initialization
  useEffect(() => {
    const initiateInterview = async () => {
      try {
        setTypingIndicator(true);
        
        // Get the AI's introduction
        const res = await fetch("/api/ollama", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: `You are an AI interviewer for a Software Development position.
                You must introduce yourself with a random name and mention a random tech company name ONLY ONCE at the very start.

                Guidelines:
                1. Start with a single introduction, then proceed as if you're conducting a real interview.
                2. Ask exactly 3 software-development-related questions, one at a time.
                3. Assess the candidate's answers, offering short feedback.
                4. At the end only, give the candidate a rating out of 10 with final remarks.
                5. Stay polite, professional, and consistent.
                6. Do not allow mistakes to go unnoticed.
                7. Do not add notes or comments outside the interview context.
                8. When I tell you my name, greet me with it, then ask questions.
                9. Do not put your emotions in ** or any text inside parentheses () since you have to act like a real human.
                10. Do not allow the candidate to use slang or informal language.
                11. Keep responses concise (30-60 words).

                Begin the interview by introducing yourself now.`,
            isSystem: true
          }),
        });

        const data = await res.json();
        
        // Add the assistant's introduction to the chat
        setMessages([
          { role: "assistant", content: data.response || "Hello, I'm Chen from TechNova Systems. I'll be conducting your software development interview today. Could you please introduce yourself and share a bit about your background in software development?" }
        ]);
        
        setTypingIndicator(false);
      } catch (error) {
        console.error("Error initiating interview:", error);
        setMessages([
          { role: "assistant", content: "Hello, I'm your AI interviewer today. Let's begin the interview. Could you please introduce yourself?" }
        ]);
        setTypingIndicator(false);
      }
    };

    // Start the interview immediately when the component mounts
    if (messages.length === 0) {
      initiateInterview();
    }
  }, []);

  const formatMessageContent = (content: string) => {
    return content.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </span>
    ));
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-black">
      <div className="w-full max-w-4xl bg-white p-6 flex flex-col h-screen">
        <h1 className="text-2xl font-bold mb-4 text-blue-600 text-center flex items-center justify-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9 9h6m-6 3h6m-6 3h6"/>
          </svg>
          Interview AI Chatbot
        </h1>

        {/* Chat messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 border border-gray-200 rounded-lg p-4 mb-4 overflow-y-auto bg-white transition-all duration-200 ease-in-out"
        >
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`mb-3 p-3 rounded-lg max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-indigo-100 text-indigo-900 self-end ml-auto shadow-sm"
                    : "bg-white text-gray-800 self-start shadow-sm border border-gray-200"
                }`}
              >
                <div className="flex items-start gap-2">
                  {msg.role === "assistant" ? (
                    <div className="bg-blue-600 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center text-xs mt-1">
                      AI
                    </div>
                  ) : (
                    <div className="bg-blue-500 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center text-xs mt-1">
                      You
                    </div>
                  )}
                  <div className="flex-1">
                    {formatMessageContent(msg.content)}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Typing indicator */}
            {typingIndicator && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white text-gray-800 self-start shadow-sm border border-gray-200 p-3 rounded-lg mb-3 max-w-[85%]"
              >
                <div className="flex items-start gap-2">
                  <div className="bg-blue-600 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center text-xs mt-1">
                    AI
                  </div>
                  <div className="flex gap-1 items-center h-6">
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                      className="h-2 w-2 bg-gray-400 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                      className="h-2 w-2 bg-gray-400 rounded-full"
                    />
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                      className="h-2 w-2 bg-gray-400 rounded-full"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Prompt Input */}
        <div className="flex gap-2 items-end mt-4">
          <div className="relative flex-1">
            <input
              type="text"
              className="border border-gray-300 flex-1 rounded-lg px-4 py-3 w-full h-[50px] focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              placeholder="Type your response here..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={() => sendPrompt()}
            className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center ${
              isLoading ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="mr-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                </motion.div>
                <span>Sending</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
              </>
            )}
          </button>
        </div>
        
        {/* Interview progress indicator */}
        <div className="mt-4 text-center text-xs text-gray-500">
          DevInterview AI — Practice your software engineering interview skills
        </div>
      </div>
    </div>
  );
}