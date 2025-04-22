// 📁 FILE: parser-server.js

const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');

const app = express();
const upload = multer();

app.use(cors()); // allow requests from Next.js locally

// POST /extract
app.post('/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const data = await pdfParse(req.file.buffer);
    res.json({ text: data.text.trim() });
  } catch (err) {
    console.error('PDF Parse Error:', err.message);
    res.status(500).json({ error: 'Failed to parse PDF' });
  }
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`✅ PDF Parser Server running at http://localhost:${PORT}`);
});
