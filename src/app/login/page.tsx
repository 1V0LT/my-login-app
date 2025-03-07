"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect them
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleLogin = () => {
    if ((username === "ibrahim" || username === "x" || username === "Ibrahim") && password === "123") {
      localStorage.setItem("username", username);
      router.push("/dashboard");
    } else {
      setError("Invalid username or password");
    }
  };

  // When Enter is pressed inside the password input, attempt login
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-bl from-blue-400 via-blue-500 to-indigo-600 text-black">
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="bg-white p-8 rounded-2xl shadow-2xl w-96 text-black"
      >
        <h2 className="text-3xl font-bold text-center mb-6 text-black">
          Welcome Back
        </h2>
        <div className="mb-4">
          <label className="block text-black font-semibold">Username</label>
          <input
            type="text"
            className="w-full px-4 py-2 mt-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="mb-6">
          <label className="block text-black font-semibold">Password</label>
          <input
            type="password"
            className="w-full px-4 py-2 mt-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="text-red-500 text-center mb-4"
          >
            {error}
          </motion.p>
        )}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
        >
          Login
        </motion.button>
      </motion.div>
    </div>
  );
}
