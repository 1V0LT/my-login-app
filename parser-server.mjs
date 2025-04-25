import express from "express";
import multer from "multer";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const app = express();
const upload = multer();
app.use(cors());

const OLLAMA_API = "http://127.0.0.1:11434/api/chat";
const MODEL = "llama3";

// ✅ Load jobs data from JSON
const JOBS_DATA = JSON.parse(
  fs.readFileSync(path.resolve("src/data/jobs-data.json"), "utf-8")
);

function getPrompt(cvText, jobsData) {
  return `
You are a job-matching assistant AI.
Rate the CV against each internship (0 to 100) and return JSON only.
make the rating 45 as minimum and 90 as maximum.

[
  { "id": 1, "match": 90 },
  { "id": 2, "match": 45 }
]

CV:
${cvText}

Jobs:
${JSON.stringify(
    jobsData.map(({ id, title, description, requirements, skills }) => ({
      id, title, description, requirements, skills
    }))
  )}
`;
}

app.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const data = await pdfParse(req.file.buffer);
    const cvText = data.text.trim();
    const prompt = getPrompt(cvText, JOBS_DATA);

    const response = await fetch(OLLAMA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
    });

    const result = await response.json();
    const matchResponse = result.message?.content;

    let parsed;
    try {
      parsed = JSON.parse(matchResponse);
    } catch {
      return res.json({
        jobs: JOBS_DATA.map((job) => ({
          id: job.id,
          match: Math.floor(Math.random() * 100) + 1
        }))
      });
    }

    res.json({ jobs: parsed });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(4000, () => {
  console.log("✅ Parser AI Server running at http://localhost:4000");
});
