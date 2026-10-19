import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export async function GET() {
  try {
    const store = await readStore();
    return NextResponse.json({ jobs: store.jobs, lastSearchAt: store.lastSearchAt });
  } catch {
    return NextResponse.json({ error: "Saved job listings could not be loaded." }, { status: 500 });
  }
}