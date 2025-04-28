import { NextApiRequest, NextApiResponse } from 'next';
import pdf from 'pdf-parse';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const file = req.body.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Decode the base64 file
    const buffer = Buffer.from(file, 'base64');

    // Extract text using pdf-parse
    const data = await pdf(buffer);
    res.status(200).json({ text: data.text || 'No text found in the PDF.' });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
