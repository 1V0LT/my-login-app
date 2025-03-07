"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Updated job data with 6 jobs
const JOBS_DATA = [
  {
    id: 1,
    title: "Marketing & Media Coordinator",
    company: "United Global Services Company",
    location: "Dubai, AE",
    datePosted: "2025-03-01",
    category: "Marketing",
    featured: true,
    imageUrl: "/images/Job.jpg", // Make sure this file actually exists
    description:
      "Join our dynamic marketing team to shape our media strategy and brand presence."
  },
  {
    id: 2,
    title: "Frontend Developer Intern",
    company: "Tech Solutions Inc.",
    location: "New York, US",
    datePosted: "2025-02-28",
    category: "Software",
    featured: true,
    imageUrl: "/images/Job.jpg",
    description:
      "Work with our senior developers to build world-class applications for our clients."
  },
  {
    id: 3,
    title: "DevOps Engineer Intern",
    company: "Cloud Innovators",
    location: "Berlin, DE",
    datePosted: "2025-03-03",
    category: "DevOps",
    featured: true,
    imageUrl: "/images/Job.jpg",
    description:
      "Help maintain and evolve our cloud infrastructure, CI/CD pipelines, and monitoring solutions."
  },
  {
    id: 4,
    title: "UI/UX Designer Intern",
    company: "Creative Studio",
    location: "San Francisco, US",
    datePosted: "2025-03-02",
    category: "Design",
    featured: false,
    imageUrl: "/images/Job.jpg",
    description:
      "Collaborate with product managers and developers to create intuitive and engaging user interfaces."
  },
  {
    id: 5,
    title: "Data Analyst Intern",
    company: "Finance Corp",
    location: "London, UK",
    datePosted: "2025-02-20",
    category: "Data",
    featured: false,
    imageUrl: "/images/Job.jpg",
    description:
      "Work with large datasets to derive insights that drive financial decisions."
  },
  {
    id: 6,
    title: "Business Development Intern",
    company: "Global Ventures",
    location: "Singapore, SG",
    datePosted: "2025-02-15",
    category: "Sales",
    featured: false,
    imageUrl: "/images/Job.jpg", // Example if your actual file is "Job.jpg"
    description:
      "Assist in identifying new business opportunities and strategic partnerships."
  }
];

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"search" | "saved" | "alerts">(
    "search"
  );
  const [username, setUsername] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState(JOBS_DATA);
  const [sortBy, setSortBy] = useState("");

  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      // If no user is logged in, redirect to login
      router.push("/login");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("username");
    setUsername("");
    router.push("/login");
  };

  // Filter jobs based on the search term
  const filteredJobs = jobs.filter((job) => {
    const lowerSearch = searchTerm.toLowerCase();
    return (
      job.title.toLowerCase().includes(lowerSearch) ||
      job.company.toLowerCase().includes(lowerSearch) ||
      job.location.toLowerCase().includes(lowerSearch) ||
      job.category.toLowerCase().includes(lowerSearch)
    );
  });

  // Sort the filtered jobs based on `sortBy`
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === "date") {
      // Sort by most recent date first
      return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
    }
    if (sortBy === "city") {
      return a.location.localeCompare(b.location);
    }
    // Default: no sort
    return 0;
  });

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* NAVBAR */}
      <nav className="flex items-center justify-between px-8 py-6 bg-white shadow-md relative">
        <h1 className="text-2xl font-bold text-blue-600">
          Internship Hub
        </h1>
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

      {/* WELCOME */}
      {username && (
        <div className="text-center mt-6 text-xl font-semibold text-gray-700">
          Hello, {username}!
        </div>
      )}

      {/* TABS */}
      <div className="flex justify-center space-x-8 mt-6 border-b">
        {[
          { name: "Search", key: "search" },
          { name: "Saved", key: "saved" },
          { name: "Alerts", key: "alerts" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`pb-2 text-lg font-semibold ${
              activeTab === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab(tab.key as "search" | "saved" | "alerts")}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* SEARCH TAB CONTENT */}
      {activeTab === "search" && (
        <>
          {/* SEARCH BAR */}
          <div className="flex justify-center mt-6">
            <input
              type="text"
              placeholder="Search for keywords, skills, companies and more"
              className="w-2/3 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* FILTERS / SORT */}
          <div className="flex justify-center mt-4 space-x-4">
            <button
              onClick={() => setSortBy("date")}
              className="border px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200"
            >
              Date posted
            </button>
            <button
              onClick={() => setSortBy("city")}
              className="border px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200"
            >
              City
            </button>
            <button
              onClick={() => setSortBy("")}
              className="border px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-200"
            >
              Clear Sort
            </button>
          </div>

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
                  {/* If you use next/image, swap <img> with <Image> */}
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
                    <h3 className="text-lg font-semibold mt-4">
                      {job.title}
                    </h3>
                    <p className="text-blue-600">{job.company}</p>
                    <p className="text-gray-500">{job.location}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Date Posted: {job.datePosted}
                    </p>
                    <div className="mt-4">
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm">
                        {job.category}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* SAVED TAB (placeholder) */}
      {activeTab === "saved" && (
        <div className="text-center mt-6 text-lg text-gray-500">
          You have not saved any jobs yet.
        </div>
      )}

      {/* ALERTS TAB (placeholder) */}
      {activeTab === "alerts" && (
        <div className="text-center mt-6 text-lg text-gray-500">
          You have no new alerts.
        </div>
      )}
    </div>
  );
}
