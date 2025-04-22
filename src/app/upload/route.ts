import { NextRequest, NextResponse } from "next/server";
import pdfParse from "pdf-parse";
import { JOBS_DATA } from "@/data/job";

export async function POST(req: NextRequest) {
  try {
  const formData = await req.formData();
    const file = formData.get("pdf") as File;

  if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const parsed = await pdfParse(buffer);
    const text = parsed.text.toLowerCase();

    const results = JOBS_DATA.map((job) => {
      let score = 0;
      if (text.includes(job.title.toLowerCase())) score += 30;
      if (text.includes(job.category.toLowerCase())) score += 30;
      if (text.includes(job.description.toLowerCase().slice(0, 50))) score += 40;

      return { id: job.id, match: Math.min(score, 100) };
    });

    const sorted = results.sort((a, b) => b.match - a.match);

    return NextResponse.json({ jobs: sorted });
  } catch (err: any) {
    console.error("PDF parse error:", err);
    return NextResponse.json({ error: "Failed to read PDF" }, { status: 500 });
  }
}
