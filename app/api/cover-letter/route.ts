import { NextRequest, NextResponse } from "next/server";
import { readStore, type Job } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json() as { job?: Job };
  const job = body.job;
  if (!job?.title || !job.company) return NextResponse.json({ error: "A target job is required." }, { status: 400 });
  const profile = (await readStore()).profile;
  if (!profile) return NextResponse.json({ error: "Create a profile before drafting a cover letter." }, { status: 400 });
  const resume = profile.resumeText.trim();
  const groundedSkills = profile.skills.filter((skill) => skill.trim() && resume.toLowerCase().includes(skill.toLowerCase())).slice(0, 5);
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "Draft a concise, professional cover letter for this job. Only use facts and achievements explicitly present in the supplied resume/profile. Do not add unsupported qualifications, metrics, employer claims, or company facts. Return only the draft letter." },
            { role: "user", content: JSON.stringify({ job: { title: job.title, company: job.company, description: job.description.slice(0, 6000) }, profile: { name: profile.name, experience: profile.experience, education: profile.education, resume } }) },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error("AI provider request failed.");
      const result = await response.json() as { choices?: { message?: { content?: string } }[] };
      return NextResponse.json({ letter: result.choices?.[0]?.message?.content ?? "", mode: "ai" });
    } catch {
      return NextResponse.json({ error: "The configured AI service is unavailable. Try again shortly." }, { status: 502 });
    }
  }
  const details = [profile.experience, profile.education].filter(Boolean).join("; ");
  const skills = groundedSkills.length ? ` My resume reflects hands-on experience with ${groundedSkills.join(", ")}.` : " I would welcome the chance to discuss the experience in my resume and how it may relate to your needs.";
  const letter = [
    `Dear ${job.company} Hiring Team,`,
    "",
    `I am applying for the ${job.title} role at ${job.company}.${details ? ` My background includes ${details}.` : ""}${skills}`,
    "",
    "Thank you for considering my application. I would welcome the opportunity to discuss my experience and learn more about the role.",
    "",
    `Sincerely,\n${profile.name}`,
  ].join("\n");
  return NextResponse.json({ letter, mode: "profile-based draft" });
}