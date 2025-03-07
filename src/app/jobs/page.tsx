"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Ideally, you’d fetch this from an API or a database.
// For the sake of demonstration, keep the same data here as in Dashboard.
import { JOBS_DATA } from "@/shared";

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    // If no ID or invalid ID, redirect or handle error
    if (!id) {
      router.push("/dashboard");
      return;
    }
    // Find job by ID
    const jobData = JOBS_DATA.find((job) => job.id === Number(id));
    if (!jobData) {
      router.push("/dashboard");
      return;
    }
    setJob(jobData);
  }, [id, router]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading job details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pt-8">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded shadow">
        <img
          src={job.imageUrl}
          alt={job.title}
          className="w-full h-64 object-cover rounded"
        />
        <h1 className="text-2xl font-bold mt-4 mb-2">{job.title}</h1>
        <p className="text-blue-600 font-semibold">{job.company}</p>
        <p className="text-gray-500">{job.location}</p>
        <p className="text-sm text-gray-400 mt-2">
          Date Posted: {job.datePosted}
        </p>
        <div className="mt-4">
          <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm">
            {job.category}
          </span>
          {job.featured && (
            <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded ml-2">
              FEATURED
            </span>
          )}
        </div>
        <p className="mt-6 text-gray-700 leading-relaxed">{job.description}</p>

        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
