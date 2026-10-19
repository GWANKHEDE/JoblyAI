import type { Job, Profile } from "./store";

type RawJob = {
  id?: number | string;
  slug?: string;
  title?: string;
  company_name?: string;
  company?: string;
  candidate_required_location?: string;
  location?: string;
  salary?: string;
  publication_date?: string;
  created_at?: string;
  url?: string;
  job_url?: string;
  description?: string;
  remote?: boolean;
};

function scoreJob(job: RawJob, profile: Profile | null) {
  const text = `${job.title ?? ""} ${job.description ?? ""}`.toLowerCase();
  const skills = profile?.skills ?? [];
  const roles = profile?.roles ?? [];
  const matchedSkills = skills.filter((skill) => skill.trim() && text.includes(skill.toLowerCase()));
  const matchedRoles = roles.filter((role) => role.trim() && (job.title ?? "").toLowerCase().includes(role.toLowerCase()));
  const company = (job.company_name ?? job.company ?? "").toLowerCase();
  const preferenceMatch = (profile?.companies ?? []).some((name) => name && company.includes(name.toLowerCase()));
  const industryMatch = (profile?.industries ?? []).some((industry) => industry && text.includes(industry.toLowerCase()));
  const location = (job.candidate_required_location ?? job.location ?? "").toLowerCase();
  const locationMatch = Boolean(profile?.location && location.includes(profile.location.toLowerCase())) || (Boolean(job.remote) && /remote/i.test(profile?.workMode ?? ""));
  const match = Math.min(99, 34 + matchedSkills.length * 7 + matchedRoles.length * 13 + (preferenceMatch ? 10 : 0) + (industryMatch ? 7 : 0) + (locationMatch ? 8 : 0));
  const resume = profile?.resumeText.toLowerCase() ?? "";
  const resumeSkillMatches = matchedSkills.filter((skill) => resume.includes(skill.toLowerCase())).length;
  const ats = resume ? Math.min(98, 30 + resumeSkillMatches * 10 + matchedRoles.length * 4) : 0;
  return { match, ats };
}

function normalize(raw: RawJob, source: string, profile: Profile | null): Job | null {
  const title = raw.title?.trim();
  const company = (raw.company_name ?? raw.company)?.trim();
  const url = raw.url ?? raw.job_url;
  if (!title || !company || !url || !/^https:\/\//i.test(url)) return null;
  const { match, ats } = scoreJob(raw, profile);
  const description = (raw.description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const host = new URL(url).hostname.toLowerCase();
  const suspicious = /(?:pay\s+(?:a\s+)?fee|upfront\s+(?:payment|cost)|telegram\s+only|whatsapp\s+only|wire\s+transfer|crypto\s+deposit)/i.test(`${title} ${description}`)
    || /^(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|forms\.gle)$/i.test(host)
    || !description;
  return {
    id: `${source}-${raw.id ?? raw.slug ?? url}`,
    title,
    company,
    location: raw.candidate_required_location ?? raw.location ?? "Not specified",
    salary: raw.salary || "Not listed",
    source,
    postedAt: raw.publication_date ?? raw.created_at ?? new Date().toISOString(),
    url,
    description: description.slice(0, 12000),
    remote: Boolean(raw.remote) || /remote|anywhere/i.test(raw.candidate_required_location ?? raw.location ?? ""),
    match,
    ats,
    suspicious,
  };
}

export async function discoverJobs(profile: Profile | null, query: string) {
  const terms = [query, ...(profile?.roles ?? []).slice(0, 2), ...(profile?.skills ?? []).slice(0, 2)]
    .filter(Boolean)
    .join(" ")
    .slice(0, 120);
  const providers = [
    {
      name: "Remotive",
      url: `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(terms)}`,
      parse: (data: unknown) => (data as { jobs?: RawJob[] }).jobs ?? [],
    },
    {
      name: "Arbeitnow",
      url: "https://www.arbeitnow.com/api/job-board-api",
      parse: (data: unknown) => (data as { data?: RawJob[] }).data ?? [],
    },
  ];
  const results = await Promise.allSettled(providers.map(async (provider) => {
    const response = await fetch(provider.url, { signal: AbortSignal.timeout(9000), next: { revalidate: 0 } });
    if (!response.ok) throw new Error(`${provider.name} returned ${response.status}`);
    const data = provider.parse(await response.json());
    return data.map((job) => normalize(job, provider.name, profile)).filter((job): job is Job => Boolean(job));
  }));
  const jobs = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const unique = new Map<string, Job>();
  for (const job of jobs) {
    const key = `${job.company.toLowerCase()}-${job.title.toLowerCase()}`;
    const previous = unique.get(key);
    if (!previous || new Date(job.postedAt).getTime() > new Date(previous.postedAt).getTime()) unique.set(key, job);
  }
  const sorted = [...unique.values()].sort((a, b) => b.match - a.match || Date.parse(b.postedAt) - Date.parse(a.postedAt));
  return { jobs: sorted.slice(0, 60), errors: results.flatMap((result, index) => result.status === "rejected" ? [providers[index].name] : []) };
}