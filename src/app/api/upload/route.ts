import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import { IncomingForm } from "formidable";
import { JOBS_DATA } from "@/data/jobs";

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseForm(req: Request): Promise<{ filepath: string }> {
  const form = new IncomingForm({ uploadDir: "/tmp", keepExtensions: true });

  return new Promise((resolve, reject) => {
    form.parse(req as any, (err, fields, files) => {
      if (err) return reject(err);
      const file = files.file?.[0] || files.pdf?.[0];
      if (!file) return reject("No file uploaded.");
      resolve({ filepath: file.filepath });
    });
  });
}

export async function POST(req: Request) {
  try {
    const { filepath } = await parseForm(req);
    const data = await fs.readFile(filepath);
    const pdfText = await pdfParse(data);

    const text = pdfText.text.toLowerCase();

    const ranked = JOBS_DATA.map((job) => {
      const score =
        (text.includes(job.title.toLowerCase()) ? 40 : 0) +
        (text.includes(job.category.toLowerCase()) ? 30 : 0) +
        (text.includes(job.description.toLowerCase()) ? 30 : 0);

      return { id: job.id, match: score };
    }).sort((a, b) => b.match - a.match);

    return NextResponse.json({ jobs: ranked });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Failed to parse PDF." }, { status: 500 });
  }
}
