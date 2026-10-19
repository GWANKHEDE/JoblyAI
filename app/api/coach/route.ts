import { NextRequest, NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export async function POST(request: NextRequest) {
  const body = await request.json() as { action?: string; answer?: string; jobTitle?: string; company?: string };
  const store = await readStore();
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are JoblyAI, a careful interview coach. Use only experience explicitly present in the user's resume. Never invent achievements, skills, employers, or metrics. Be concise and actionable." },
            { role: "user", content: JSON.stringify({ action: body.action, jobTitle: body.jobTitle, company: body.company, resume: store.profile?.resumeText, answer: body.answer }) },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error("AI provider request failed.");
      const data = await response.json() as { choices?: { message?: { content?: string } }[] };
      return NextResponse.json({ feedback: data.choices?.[0]?.message?.content ?? "No coaching response was returned.", mode: "ai" });
    } catch {
      return NextResponse.json({ error: "The configured AI service is unavailable. Try again shortly." }, { status: 502 });
    }
  }
  const answer = String(body.answer ?? "");
  const checks = [
    { label: "Situation", found: /situation|context|when i|at my previous/i.test(answer) },
    { label: "Task", found: /responsible|task|goal|needed to/i.test(answer) },
    { label: "Action", found: /I (?:led|built|created|implemented|organized|analyzed|improved|designed|resolved)/i.test(answer) },
    { label: "Result", found: /result|increased|reduced|improved|saved|delivered|achieved|%/i.test(answer) },
  ];
  const missing = checks.filter((check) => !check.found).map((check) => check.label);
  return NextResponse.json({
    mode: "guided",
    feedback: answer.trim()
      ? `${missing.length ? `To strengthen this answer, add a clearer ${missing.join(" and ")}. ` : "Your answer has the core STAR beats. "}Keep the example specific and use only details that reflect your real experience.`
      : "Start with a real example from your work. Describe the situation, your responsibility, the actions you personally took, and the result.",
  });
}