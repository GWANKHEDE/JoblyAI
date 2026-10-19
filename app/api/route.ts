import { NextRequest, NextResponse } from "next/server";
import { discoverJobs } from "@/lib/jobs";
import { deleteStore, readStore, updateStore, type Application, type Job, type Profile } from "@/lib/store";

export async function GET() {
  try {
    return NextResponse.json(await readStore());
  } catch {
    return NextResponse.json({ error: "Stored data could not be decrypted. Check GSBOT_ENCRYPTION_KEY." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "profile") {
      const profile = body.profile as Profile;
      if (!profile || typeof profile.name !== "string" || typeof profile.email !== "string") {
        return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
      }
      if (profile.name.length > 120 || profile.email.length > 254 || profile.resumeText.length > 50000) {
        return NextResponse.json({ error: "Profile fields exceed the allowed size." }, { status: 413 });
      }
      const saved = await updateStore((store) => { store.profile = profile; return store.profile; });
      return NextResponse.json({ profile: saved });
    }
    if (body.action === "search") {
      const store = await readStore();
      const result = await discoverJobs(store.profile, String(body.query ?? ""));
      await updateStore((current) => {
        const unique = new Map<string, Job>();
        for (const job of [...result.jobs, ...current.jobs]) {
          const key = `${job.company.toLowerCase()}-${job.title.toLowerCase()}`;
          if (!unique.has(key)) unique.set(key, job);
        }
        current.jobs = [...unique.values()].slice(0, 200);
        current.lastSearchAt = new Date().toISOString();
      });
      return NextResponse.json({ ...result, searchedAt: new Date().toISOString() });
    }
    if (body.action === "application") {
      const job = body.job as Job;
      if (!job?.id || !job.url || !/^https:\/\//i.test(job.url)) {
        return NextResponse.json({ error: "A valid job listing is required." }, { status: 400 });
      }
      const application = await updateStore((store) => {
        const existing = store.applications.find((item) => item.job.id === job.id);
        if (existing) return existing;
        const now = new Date().toISOString();
        const created: Application = {
          id: crypto.randomUUID(), job, status: "Pending approval", createdAt: now, updatedAt: now,
          notes: "Review the listing and apply on the employer's official site. JoblyAI has not submitted an application.",
          history: [{ status: "Pending approval", at: now }], resumeText: store.profile?.resumeText ?? "", followUpAt: "",
        };
        store.applications.unshift(created);
        return created;
      });
      return NextResponse.json({ application });
    }
    if (body.action === "status") {
      const id = String(body.id ?? "");
      const status = String(body.status ?? "");
      const allowed = ["Shortlisted", "Resume ready", "Applied", "Assessment", "Interview", "Offer", "Rejected"];
      if (!allowed.includes(status)) return NextResponse.json({ error: "Unsupported application status." }, { status: 400 });
      if (status === "Applied" && body.userConfirmed !== true) {
        return NextResponse.json({ error: "Confirm that you submitted on the employer site before recording Applied." }, { status: 400 });
      }
      const application = await updateStore((store) => {
        const item = store.applications.find((candidate) => candidate.id === id);
        if (!item) return null;
        item.status = status;
        item.updatedAt = new Date().toISOString();
        item.history.push({ status, at: item.updatedAt });
        return item;
      });
      return application ? NextResponse.json({ application }) : NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    if (body.action === "delete") {
      await deleteStore();
      return NextResponse.json({ deleted: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}