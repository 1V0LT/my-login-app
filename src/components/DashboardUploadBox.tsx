"use client";

import { useState } from "react";

interface DashboardUploadBoxProps {
  onRecommend?: (text: string) => void;
}

export default function DashboardUploadBox({ onRecommend }: DashboardUploadBoxProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.file as HTMLInputElement;

    if (!fileInput?.files?.[0]) return;

    const formData = new FormData();
    formData.append("file", fileInput.files[0]);

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const contentType = res.headers.get("content-type");

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "API returned error");
      }

      if (contentType?.includes("application/json")) {
        const data = await res.json();
        setText(data.text || data.error || "No result");
        onRecommend?.(data.text);
      } else {
        const fallbackText = await res.text();
        setText(fallbackText || "No result");
        onRecommend?.(fallbackText);
      }
    } catch (err: any) {
      console.error("Upload failed:", err);
      setText("");
      setError("Failed to upload and analyze file.");
    }

    setLoading(false);
  };

  return (
    <div className="bg-white rounded shadow p-6 my-8 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">📄 Upload CV or Transcript</h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <input
          name="file"
          type="file"
          accept="application/pdf"
          className="block w-full"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Analyzing..." : "Analyze PDF"}
        </button>
      </form>

      {error && (
        <div className="mt-4 bg-red-100 text-red-700 p-3 rounded">
          {error}
        </div>
      )}

      {text && (
        <div className="mt-6">
          <h3 className="font-semibold mb-2">📝 Extracted Text:</h3>
          <pre className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto text-sm whitespace-pre-wrap">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}