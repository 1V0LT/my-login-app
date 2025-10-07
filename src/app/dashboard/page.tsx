"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { JOBS_DATA } from "@/shared";

const pageSizeOptions = [12, 24, 48];

const highlight = (text: string, query: string) => {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")})`, "ig");
  return text.split(regex).map((part, i) =>
    regex.test(part) ? <mark key={i} className="bg-yellow-200 text-gray-900 rounded px-0.5">{part}</mark> : part
  );
};

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"search" | "saved" | "alerts">("search");
  const [username, setUsername] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [saved, setSaved] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem("savedJobs") || "[]"); } catch { return []; }
  });
  const [pageSize, setPageSize] = useState<number>(12);
  const [page, setPage] = useState(1);

  // Transcript analysis + AI advisor state
  const [showTranscriptModal, setShowTranscriptModal] = useState(false);
  // legacy uploading state removed; vision flow uses visionRunning
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null);
  const [recommendations, setRecommendations] = useState<{ jobId: number; title: string; company: string; overlapScore: number; }[] | null>(null);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [skillSignals, setSkillSignals] = useState<Record<string, number> | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [restored, setRestored] = useState(false);
  const [analysisTimestamp, setAnalysisTimestamp] = useState<number | null>(null);

  // Load user & restore last analysis if present
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    } else {
      router.push("/login");
    }
    try {
      const raw = localStorage.getItem('lastTranscriptAnalysis');
      if (raw) {
        const parsed = JSON.parse(raw);
        setRecommendations(parsed.recommendations || null);
        setOcrPreview(parsed.ocrPreview || null);
        setNarrative(parsed.narrative || null);
        setSkillSignals(parsed.skillSignals || null);
        setAnalysisTimestamp(parsed.timestamp || null);
        setRestored(true);
      }
    } catch {}
  }, [router]);

  // Persist saved jobs
  useEffect(() => {
    try { localStorage.setItem("savedJobs", JSON.stringify(saved)); } catch {}
  }, [saved]);

  const handleLogout = () => {
    localStorage.removeItem("username");
    setUsername("");
    router.push("/login");
  };

  const categories = useMemo(() => {
    const set = new Set(JOBS_DATA.map(j => j.category));
    return ["all", ...Array.from(set).sort()];
  }, []);

  const filteredJobs = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return JOBS_DATA.filter(job => {
      if (categoryFilter !== "all" && job.category !== categoryFilter) return false;
      if (featuredOnly && !job.featured) return false;
      if (!lowerSearch) return true;
      return (
        job.title.toLowerCase().includes(lowerSearch) ||
        job.company.toLowerCase().includes(lowerSearch) ||
        job.location.toLowerCase().includes(lowerSearch) ||
        job.category.toLowerCase().includes(lowerSearch)
      );
    });
  }, [searchTerm, categoryFilter, featuredOnly]);

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    if (sortBy === "date") return new Date(b.datePosted).getTime() - new Date(a.datePosted).getTime();
    if (sortBy === "city") return a.location.localeCompare(b.location);
    if (sortBy === "title") return a.title.localeCompare(b.title);
    return 0;
  });

  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedJobs = sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSave = (id: number) => {
    setSaved(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const isSaved = (id: number) => saved.includes(id);

  // Drag & drop handlers
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }, []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.type.startsWith('image/')) setTranscriptFile(f); else setTranscriptError('Only image files are supported.');
    }
  }, []);

  // persistAnalysis removed for vision prototype (can reintroduce later for caching)

  // old skillSignals visualization logic removed in favor of visionSkills/visionJobs

  const [visionRunning, setVisionRunning] = useState(false);
  // Vision model returns: { skills: string[]; jobs: { jobId, score, reason }[]; summary }
  const [visionSkills, setVisionSkills] = useState<string[] | null>(null);
  const [visionSummary, setVisionSummary] = useState<string | null>(null);
  const [visionJobs, setVisionJobs] = useState<{ jobId:number; score:number; reason:string }[] | null>(null);
  const runVision = async () => {
    if (!transcriptFile) { setTranscriptError('Select an image first'); return; }
    setVisionRunning(true);
    setTranscriptError(null);
    setVisionSkills(null); setVisionJobs(null); setVisionSummary(null);
    try {
      const fd = new FormData();
      fd.append('file', transcriptFile);
      const res = await fetch('/api/transcript-vision', { method:'POST', body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Vision analysis failed');
      setVisionSkills(j.skills || []);
      setVisionJobs(j.jobs || []);
      setVisionSummary(j.summary || null);
    } catch (e) {
      setTranscriptError(e instanceof Error ? e.message : 'Vision error');
    } finally {
      setVisionRunning(false);
    }
  };

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
      {username && <div className="text-center mt-6 text-xl font-semibold text-gray-700">Hello, {username}!</div>}

      {/* TABS */}
      <div className="flex justify-center space-x-8 mt-6 border-b">
        {[
          { name: "Search", key: "search" },
          { name: "Saved", key: "saved" },
          { name: "Alerts", key: "alerts" },
        ].map(tab => (
          <button
            key={tab.key}
            className={`pb-2 text-lg font-semibold ${activeTab === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            onClick={() => setActiveTab(tab.key as 'search' | 'saved' | 'alerts')}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* SEARCH TAB */}
      {activeTab === 'search' && (
        <>
          <div className="mt-8 max-w-6xl mx-auto px-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex-1 flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search title, company, location..."
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700">Clear</button>
                  )}
                </div>
                <select value={categoryFilter} onChange={(e)=>{ setCategoryFilter(e.target.value); setPage(1); }} className="px-3 py-2 border rounded-lg bg-white text-sm focus:ring-blue-500 focus:outline-none shadow-sm">
                  {categories.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>)}
                </select>
                <select value={sortBy} onChange={(e)=>setSortBy(e.target.value)} className="px-3 py-2 border rounded-lg bg-white text-sm focus:ring-blue-500 focus:outline-none shadow-sm">
                  <option value="">Sort: Default</option>
                  <option value="date">Most Recent</option>
                  <option value="city">Location</option>
                  <option value="title">Title A-Z</option>
                </select>
                <select value={pageSize} onChange={(e)=>{ setPageSize(Number(e.target.value)); setPage(1); }} className="px-3 py-2 border rounded-lg bg-white text-sm focus:ring-blue-500 focus:outline-none shadow-sm">
                  {pageSizeOptions.map(n => <option key={n} value={n}>{n}/page</option>)}
                </select>
              </div>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={featuredOnly}
                  onChange={(e)=>{ setFeaturedOnly(e.target.checked); setPage(1); }}
                />
                Featured only
              </label>
              <button
                onClick={()=>{ setShowTranscriptModal(true); setTranscriptError(null); }}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white shadow hover:bg-emerald-500 transition"
              >
                Transcript Match
              </button>
            </div>
          </div>

          <div className="w-[90%] max-w-[1800px] mx-auto px-2 md:px-4 mt-8">
            {paginatedJobs.length === 0 ? (
              <div className="text-center py-20 border rounded-xl bg-white shadow-sm">
                <p className="text-gray-600 font-medium">No jobs match your filters.</p>
                <button className="mt-4 text-sm text-blue-600 hover:underline" onClick={()=>{ setSearchTerm(''); setCategoryFilter('all'); setFeaturedOnly(false); setSortBy(''); }}>Reset filters</button>
              </div>
            ) : (
              <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3">
                {paginatedJobs.map(job => (
                  <motion.div key={job.id} initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.4 }} className="group relative rounded-2xl border bg-white p-5 shadow-sm hover:shadow-lg transition cursor-pointer flex flex-col">
                    <button
                      onClick={()=>toggleSave(job.id)}
                      className={`absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-full border text-sm font-medium bg-white shadow-sm ${isSaved(job.id) ? 'text-yellow-600 border-yellow-400 bg-yellow-50' : 'text-gray-500 hover:text-gray-700'}`}
                      title={isSaved(job.id) ? 'Unsave' : 'Save job'}
                    >{isSaved(job.id) ? '★' : '☆'}</button>
                    <Link href={`/jobs/${job.id}`} className="flex-1 flex flex-col">
                      <div className="relative h-40 w-full overflow-hidden rounded-xl">
                        <Image src={job.imageUrl} alt={job.title} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-110" />
                        {job.featured && <span className="absolute top-2 left-2 bg-amber-200/95 backdrop-blur text-amber-900 text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">FEATURED</span>}
                      </div>
                      <h3 className="mt-5 font-semibold text-gray-900 text-base line-clamp-2 leading-snug">{highlight(job.title, searchTerm)}</h3>
                      <p className="text-blue-600 text-sm mt-1 font-medium">{job.company}</p>
                      <p className="text-gray-500 text-sm">{job.location}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-700">{job.category}</span>
                        {job.skills.slice(0,3).map(s => <span key={s} className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[11px] text-blue-700">{s}</span>)}
                      </div>
                      <p className="mt-3 text-[12px] text-gray-400">Posted {job.datePosted}</p>
                    </Link>
                    <div className="mt-4 flex items-center justify-between pt-2 border-t">
                      <button onClick={()=>router.push(`/jobs/${job.id}`)} className="text-xs font-medium text-blue-600 hover:underline">Details</button>
                      <button onClick={()=>router.push(`/chat?job=${job.id}`)} className="text-xs font-medium text-emerald-600 hover:underline">Quick Apply</button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            {paginatedJobs.length > 0 && (
              <div className="flex items-center justify-between mt-8 text-sm text-gray-600">
                <div>Page {currentPage} of {totalPages}</div>
                <div className="flex gap-2">
                  <button disabled={currentPage===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 rounded border disabled:opacity-40 bg-white hover:bg-gray-50">Prev</button>
                  <button disabled={currentPage===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 rounded border disabled:opacity-40 bg-white hover:bg-gray-50">Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'saved' && (
        <div className="max-w-6xl mx-auto px-4 mt-10">
          <h2 className="text-lg font-semibold mb-4">Saved Jobs</h2>
          {saved.length === 0 ? (
            <p className="text-gray-500 text-sm">You haven&apos;t saved any jobs yet.</p>
          ) : (
            <ul className="space-y-3">
              {JOBS_DATA.filter(j=>saved.includes(j.id)).map(j => (
                <li key={j.id} className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{j.title}</p>
                    <p className="text-xs text-gray-500">{j.company} • {j.location}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={()=>router.push(`/jobs/${j.id}`)} className="text-xs text-blue-600 hover:underline">Open</button>
                    <button onClick={()=>toggleSave(j.id)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="max-w-3xl mx-auto px-4 mt-10">
          <h2 className="text-lg font-semibold mb-4">Alerts (Prototype)</h2>
          <p className="text-sm text-gray-600 mb-4">Configure basic keyword alerts. (Demo only, not persisted)</p>
          <div className="grid gap-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-gray-800 mb-2">Example Alerts</p>
              <div className="flex flex-wrap gap-2">
                {['react','devops','security','python'].map(a => (
                  <span key={a} className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[11px] text-blue-700">{a}</span>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-3">(In a full implementation, you&apos;d add/remove and persist these; then match new jobs.)</p>
            </div>
          </div>
        </div>
      )}

      {showTranscriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-xl relative p-6">
            <button
              onClick={()=>{ setShowTranscriptModal(false); setTranscriptFile(null); setRecommendations(null); setOcrPreview(null); setTranscriptError(null); }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-sm"
            >✕</button>
            <h2 className="text-lg font-semibold text-gray-800 mb-1">University Transcript Analyzer</h2>
            <p className="text-xs text-gray-500 mb-4">Upload an image (PNG/JPG) of your transcript. We scan it & suggest matching internships. Nothing is stored server-side.</p>
            <div className="space-y-4">
              <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                className={`relative border-2 border-dashed rounded-lg p-5 text-center transition ${dragActive ? 'border-emerald-500 bg-emerald-50/40' : 'border-gray-300 bg-gray-50 hover:border-emerald-400'}`}
              >
                <input
                  id="transcriptFileInput"
                  type="file"
                  accept="image/*"
                  onChange={(e)=>{ const f = e.target.files?.[0] || null; setTranscriptFile(f); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <p className="text-xs text-gray-600">{transcriptFile ? <span className="font-medium text-emerald-700">{transcriptFile.name}</span> : 'Drag & drop transcript image here or click to browse'}</p>
                {restored && !transcriptFile && recommendations && (
                  <p className="mt-2 text-[10px] text-emerald-600">Restored previous analysis • {analysisTimestamp ? new Date(analysisTimestamp).toLocaleTimeString() : ''}</p>
                )}
              </div>
              {transcriptError && <p className="text-sm text-red-600">{transcriptError}</p>}
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={runVision} disabled={visionRunning || !transcriptFile} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                  {visionRunning ? 'Analyzing Image...' : 'Analyze Image'}
                </button>
                <button
                  type="button"
                  onClick={()=>{ setTranscriptFile(null); setRecommendations(null); setOcrPreview(null); setTranscriptError(null); setNarrative(null); setSkillSignals(null); setAnalysisTimestamp(null); localStorage.removeItem('lastTranscriptAnalysis'); setRestored(false); }}
                  className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
                >Reset</button>
                {recommendations && (
                  <button
                    type="button"
                    onClick={()=>{
                      const blob = new Blob([JSON.stringify({ recommendations, narrative, ocrPreview, skillSignals, timestamp: analysisTimestamp }, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = 'transcript_analysis.json'; a.click(); URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-2 rounded-lg text-sm bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  >Download JSON</button>
                )}
              </div>
            </div>
            {visionSkills && (
              <div className="mt-5">
                <p className="text-xs font-semibold text-gray-700 mb-2">Inferred Skills (Vision)</p>
                <div className="flex flex-wrap gap-2">
                  {visionSkills.map(s => <span key={s} className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] text-indigo-700">{s}</span>)}
                </div>
              </div>
            )}
            {visionJobs && visionJobs.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-2">Job Suitability (Vision)</h3>
                <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                  {visionJobs.map(vj => {
                    const job = JOBS_DATA.find(j => j.id === vj.jobId);
                    if (!job) return null;
                    return (
                      <li key={vj.jobId} className="rounded border bg-gray-50 p-2 text-[11px] flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800 truncate mr-2">{job.title}</span>
                          <span className="text-gray-600 font-semibold">{vj.score}</span>
                        </div>
                        <div className="w-full h-1.5 rounded bg-gray-200 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${vj.score}%` }} />
                        </div>
                        <p className="text-gray-600">{vj.reason}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {visionSummary && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-700 mb-1">Summary</p>
                <p className="text-[11px] leading-relaxed text-gray-600 whitespace-pre-wrap">{visionSummary}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
