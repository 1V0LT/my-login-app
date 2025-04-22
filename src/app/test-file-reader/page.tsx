'use client';

import { useState } from 'react';

export default function TestFileReader() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.file as HTMLInputElement;

    if (!fileInput?.files?.[0]) return;

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);

    setLoading(true);

    try {
      const res = await fetch('http://localhost:4000/extract', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || 'API returned error');
      }

      const data = await res.json();
      setText(data.text || 'No result');
    } catch (err: any) {
      console.error('Upload failed:', err);
      setText('Error: ' + (err.message || 'Unknown error'));
    }

    setLoading(false);
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
