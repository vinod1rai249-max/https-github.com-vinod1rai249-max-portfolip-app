import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GitHub API Proxy
  app.get("/api/github/repos/:username", async (req, res) => {
    try {
      const { username } = req.params;
      const response = await axios.get(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100`);
      res.json(response.data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // Gemini AI Chat Proxy
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, profile } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured on server" });
      }

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: message }] }],
          systemInstruction: {
            parts: [{
              text: `You are an AI assistant for ${profile.name}'s portfolio. 
              Bio: ${profile.bio}. Role: ${profile.role}. 
              Answer questions about them professionally and enthusiastically. 
              Keep responses concise and formatted in markdown.
              If asked about projects, mention they are synced from GitHub and suggest relevant ones based on their query.
              If asked for a resume summary, provide a high-impact 3-bullet summary focusing on AI, Python, and Cloud skills.`
            }]
          }
        }
      );

      const aiResponse = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that.";
      res.json({ text: aiResponse });
    } catch (error: any) {
      console.error("Gemini API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ error: "Failed to connect to AI engine" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
