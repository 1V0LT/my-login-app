import { NextResponse } from 'next/server';
// NOTE: Server-side OCR disabled (hybrid mode). We now accept plain text provided by the client after
// client-side OCR with tesseract.js in the browser. Retaining the old server OCR code caused environment
// resolution issues (worker-script path). If multipart image upload is sent, we return an instructive error.
import { JOBS_DATA } from '@/shared';

// Simple regex patterns to capture course lines like: CS101  A  or "Data Structures B+"
const COURSE_LINE = /(\b[A-Za-z]{2,}\d{2,}\b[\s\-:]+[A-F][+-]?\b)|([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+.*?[A-F][+-]?)/g;
const GRADE = /\b(A|A-|B\+|B|B-|C\+|C|C-|D\+|D|F)\b/;

// Map grade letters to numeric weight
const gradeToScore: Record<string, number> = {
  'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0,
  'F': 0.0
};

// Associate keywords with skill domains that map to JOBS_DATA skills
const keywordSkillMap: Record<string, string[]> = {
  'algorithm': ['Data Structures', 'Algorithms'],
  'data structure': ['Data Structures', 'Algorithms'],
  'machine learning': ['Machine Learning', 'Python', 'TensorFlow'],
  'ml': ['Machine Learning', 'Python'],
  'ai': ['Machine Learning', 'Python'],
  'database': ['SQL', 'Databases'],
  'sql': ['SQL', 'Databases'],
  'web': ['HTML', 'CSS', 'JavaScript', 'React'],
  'react': ['React', 'JavaScript'],
  'frontend': ['React', 'TypeScript', 'JavaScript', 'UI'],
  'back end': ['Node.js', 'APIs'],
  'backend': ['Node.js', 'APIs'],
  'security': ['Security'],
  'network': ['Networking'],
  'cloud': ['AWS', 'Cloud'],
  'devops': ['CI/CD', 'Docker'],
  'testing': ['Testing', 'QA', 'Automation'],
  'quality': ['Testing', 'QA', 'Automation'],
  'mobile': ['Mobile', 'iOS', 'Android'],
  'android': ['Android'],
  'ios': ['iOS'],
  'swift': ['iOS'],
  'kotlin': ['Android'],
  'python': ['Python'],
  'java': ['Java'],
  'c++': ['C++'],
  'c#': ['C#'],
  'javascript': ['JavaScript', 'TypeScript'],
  'typescript': ['TypeScript', 'JavaScript'],
  'docker': ['Docker'],
  'kubernetes': ['Kubernetes', 'Cloud'],
  'api': ['APIs']
};

// Extract skills signals from text
function inferSkillSignals(text: string) {
  const lower = text.toLowerCase();
  const signals: Record<string, number> = {};
  for (const key in keywordSkillMap) {
    if (lower.includes(key)) {
      keywordSkillMap[key].forEach(skill => {
        signals[skill] = (signals[skill] || 0) + 1; // increment weight per keyword hit
      });
    }
  }
  return signals; // e.g., { 'React': 2, 'JavaScript': 2 }
}

function scoreJobs(skillSignals: Record<string, number>) {
  // For each job, aggregate weights for overlapping skills
  return JOBS_DATA.map(job => {
    const overlapScore = job.skills.reduce((acc, skill) => {
      return acc + (skillSignals[skill] || 0);
    }, 0);
    return { jobId: job.id, title: job.title, company: job.company, overlapScore, skills: job.skills };
  }).sort((a,b) => b.overlapScore - a.overlapScore);
}

export const runtime = 'nodejs'; // Ensure Node runtime for tesseract

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let text = '';
    if (contentType.includes('application/json')) {
      // New hybrid path: client performed OCR, sends raw text.
      const body = await req.json().catch(()=>null);
      if (!body || typeof body.text !== 'string' || !body.text.trim()) {
        return NextResponse.json({ error: 'Missing transcript text in JSON body.' }, { status: 400 });
      }
      text = body.text.slice(0, 100000); // safety cap
    } else if (contentType.includes('multipart/form-data')) {
      // Legacy path disabled
      return NextResponse.json({ error: 'Server-side OCR disabled. Perform OCR in browser and POST {"text": "..."} JSON.' }, { status: 400 });
    } else {
      return NextResponse.json({ error: 'Unsupported content-type. Send JSON: {"text":"extracted transcript"}.' }, { status: 400 });
    }

    // Basic course & grade extraction (heuristic)
  const lines = text.split(/\n+/).map((l: string) => l.trim()).filter(Boolean);
    const courses: { raw: string; grade?: string }[] = [];
    for (const line of lines) {
      if (COURSE_LINE.test(line)) {
        const gradeMatch = line.match(GRADE);
        courses.push({ raw: line, grade: gradeMatch ? gradeMatch[0] : undefined });
      }
      COURSE_LINE.lastIndex = 0; // reset stateful regex
    }

    // Calculate GPA-like average for extracted lines (optional info)
    const numericGrades = courses.map(c => gradeToScore[c.grade || ''] ).filter(v => typeof v === 'number' && !isNaN(v));
    const avgGrade = numericGrades.length ? (numericGrades.reduce((a,b)=>a+b,0)/numericGrades.length) : undefined;

    // Infer skill signals
    const skillSignals = inferSkillSignals(text);

    // Score jobs
    const jobScores = scoreJobs(skillSignals);
    const topJobs = jobScores.slice(0, 5);

    // Optional: Call Gemma model for narrative advice (best-effort; ignore failure)
    let narrative: string | undefined;
    try {
      const gemmaMessages = [
        { role: 'system', content: 'You are a career advisor. Based ONLY on the provided recognized transcript text and inferred skills, briefly (<=120 words) explain why the top internship matches make sense and suggest 1-2 skill gaps to improve.' },
        { role: 'user', content: `Transcript excerpt:\n${text.slice(0,1500)}\n\nInferred skill signals: ${JSON.stringify(skillSignals)}\nTop matches: ${topJobs.map(t=>t.title+ ' ('+ t.company +')').join(', ')}` }
      ];
      const gemmaResp = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gemma:4b', messages: gemmaMessages, stream: true })
      });
      if (gemmaResp.body) {
        const reader = gemmaResp.body.getReader();
        let adv = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n').filter(l=>l.trim());
            for (const line of lines) {
              try { const obj = JSON.parse(line); if (obj.message?.content) adv += obj.message.content; } catch {}
            }
        }
        narrative = adv.trim();
      }
    } catch (gemmaErr) {
      console.warn('Gemma narrative generation failed (non-fatal):', gemmaErr);
    }

    return NextResponse.json({
      ocrText: text.slice(0, 5000), // cap for payload
      courses: courses.slice(0, 50),
      avgGrade,
      skillSignals,
      recommendations: topJobs,
      narrative
    });
  } catch (err) {
    console.error('Transcript processing failed', err);
    return NextResponse.json({ error: 'Transcript processing failed' }, { status: 500 });
  }
}
