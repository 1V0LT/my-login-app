"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { JOBS_DATA } from "../../../data/jobs"; // Adjust path if needed

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);

  useEffect(() => {
    if (!id) {
      router.push("/dashboard");
      return;
    }

    const jobData = JOBS_DATA.find((j) => j.id === Number(id));
    if (!jobData) {
      router.push("/dashboard");
      return;
    }

    setJob(jobData);
  }, [id, router]);

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-700">Loading job details...</p>
      </div>
    );
  }

  return (
    <motion.div className="bg-gray-50 min-h-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="max-w-6xl mx-auto pt-10 pb-20 px-4">
        {/* Back Button */}
        <div className="flex items-center space-x-4 mb-8">
          <button onClick={() => router.push("/dashboard")} className="text-blue-600 hover:underline">
            &larr; Back to Jobs List
          </button>
        </div>

        {/* Job Header */}
        <div className="mb-10 bg-white p-6 rounded shadow">
          {job.featured && (
            <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
              FEATURED
            </span>
          )}
          <h1 className="text-3xl font-bold text-blue-600 mt-2">{job.title}</h1>
          <p className="text-gray-600 text-xl mt-1">{job.company} - {job.location}</p>
          <p className="text-gray-400 mt-1">Posted {job.datePosted}</p>
          <p className="text-sm font-semibold text-blue-500 mt-2">{job.category}</p>
        </div>

        {/* Job Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Description & Skills */}
          <div className="col-span-2 bg-white p-6 rounded shadow space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-3">About this role</h2>
              <div className="text-gray-700 space-y-2" dangerouslySetInnerHTML={{ __html: job.description }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-3">Requirements to apply</h2>
              <div className="text-gray-700 space-y-2" dangerouslySetInnerHTML={{ __html: job.requirements }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill: string) => (
                  <span key={skill} className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm">{skill}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Education, Visa, Apply */}
          <div className="bg-white p-6 rounded shadow space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-3">Education and Skills</h2>
              <div className="grid grid-cols-3 gap-y-2 text-sm">
                <span className="font-semibold text-gray-600">Degree</span>
                <span className="col-span-2 text-gray-800">{job.degree}</span>
                <span className="font-semibold text-gray-600">Qualifications</span>
                <span className="col-span-2 text-gray-800">{job.qualifications}</span>
                <span className="font-semibold text-gray-600">Experience</span>
                <span className="col-span-2 text-gray-800">{job.experience}</span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Visa</h2>
              <div className="flex flex-wrap gap-2">
                {job.visaOptions.map((visa: string) => (
                  <span key={visa} className="border border-gray-300 rounded px-3 py-1 text-sm text-gray-600">
                    {visa}
                  </span>
                ))}
              </div>
            </div>

            <div className="text-center">
              <button
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition"
                onClick={() => router.push("/chat")}
              >
                Apply now
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
