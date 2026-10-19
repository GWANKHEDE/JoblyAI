import { NextRequest, NextResponse } from "next/server";
import { DOMParser } from "@xmldom/xmldom";
import { strFromU8, unzipSync } from "fflate";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { readStore, updateStore, type Job } from "@/lib/store";

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("resume");
      if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF or DOCX resume." }, { status: 400 });
      if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Resume files must be smaller than 8 MB." }, { status: 413 });
      const buffer = Buffer.from(await file.arrayBuffer());
      let resumeText = "";
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        resumeText = (await pdfParse(buffer)).text;
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith(".docx")) {
        const documentXml = unzipSync(buffer)["word/document.xml"];
        if (!documentXml) return NextResponse.json({ error: "The DOCX file is missing its document content." }, { status: 422 });
        const docxDocument = new DOMParser().parseFromString(strFromU8(documentXml), "application/xml");
        resumeText = Array.from(docxDocument.getElementsByTagName("w:p"))
          .map((paragraph) => Array.from(paragraph.getElementsByTagName("w:t")).map((node) => node.textContent ?? "").join(""))
          .filter(Boolean)
          .join("\n");
      } else {
        return NextResponse.json({ error: "Only PDF and DOCX files are supported." }, { status: 415 });
      }
      if (!resumeText.trim()) return NextResponse.json({ error: "No readable text was found. Try a text-based PDF or DOCX." }, { status: 422 });
      await updateStore((store) => {
        if (!store.profile) throw new Error("Create your profile before uploading a resume.");
        store.profile.resumeText = resumeText.slice(0, 50000);
        store.profile.resumeName = file.name;
      });
      return NextResponse.json({ resumeName: file.name, characters: resumeText.length });
    }

    const body = await request.json() as { job?: Job; resumeText?: string };
    const store = await readStore();
    const resumeText = String(body.resumeText ?? store.profile?.resumeText ?? "").trim();
    const job = body.job;
    if (!resumeText || !job?.title) return NextResponse.json({ error: "A resume and target job are required." }, { status: 400 });

    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    let page = document.addPage([612, 792]);
    let y = 748;
    const left = 54;
    const safeText = (text: string) => text.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
    const addLine = (text: string, strong = false, size = 10) => {
      const words = safeText(text).split(/\s+/);
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if ((strong ? bold : regular).widthOfTextAtSize(next, size) > 504) {
          if (y < 56) { page = document.addPage([612, 792]); y = 748; }
          page.drawText(line, { x: left, y, size, font: strong ? bold : regular });
          y -= size + 5;
          line = word;
        } else line = next;
      }
      if (line) {
        if (y < 56) { page = document.addPage([612, 792]); y = 748; }
        page.drawText(line, { x: left, y, size, font: strong ? bold : regular });
        y -= size + 5;
      }
    };
    const profile = store.profile;
    addLine(profile?.name || "Resume", true, 19);
    addLine([profile?.email, profile?.phone, profile?.location].filter(Boolean).join(" | "), false, 9);
    addLine(`${job.title} | ${job.company}`, true, 12);
    y -= 8;
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    const relevantSkills = (profile?.skills ?? []).filter((skill) => skill.trim()
      && resumeText.toLowerCase().includes(skill.toLowerCase())
      && jobText.includes(skill.toLowerCase()));
    if (relevantSkills.length) {
      addLine("RELEVANT SKILLS", true, 11);
      addLine(relevantSkills.join(" · "));
      y -= 5;
    }
    for (const paragraph of resumeText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)) {
      const heading = paragraph.length < 60 && paragraph === paragraph.toUpperCase();
      addLine(paragraph, heading, heading ? 11 : 10);
    }
    const bytes = await document.save();
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="joblyai-${job.company.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-resume.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume processing failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}