export const runtime = 'nodejs';

// @ts-ignore
import pdfParse from 'pdf-parse';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded or invalid type' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await pdfParse(buffer);

    return NextResponse.json({ text: result.text || 'No text extracted' });

  } catch (err: any) {
    console.error("❌ PDF parsing error:", err.message);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
