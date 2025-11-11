"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { JOBS_DATA } from "@/shared";

// Example data. Use your real data or fetch from an API.
type Job = typeof JOBS_DATA[number];

type SimilarJob = {
  id: number;
  title: string;
  company: string;
  location: string;
  imageUrl: string;
  categories: string[];
};

// Remove local JOBS_DATA (now imported)

// Compute similar jobs later after job is known
const INITIAL_SIMILAR: SimilarJob[] = [];

// Small helpers
const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [similar, setSimilar] = useState<SimilarJob[]>(INITIAL_SIMILAR);

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
    // derive similar jobs: same category or overlapping skills, exclude self
    const similarPool = JOBS_DATA.filter(j => j.id !== jobData.id);
    const ranked = similarPool
      .map(j => ({
        job: j,
        score: (j.category === jobData.category ? 2 : 0) + j.skills.filter(s => jobData.skills.includes(s)).length
      }))
      .sort((a,b) => b.score - a.score)
      .slice(0,3)
      .map(({job:j}) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        imageUrl: j.imageUrl,
        categories: j.skills.slice(0,3)
      }));
    setSimilar(ranked);
    setLoading(false);
  }, [id, router]);

  // Ensure scroll top on mount / id change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, [id]);

  if (loading || !job) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 text-gray-600"
        >
          <span className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
          Loading job details...
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div className="min-h-screen bg-gradient-to-b from-white via-blue-50/40 to-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90 border-b">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-ml-1">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back to Jobs
          </button>
          {job.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-amber-500">
                <path d="M12 2l2.39 4.84L20 8.27l-3.64 3.55.86 5.01L12 15.9l-4.22 2.22.86-5.01L5 8.27l5.61-1.43L12 2z"/>
              </svg>
              Featured
            </span>
          )}
        </div>
      </div>

      {/* Hero */}
      <div className="relative">
        {job.imageUrl && (
          <div className="h-48 sm:h-56 md:h-64 w-full overflow-hidden relative">
            <Image
              src={job.imageUrl}
              alt={job.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
              className="object-cover"
              priority
            />
          </div>
        )}
        <div className="bg-gradient-to-b from-white to-transparent absolute inset-x-0 top-0 h-20 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.35 }}
            className="-mt-10 md:-mt-14 relative"
          >
            <div className="bg-white/95 backdrop-blur rounded-xl shadow-sm border p-5 md:p-7">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                    {job.title}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
                    <span className="font-medium text-blue-700">{job.company}</span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span className="inline-flex items-center gap-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                      {job.location}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span className="inline-flex items-center gap-1">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      Posted on {formatDate(job.datePosted)}
                    </span>
                    <span className="h-1 w-1 rounded-full bg-gray-300" />
                    <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 6v6l4 2"></path>
                      </svg>
                      {job.category}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Internship (to permanent)", icon: 
                      <svg key="1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a4 4 0 0 0-8 0v2"/></svg> },
                    { label: "Part-time", icon: 
                      <svg key="2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l3 3"/></svg> },
                    { label: "3–6 months", icon:
                      <svg key="3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> },
                    { label: "ASAP", icon:
                      <svg key="4" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg> },
                    { label: "Deadline Apr 3, 2025", icon:
                      <svg key="5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
                  ].map((m) => (
                    <span key={m.label} className="inline-flex items-center gap-2 rounded-full border bg-white text-gray-700 px-3 py-1 text-xs shadow-sm">
                      {m.icon}
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-6xl mx-auto px-4 pb-16 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT CONTENT */}
          <div className="col-span-2 space-y-6">
            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.35 }} className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-3">About this role</h2>
              {/* dangerouslySetInnerHTML only if you trust the data */}
              <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
                {job.description.split(/\n\n+/).map((para, idx) => (
                  <p key={idx}>{para.trim()}</p>
                ))}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.4 }} className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-3">Requirements to apply</h2>
              <ul className="list-disc ml-5 space-y-1 text-gray-700 text-sm">
                {Array.isArray(job.requirements) ? job.requirements.map(r => (
                  <li key={r}>{r}</li>
                )) : null}
              </ul>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.45 }} className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-4">Skills</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills?.map((skill: string) => (
                  <span key={skill} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1 text-xs font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* RIGHT CONTENT */}
          <div className="lg:sticky lg:top-6 space-y-6">
            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.35 }} className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-base md:text-lg font-semibold mb-3">Education and Experience</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <dt className="text-gray-500">Degree</dt>
                <dd className="sm:col-span-2 text-gray-900">{job.degree}</dd>

                <dt className="text-gray-500">Qualifications</dt>
                <dd className="sm:col-span-2 text-gray-900">{job.qualifications}</dd>

                <dt className="text-gray-500">Experience</dt>
                <dd className="sm:col-span-2 text-gray-900">{job.experience}</dd>
              </dl>
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Location</h3>
                <p className="text-gray-900 inline-flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                  </svg>
                  {job.location}
                </p>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Visa</h3>
                <div className="flex flex-wrap gap-2">
                  {job.visaOptions?.map((visa: string) => (
                    <span key={visa} className="inline-flex items-center rounded-full border bg-white px-3 py-1 text-xs text-gray-700">
                      {visa}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <button
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 text-sm font-semibold transition"
                  onClick={() => router.push(`/local-interview?job=${job.id}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13"></path>
                    <path d="M22 2l-7 20-4-9-9-4 20-7z"></path>
                  </svg>
                  Apply now
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* SIMILAR JOBS */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.35 }} className="mt-10">
          <h2 className="text-lg md:text-xl font-semibold mb-4">Other Jobs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {similar.map((sjob) => (
              <motion.div
                key={sjob.id}
                className="group relative cursor-pointer overflow-hidden rounded-xl border bg-white shadow-sm"
                whileHover={{ y: -2 }}
                onClick={() => router.push(`/jobs/${sjob.id}`)}
              >
                <div className="h-32 w-full overflow-hidden relative">
                  <Image
                    src={sjob.imageUrl}
                    alt={sjob.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <h3 className="text-base font-semibold text-gray-900">{sjob.title}</h3>
                  <p className="text-sm text-blue-700">{sjob.company}</p>
                  <p className="text-sm text-gray-500">{sjob.location}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sjob.categories.map((cat) => (
                      <span key={cat} className="inline-flex items-center rounded-full border bg-white px-2.5 py-1 text-[11px] text-gray-700">
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
