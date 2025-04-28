'use client';

import { useState } from 'react';

export default function TestFileReader() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.file as HTMLInputElement;

    if (!fileInput?.files?.[0]) {
      console.log('No file selected.');
      return;
    }

    setLoading(true);
    console.log('File upload started.');

    try {
      const file = fileInput.files[0];
      console.log(`File selected: ${file.name}`);

      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64File = (reader.result as string).split(',')[1];

        // Send the file to the server
        const response = await fetch('/api/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64File }),
        });

        if (!response.ok) {
          throw new Error('Failed to extract text');
        }

        const data = await response.json();
        setText(data.text);
        console.log('Text extraction successful.');
      };
    } catch (err: any) {
      console.error('Failed to parse PDF:', err);
      setText('Error: ' + (err.message || 'Unknown error'));
    }

    setLoading(false);
    console.log('File upload process completed.');
  };

  return (
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-md p-6 w-full max-w-xl">
        <h1 className="text-2xl font-bold mb-4">📄 PDF Text Extractor</h1>
        <form onSubmit={handleUpload} className="space-y-4">
          <input
            name="file"
            type="file"
            accept="application/pdf"
            className="block w-full"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Upload PDF'}
          </button>
        </form>

        {text && (
          <div className="mt-6">
            <h2 className="font-semibold mb-2">📝 Extracted Text:</h2>
            <pre className="bg-gray-200 p-4 rounded max-h-96 overflow-y-auto whitespace-pre-wrap text-sm">
              {text}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
