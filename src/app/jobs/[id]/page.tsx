"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";

// Example data. Use your real data or fetch from an API.
const JOBS_DATA = [
  {
    id: 1,
    title: "Marketing & Media Coordinator",
    company: "United Global Services Company",
    location: "Dubai, United Arab Emirates AE",
    datePosted: "2025-03-01",
    category: "Marketing",
    featured: true,
    imageUrl: "/images/Job.jpg",
    description: `
      <ul class="list-disc ml-5 space-y-2">
        <li>Brochure Management: Design, update, and organize company brochures.</li>
        <li>Website Management: Maintain and update the company's website.</li>
        <li>Digital Media & Social Presence: Manage and update social media accounts.</li>
        <li>Content Creation: Develop creative content for digital platforms.</li>
        <li>Brand Consistency: Ensure all marketing materials and online content are aligned with the company's brand guidelines.</li>
      </ul>
    `,
    requirements: `
      <ul class="list-disc ml-5 space-y-2">
        <li>Experience in marketing, graphic design, or website management.</li>
        <li>Strong attention to detail and creativity.</li>
        <li>Familiarity with website management tools and social media platforms.</li>
      </ul>
    `,
    skills: ["DevOps"], // or e.g. ["Marketing", "Digital Content"]
    degree: "Bachelors Degree",
    qualifications: "Marketing",
    experience: "0 to 1",
    visaOptions: ["Student Visa", "Parent Visa", "Emirati Visa", "Employee Visa", "Spouse Visa", "Gcc Citizen"]
  },
  // Add more jobs...
];

const SIMILAR_JOBS = [
  {
    id: 2,
    title: "Marketing Executive",
    company: "IEX Recreational Playground LLC",
    location: "Dubai, AE",
    imageUrl: "/images/Job.jpg",
    categories: ["Admin", "Grad", "Content"]
  },
  {
    id: 3,
    title: "Marketing Intern",
    company: "Halper",
    location: "Dubai, AE",
    imageUrl: "/images/Job.jpg",
    categories: ["Search", "SEO", "Marketing"]
  },
  {
    id: 4,
    title: "Marketing Intern",
    company: "IOT World",
    location: "Dubai, AE",
    imageUrl: "/images/Job.jpg",
    categories: ["Comm", "Email", "Content"]
  },
];

export default function JobDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      // no ID - back to list
      router.push("/dashboard");
      return;
    }
    const jobData = JOBS_DATA.find((j) => j.id === Number(id));
    if (!jobData) {
      router.push("/dashboard");
      return;
    }
    setJob(jobData);
    setLoading(false);
  }, [id, router]);

  if (loading || !job) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-700">Loading job details...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="bg-gray-50 min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="max-w-6xl mx-auto pt-10 pb-20 px-4">
        {/* BACK BUTTON + JOB TITLE */}
        <div className="flex items-center space-x-4 mb-8">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-blue-600 hover:underline"
          >
            &larr; Back to Jobs List
          </button>
        </div>

        {/* JOB TITLE & INFO */}
        <div className="mb-10 bg-white p-6 rounded shadow">
          {job.featured && (
            <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded mb-2 inline-block">
              FEATURED
            </span>
          )}
          <h1 className="text-3xl font-bold text-blue-600 mt-2">
            {job.title}
          </h1>
          <p className="text-gray-600 text-xl mt-1">
            {job.company} - {job.location}
          </p>
          <p className="text-gray-400 mt-1">Posted {job.datePosted}</p>
          <p className="text-sm font-semibold text-blue-500 mt-2">
            {job.category}
          </p>
          <div className="mt-6 flex space-x-4">
            <div>
              <p className="text-sm font-semibold text-gray-500">Employment Type</p>
              <p className="text-gray-800">Internship (Leading to permanent)</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Availability</p>
              <p className="text-gray-800">Part-time</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Duration</p>
              <p className="text-gray-800">3 to 6 months</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Start Date</p>
              <p className="text-gray-800">ASAP</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">Deadline</p>
              <p className="text-gray-800">April 03, 2025</p>
            </div>
          </div>
        </div>

        {/* ABOUT ROLE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT CONTENT */}
          <div className="col-span-2 bg-white p-6 rounded shadow space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-3">About this role</h2>
              {/* dangerouslySetInnerHTML only if you trust the data */}
              <div
                className="text-gray-700 space-y-2"
                dangerouslySetInnerHTML={{ __html: job.description }}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3">Requirements to apply</h2>
              <div
                className="text-gray-700 space-y-2"
                dangerouslySetInnerHTML={{ __html: job.requirements }}
              />
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-3">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills?.map((skill: string) => (
                  <span
                    key={skill}
                    className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT CONTENT */}
          <div className="bg-white p-6 rounded shadow space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-3">Education and Skills</h2>
              <div className="grid grid-cols-3 gap-y-2 text-sm">
                <span className="font-semibold text-gray-600">Degree</span>
                <span className="col-span-2 text-gray-800">{job.degree}</span>

                <span className="font-semibold text-gray-600">Qualifications</span>
                <span className="col-span-2 text-gray-800">{job.qualifications}</span>

                <span className="font-semibold text-gray-600">
                  Years of Experience
                </span>
                <span className="col-span-2 text-gray-800">{job.experience}</span>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Location</h2>
              <p className="text-gray-800">{job.location}</p>
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Visa</h2>
              <div className="flex flex-wrap gap-2">
                {job.visaOptions?.map((visa: string) => (
                  <span
                    key={visa}
                    className="border border-gray-300 rounded px-3 py-1 text-sm text-gray-600"
                  >
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

        {/* SIMILAR JOBS */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Similar Jobs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SIMILAR_JOBS.map((sjob) => (
              <motion.div
                key={sjob.id}
                className="bg-white p-6 rounded shadow hover:shadow-md transition cursor-pointer"
                whileHover={{ scale: 1.01 }}
                onClick={() => router.push(`/jobs/${sjob.id}`)}
              >
                <img
                  src={sjob.imageUrl}
                  alt={sjob.title}
                  className="w-full h-32 object-cover rounded"
                />
                <h3 className="text-lg font-semibold mt-4">{sjob.title}</h3>
                <p className="text-blue-600">{sjob.company}</p>
                <p className="text-gray-500">{sjob.location}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {sjob.categories.map((cat) => (
                    <span
                      key={cat}
                      className="border border-gray-300 text-gray-600 px-2 py-1 rounded text-xs"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
