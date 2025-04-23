"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JOBS_DATA } from "../../data/jobs"; // ✅ correct relative path

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("search");
  const [username, setUsername] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState(JOBS_DATA);
  const [sortBy, setSortBy] = useState("");
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("username");
    setUsername("");
    router.push("/login");
  };

  const filteredJobs = jobs.filter((job) => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      job.title.toLowerCase().includes(lowerSearch) ||
      job.company.toLowerCase().includes(lowerSearch) ||
      job.location.toLowerCase().includes(lowerSearch) ||
      job.category.toLowerCase().includes(lowerSearch)
    );
  });

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === "date") {
      return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
    }
    if (sortBy === "city") {
      return a.location.localeCompare(b.location);
    }
    return 0;
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.jobs) {
        setRecommendations(data.jobs);
      } else {
        alert("No jobs matched.");
      }
    } catch (err) {
      alert("Failed to analyze file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      <nav className="flex items-center justify-between px-8 py-6 bg-white shadow-md relative">
        <h1 className="text-2xl font-bold text-blue-600">Internship Hub</h1>
        <div>
          {username ? (
            <button
              onClick={handleLogout}
              className="border border-red-600 text-red-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-red-50 text-base font-medium"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/login"
              className="border border-blue-600 text-blue-600 px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-50 text-base font-medium"
            >
              Log in
            </Link>
          )}
        </div>
      </nav>

      {username && (
        <div className="text-center mt-6 text-xl font-semibold text-gray-700">
          Hello, {username}!
        </div>
      )}

      <div className="flex justify-center space-x-8 mt-6 border-b">
        {["search", "saved", "alerts"].map((tab) => (
          <button
            key={tab}
            className={`pb-2 text-lg font-semibold ${
              activeTab === tab
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "search" && (
        <>
          <div className="flex justify-center mt-6">
            <input
              type="text"
              placeholder="Search for keywords, skills, companies and more"
              className="w-2/3 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex justify-center mt-4 space-x-4">
            <button onClick={() => setSortBy("date")} className="border px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200">Date posted</button>
            <button onClick={() => setSortBy("city")} className="border px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200">City</button>
            <button onClick={() => setSortBy("")} className="border px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200">Clear Sort</button>
          </div>

          {/* PDF UPLOAD BUTTON */}
          <div className="text-center mt-6">
            <label className="inline-block cursor-pointer bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              {loading ? "Analyzing..." : "Upload CV/Transcript to Get Job Suggestions"}
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </div>

          {/* JOB RECOMMENDATIONS */}
          {recommendations.length > 0 && (
            <div className="mt-10 px-8">
              <h2 className="text-xl font-semibold mb-4">Recommended Jobs for You</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {recommendations.map((rec) => {
                  const job = jobs.find((j) => j.id === rec.id);
                  if (!job) return null;
                  return (
                    <Link href={`/jobs/${job.id}`} key={job.id}>
                      <div className="bg-white p-4 rounded shadow hover:shadow-md">
                        <h3 className="font-semibold text-lg">{job.title}</h3>
                        <p className="text-blue-600">{job.company}</p>
                        <p className="text-sm text-gray-500">{job.location}</p>
                        <p className="mt-2 text-green-600 text-sm font-medium">Match: {rec.match}%</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* JOB LISTINGS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 py-8">
            {sortedJobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition cursor-pointer"
              >
                <Link href={`/jobs/${job.id}`}>
                  <div>
                    {job.featured && (
                      <span className="bg-yellow-200 text-yellow-800 text-xs font-bold px-2 py-1 rounded">
                        FEATURED
                      </span>
                    )}
                    <img
                      src={job.imageUrl}
                      alt={job.title}
                      className="w-full h-40 object-cover mt-3 rounded"
                    />
                    <h3 className="text-lg font-semibold mt-4">{job.title}</h3>
                    <p className="text-blue-600">{job.company}</p>
                    <p className="text-gray-500">{job.location}</p>
                    <p className="text-sm text-gray-400 mt-2">Date Posted: {job.datePosted}</p>
                    <div className="mt-4">
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm">{job.category}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {activeTab === "saved" && (
        <div className="text-center mt-6 text-lg text-gray-500">
          You have not saved any jobs yet.
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="text-center mt-6 text-lg text-gray-500">
          You have no new alerts.
        </div>
      )}
    </div>
  );
}
