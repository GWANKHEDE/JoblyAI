"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Clipboard,
  ChevronDown,
  Compass,
  FileText,
  Filter,
  Gauge,
  Heart,
  Home,
  Menu,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import type { Application, Job, Profile, Store } from "@/lib/store";

type Section =
  | "Home"
  | "Job search"
  | "Recommended"
  | "Resume studio"
  | "Applications"
  | "Interview coach"
  | "Reminders"
  | "Profile & settings";
const sectionPaths: Record<Section, string> = {
  Home: "/",
  "Job search": "/job-search",
  Recommended: "/recommended",
  "Resume studio": "/resume-studio",
  Applications: "/applications",
  "Interview coach": "/interview-coach",
  Reminders: "/reminders",
  "Profile & settings": "/settings",
};
function sectionForPath(pathname: string): Section {
  return (
    (Object.entries(sectionPaths).find(([, path]) => path === pathname)?.[0] as
      | Section
      | undefined) ?? "Home"
  );
}
const sections: { name: Section; icon: typeof Home }[] = [
  { name: "Home", icon: Home },
  { name: "Job search", icon: Search },
  { name: "Recommended", icon: Compass },
  { name: "Resume studio", icon: FileText },
  { name: "Applications", icon: BriefcaseBusiness },
  { name: "Interview coach", icon: MessageCircle },
  { name: "Reminders", icon: Bell },
  { name: "Profile & settings", icon: Settings2 },
];
const blankProfile: Profile = {
  name: "",
  email: "",
  phone: "",
  location: "",
  skills: [],
  experience: "",
  education: "",
  roles: [],
  salary: "",
  industries: [],
  companies: [],
  workMode: "Remote or hybrid",
  resumeText: "",
  resumeName: "",
};
const blankStore: Store = {
  profile: null,
  jobs: [],
  applications: [],
  lastSearchAt: null,
};
const refreshInterval = 30 * 60 * 1000;
const jobsCacheKey = "gsbot:public-jobs:v1";
const profileReadyKey = "gsbot:profile-ready";
type JobsSnapshot = { jobs: Job[]; savedAt: string | null };
function readJobsSnapshot(): JobsSnapshot | null {
  try {
    const value = localStorage.getItem(jobsCacheKey);
    if (!value) return null;
    const snapshot = JSON.parse(value) as JobsSnapshot;
    return Array.isArray(snapshot.jobs) ? snapshot : null;
  } catch {
    return null;
  }
}
function saveJobsSnapshot(jobs: Job[], savedAt: string | null) {
  try {
    const publicJobs = jobs
      .slice(0, 100)
      .map((job) => ({ ...job, description: job.description.slice(0, 3000) }));
    localStorage.setItem(
      jobsCacheKey,
      JSON.stringify({ jobs: publicJobs, savedAt } satisfies JobsSnapshot),
    );
  } catch {
    /* Browser storage may be disabled or full. */
  }
}
function setProfileCacheReady(ready: boolean) {
  try {
    if (ready) localStorage.setItem(profileReadyKey, "1");
    else localStorage.removeItem(profileReadyKey);
  } catch {
    /* Offline profile restoration is optional when storage is unavailable. */
  }
}
function hasProfileCacheReady() {
  try {
    return localStorage.getItem(profileReadyKey) === "1";
  } catch {
    return false;
  }
}
function clearJobsSnapshot() {
  try {
    localStorage.removeItem(jobsCacheKey);
  } catch {
    /* Storage may be disabled. */
  }
}
function listValue(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently posted";
  const days = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 86400000),
  );
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
}
function initials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "GS"
  );
}

export default function HomePage({
  initialSection = "Home",
}: { initialSection?: Section } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<Store>(blankStore);
  const [profileDraft, setProfileDraft] = useState<Profile>(blankProfile);
  const [section, setSectionState] = useState<Section>(initialSection);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [tableSearch, setTableSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [coachAnswer, setCoachAnswer] = useState("");
  const [coachFeedback, setCoachFeedback] = useState("");
  const [coachMode, setCoachMode] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const searchInFlight = useRef(false);

  function setSection(nextSection: Section) {
    setSectionState(nextSection);
    const nextPath = sectionPaths[nextSection];
    if (pathname !== nextPath) router.push(nextPath);
  }

  useEffect(() => {
    setSectionState(sectionForPath(pathname));
  }, [pathname]);

  useEffect(() => {
    fetch("/api")
      .then(async (response) => {
        const value = (await response.json()) as Store & { error?: string };
        if (!response.ok)
          throw new Error(value.error || "Could not load workspace.");
        setData(value);
        if (value.profile) {
          setProfileCacheReady(true);
          setProfileDraft(value.profile);
          setQuery(value.profile.roles[0] ?? "");
          saveJobsSnapshot(value.jobs, value.lastSearchAt);
          void fetch("/api/jobs").catch(() => undefined);
        } else {
          setProfileCacheReady(false);
        }
      })
      .catch(async (error: Error) => {
        let snapshot = readJobsSnapshot();
        if (!snapshot) {
          try {
            const response = await fetch("/api/jobs");
            if (response.ok) {
              const cached = (await response.json()) as {
                jobs: Job[];
                lastSearchAt: string | null;
              };
              snapshot = { jobs: cached.jobs, savedAt: cached.lastSearchAt };
            }
          } catch {
            /* Use the browser snapshot when no network or worker cache exists. */
          }
        }
        if (hasProfileCacheReady()) {
          setOffline(true);
          setData({
            ...blankStore,
            profile: { ...blankProfile, name: "there" },
            jobs: snapshot?.jobs ?? [],
            lastSearchAt: snapshot?.savedAt ?? null,
          });
          if (snapshot) saveJobsSnapshot(snapshot.jobs, snapshot.savedAt);
          setNotice(
            snapshot?.savedAt
              ? `Offline. Showing saved listings from ${new Date(snapshot.savedAt).toLocaleString()}; new jobs will load when you're online.`
              : "Offline. Saved job listings are not available on this device yet.",
          );
        } else setNotice(error.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const applications = data.applications;
  const recommended = useMemo(
    () => [...data.jobs].sort((a, b) => b.match - a.match),
    [data.jobs],
  );
  const filteredApplications = useMemo(
    () =>
      applications.filter((application) => {
        const matchesSearch =
          `${application.job.company} ${application.job.title} ${application.job.location}`
            .toLowerCase()
            .includes(tableSearch.toLowerCase());
        return (
          matchesSearch &&
          (filter === "All statuses" || application.status === filter)
        );
      }),
    [applications, filter, tableSearch],
  );
  const interviewCount = applications.filter(
    (application) => application.status === "Interview",
  ).length;
  const offerCount = applications.filter(
    (application) => application.status === "Offer",
  ).length;
  const appliedCount = applications.filter((application) =>
    ["Applied", "Assessment", "Interview", "Offer", "Rejected"].includes(
      application.status,
    ),
  ).length;
  const responseCount = applications.filter((application) =>
    ["Assessment", "Interview", "Offer", "Rejected"].includes(
      application.status,
    ),
  ).length;

  async function postApi(body: Record<string, unknown>) {
    const response = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Request failed.");
    return result;
  }
  async function runSearch(searchTerm = query, silent = false) {
    if (searchInFlight.current) return;
    if (!navigator.onLine) {
      setOffline(true);
      if (!silent)
        setNotice(
          "Offline. Showing saved listings; new roles will load when your connection returns.",
        );
      return;
    }
    searchInFlight.current = true;
    setSearching(true);
    if (!silent) setNotice("");
    try {
      const result = (await postApi({
        action: "search",
        query: searchTerm,
      })) as { jobs: Job[]; errors: string[]; searchedAt?: string };
      const searchedAt = result.searchedAt ?? new Date().toISOString();
      const mergedJobs = [
        ...result.jobs,
        ...data.jobs.filter(
          (job) => !result.jobs.some((fresh) => fresh.id === job.id),
        ),
      ];
      setData((current) => ({
        ...current,
        jobs: mergedJobs,
        lastSearchAt: searchedAt,
      }));
      saveJobsSnapshot(mergedJobs, searchedAt);
      void fetch("/api/jobs").catch(() => undefined);
      setOffline(false);
      if (!silent)
        setNotice(
          result.errors.length
            ? `Some job sources did not respond: ${result.errors.join(", ")}. Results shown are from sources that did.`
            : `${result.jobs.length} current listings checked across connected feeds.`,
        );
    } catch (error) {
      if (!navigator.onLine) setOffline(true);
      if (!silent)
        setNotice(
          error instanceof Error ? error.message : "Job search failed.",
        );
    } finally {
      searchInFlight.current = false;
      setSearching(false);
    }
  }

  useEffect(() => {
    if (!data.profile) return;
    const refreshIfStale = () => {
      if (!navigator.onLine) {
        setOffline(true);
        return;
      }
      if (document.visibilityState !== "visible") return;
      const lastSearch = data.lastSearchAt ? Date.parse(data.lastSearchAt) : 0;
      if (Date.now() - lastSearch >= refreshInterval)
        void runSearch(data.profile?.roles[0] ?? query, true);
    };
    const interval = window.setInterval(refreshIfStale, refreshInterval);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshIfStale();
    };
    const onOnline = () => {
      setOffline(false);
      const lastSearch = data.lastSearchAt ? Date.parse(data.lastSearchAt) : 0;
      if (Date.now() - lastSearch >= refreshInterval)
        void runSearch(data.profile?.roles[0] ?? query, true);
    };
    const onOffline = () => setOffline(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [data.profile?.name, data.lastSearchAt, query]);

  useEffect(() => {
    if (!data.profile || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.ready
      .then((registration) => {
        const periodicSync = (
          registration as ServiceWorkerRegistration & {
            periodicSync?: {
              register: (
                tag: string,
                options: { minInterval: number },
              ) => Promise<void>;
            };
          }
        ).periodicSync;
        return periodicSync
          ?.register("gsbot-job-refresh", { minInterval: refreshInterval })
          .catch(() => undefined);
      })
      .catch(() => undefined);
  }, [data.profile?.name]);
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const savedProfile = { ...profileDraft };
      const result = (await postApi({
        action: "profile",
        profile: savedProfile,
      })) as { profile: Profile };
      setProfileCacheReady(true);
      setData((current) => ({ ...current, profile: result.profile }));
      if (resumeFile) {
        const form = new FormData();
        form.set("resume", resumeFile);
        const response = await fetch("/api/resume", {
          method: "POST",
          body: form,
        });
        const uploadResult = await response.json();
        if (!response.ok)
          throw new Error(uploadResult.error ?? "Resume upload failed.");
        const refreshed = await fetch("/api").then(
          (res) => res.json() as Promise<Store>,
        );
        setProfileDraft(refreshed.profile ?? savedProfile);
        setData(refreshed);
      }
      setSection("Home");
      setNotice("Profile saved. Starting your personalized search…");
      await runSearch(savedProfile.roles[0] ?? savedProfile.skills[0] ?? "");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save your profile.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function startApplication(job: Job) {
    try {
      const result = (await postApi({ action: "application", job })) as {
        application: Application;
      };
      setData((current) => ({
        ...current,
        applications: [
          result.application,
          ...current.applications.filter(
            (item) => item.id !== result.application.id,
          ),
        ],
      }));
      setNotice(
        `Added ${job.title} at ${job.company} to Pending approval. JoblyAI has not submitted an application.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not add application.",
      );
    }
  }
  async function changeStatus(application: Application, status: string) {
    const userConfirmed = status === "Applied";
    if (
      userConfirmed &&
      !window.confirm(
        "Did you submit this application on the employer's website? JoblyAI cannot verify portal submissions.",
      )
    )
      return;
    try {
      const result = (await postApi({
        action: "status",
        id: application.id,
        status,
        userConfirmed,
      })) as { application: Application };
      setData((current) => ({
        ...current,
        applications: current.applications.map((item) =>
          item.id === result.application.id ? result.application : item,
        ),
      }));
      setNotice(`Status updated to ${status}.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not update status.",
      );
    }
  }
  async function downloadResume(
    job: Job,
    text = data.profile?.resumeText ?? "",
  ) {
    try {
      const response = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, resumeText: text }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error ?? "PDF generation failed.",
        );
      const href = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `joblyai-${job.company.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-resume.pdf`;
      anchor.click();
      URL.revokeObjectURL(href);
      setNotice(
        "Job-specific PDF created from your existing resume text. No qualifications were added.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "PDF generation failed.",
      );
    }
  }
  async function coach() {
    setBusy(true);
    setCoachFeedback("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "STAR feedback",
          answer: coachAnswer,
          jobTitle: selectedJob?.title ?? profileDraft.roles[0],
          company: selectedJob?.company,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Coach is unavailable.");
      setCoachFeedback(result.feedback);
      setCoachMode(result.mode);
    } catch (error) {
      setCoachFeedback(
        error instanceof Error ? error.message : "Coach is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function deleteData() {
    if (
      !window.confirm(
        "Permanently delete your profile, resume text, job results, and application history from this device?",
      )
    )
      return;
    try {
      await postApi({ action: "delete" });
      setProfileCacheReady(false);
      clearJobsSnapshot();
      setOffline(false);
      setData(blankStore);
      setProfileDraft(blankProfile);
      setSection("Home");
      setNotice("Your local JoblyAI data has been deleted.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not delete data.",
      );
    }
  }
  function patchProfile(key: keyof Profile, value: string) {
    const listFields: (keyof Profile)[] = [
      "skills",
      "roles",
      "industries",
      "companies",
    ];
    setProfileDraft((current) => ({
      ...current,
      [key]: listFields.includes(key) ? listValue(value) : value,
    }));
  }
  function valueFor(key: keyof Profile) {
    const value = profileDraft[key];
    return Array.isArray(value) ? value.join(", ") : value;
  }

  if (loading)
    return (
      <main className="loading-screen">
        <BotAvatar size="small" mood="thinking" />
        <p>Waking up JoblyAI…</p>
      </main>
    );

  if (!data.profile)
    return (
      <main className="onboarding-shell">
        <div className="onboarding-top">
          <a className="brand" href="#">
            <span className="brand-mark">J</span> JoblyAI
          </a>
          <span className="privacy-note">
            <ShieldCheck size={15} /> Your profile is stored on this device
          </span>
        </div>
        <section className="onboarding-intro">
          <BotAvatar mood={busy ? "thinking" : "welcome"} />
          <div>
            <p className="eyebrow">YOUR SEARCH, WITH A SIDEKICK</p>
            <h1>
              A better next chapter
              <br />
              starts here.
            </h1>
            <p className="intro-copy">
              Tell JoblyAI what you&apos;re looking for. We&apos;ll find
              relevant roles, help shape your resume, and keep the moving pieces
              together.
            </p>
          </div>
        </section>
        <form className="onboarding-form" onSubmit={saveProfile}>
          <div className="form-heading">
            <div>
              <p className="eyebrow">01 / YOUR PROFILE</p>
              <h2>Let&apos;s make it yours</h2>
            </div>
            <span className="step-count">About 3 minutes</span>
          </div>
          <div className="form-grid">
            <label>
              Full name
              <input
                required
                value={profileDraft.name}
                onChange={(event) => patchProfile("name", event.target.value)}
                placeholder="Jordan Lee"
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={profileDraft.email}
                onChange={(event) => patchProfile("email", event.target.value)}
                placeholder="jordan@example.com"
              />
            </label>
            <label>
              Phone
              <input
                value={profileDraft.phone}
                onChange={(event) => patchProfile("phone", event.target.value)}
                placeholder="+1 555 0100"
              />
            </label>
            <label>
              Location
              <input
                value={profileDraft.location}
                onChange={(event) =>
                  patchProfile("location", event.target.value)
                }
                placeholder="City, country"
              />
            </label>
            <label className="span-two">
              Target roles <small>Separate with commas</small>
              <input
                value={valueFor("roles")}
                onChange={(event) => patchProfile("roles", event.target.value)}
                placeholder="Product designer, UX researcher"
              />
            </label>
            <label className="span-two">
              Skills <small>Separate with commas</small>
              <input
                value={valueFor("skills")}
                onChange={(event) => patchProfile("skills", event.target.value)}
                placeholder="Figma, research, prototyping"
              />
            </label>
            <label>
              Experience
              <input
                value={profileDraft.experience}
                onChange={(event) =>
                  patchProfile("experience", event.target.value)
                }
                placeholder="5 years, product design"
              />
            </label>
            <label>
              Education
              <input
                value={profileDraft.education}
                onChange={(event) =>
                  patchProfile("education", event.target.value)
                }
                placeholder="Degree or relevant study"
              />
            </label>
            <label>
              Salary expectation
              <input
                value={profileDraft.salary}
                onChange={(event) => patchProfile("salary", event.target.value)}
                placeholder="$90k–$120k"
              />
            </label>
            <label>
              Work preference
              <select
                value={profileDraft.workMode}
                onChange={(event) =>
                  patchProfile("workMode", event.target.value)
                }
              >
                <option>Remote or hybrid</option>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
                <option>Flexible</option>
              </select>
            </label>
            <label className="span-two">
              Target industries <small>Optional, comma-separated</small>
              <input
                value={valueFor("industries")}
                onChange={(event) =>
                  patchProfile("industries", event.target.value)
                }
                placeholder="Climate tech, healthcare, education"
              />
            </label>
            <label className="span-two">
              Companies you&apos;re interested in <small>Optional</small>
              <input
                value={valueFor("companies")}
                onChange={(event) =>
                  patchProfile("companies", event.target.value)
                }
                placeholder="Company names, separated by commas"
              />
            </label>
            <label className="upload-field span-two">
              <span>
                Resume <small>PDF or DOCX, up to 8 MB</small>
              </span>
              <span className="upload-control">
                <Upload size={17} />
                {resumeFile?.name ?? "Choose a file"}
                <input
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) =>
                    setResumeFile(event.target.files?.[0] ?? null)
                  }
                />
              </span>
            </label>
          </div>
          <div className="form-footer">
            <p>
              <ShieldCheck size={16} /> Stored locally and encrypted. No
              application is submitted without your action.
            </p>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Setting up…" : "Build my workspace"}
              <ArrowRight size={16} />
            </button>
          </div>
          {notice && <p className="notice error-notice">{notice}</p>}
        </form>
        <footer className="onboarding-footer">
          Your search companion, not your proxy. You stay in control of every
          application.
        </footer>
      </main>
    );

  return (
    <main className="app-shell">
      <aside className={`sidebar iosidebar ${mobileNav ? "open" : ""}`}>
        <div className="sidebar-brand">
          <a
            className="brand"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              setSection("Home");
            }}
          >
            <span className="brand-mark">J</span> JoblyAI
          </a>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileNav(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-label">YOUR CAREER SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {sections.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${section === name ? "active" : ""}`}
              onClick={() => {
                setSection(name);
                setMobileNav(false);
              }}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{name}</span>
              {name === "Applications" && applications.length > 0 && (
                <span className="nav-count">{applications.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="bot-tip">
            <BotAvatar size="tiny" mood="guide" />
            <div>
              <strong>A little nudge</strong>
              <p>
                {applications.length
                  ? "Your next step is one small thing."
                  : "Let's find your first good fit."}
              </p>
            </div>
          </div>
          <button
            className="profile-chip"
            onClick={() => setSection("Profile & settings")}
          >
            <span className="user-avatar">{initials(data.profile.name)}</span>
            <span className="profile-chip-name">
              <strong>{data.profile.name}</strong>
              <small>{data.profile.roles[0] ?? "Career explorer"}</small>
            </span>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar iosidebar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            Career space <span>/</span> <strong>{section}</strong>
          </div>
          <div className="topbar-right">
            <span className="sync-label">
              <span className="online-dot" /> Private workspace
            </span>
            <button
              className="icon-button"
              onClick={() => setSection("Reminders")}
              aria-label="Open reminders"
            >
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <button
              className="top-avatar"
              onClick={() => setSection("Profile & settings")}
            >
              {initials(data.profile.name)}
            </button>
          </div>
        </header>
        <div className="page-content iosmirror">
          {notice && (
            <div
              className={`notice ${notice.toLowerCase().includes("could not") || notice.toLowerCase().includes("failed") ? "error-notice" : ""}`}
              role="status"
            >
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {section === "Home" && (
            <>
              <section className="welcome-row">
                <div>
                  <p className="eyebrow">YOUR CAREER SPACE</p>
                  <h1>
                    Good to see you, {data.profile.name.split(" ")[0]}
                    <span className="heading-dot">.</span>
                  </h1>
                  <p className="welcome-copy">
                    Your next opportunity is out there. Let&apos;s bring it a
                    little closer.
                  </p>
                </div>
                <div className="bot-greeting">
                  <BotAvatar
                    mood={searching ? "search" : busy ? "thinking" : "welcome"}
                  />
                  <div>
                    <span className="bot-status">
                      <span className="online-dot" /> GS IS HERE
                    </span>
                    <p>
                      Ready when
                      <br />
                      you are.
                    </p>
                  </div>
                </div>
              </section>
              <section className="search-strip iosbg">
                <div className="search-icon">
                  <Search size={19} />
                </div>
                <input
                  aria-label="Search jobs"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setSection("Job search");
                      void runSearch();
                    }
                  }}
                  placeholder="Role, company, or skill"
                />
                <span className="search-divider" />
                <span className="location-hint">
                  {data.profile.location || "Any location"}
                </span>
                <button
                  className="primary-button search-button iosbtn"
                  onClick={() => {
                    setSection("Job search");
                    void runSearch();
                  }}
                  disabled={searching}
                >
                  {searching ? (
                    <span className="spinner" />
                  ) : (
                    <Search size={16} />
                  )}
                  <span>{searching ? "Searching" : "Find jobs"}</span>
                </button>
              </section>
              <div
                className={`feed-status ${offline ? "offline" : ""}`}
                role="status"
              >
                <span className={offline ? "offline-dot" : "online-dot"} />
                <span>
                  {offline
                    ? `Offline · saved listings from ${data.lastSearchAt ? new Date(data.lastSearchAt).toLocaleString() : "this device"}`
                    : data.lastSearchAt
                      ? `Last checked ${new Date(data.lastSearchAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · refreshes every 30 minutes while open`
                      : "Ready to check current listings"}
                </span>
                <button
                  className="secondary-button fetch-latest-button"
                  onClick={() => void runSearch(query)}
                  disabled={searching || offline}
                >
                  <RefreshCw
                    size={14}
                    className={searching ? "refreshing-icon" : ""}
                  />
                  {searching ? "Fetching…" : "Fetch latest jobs"}
                </button>
              </div>
              <section className="metric-grid">
                <Metric
                  icon={Activity}
                  label="Discovered"
                  value={data.jobs.length}
                  detail="across your sources"
                  accent="mint"
                />
                <Metric
                  icon={Heart}
                  label="Shortlisted"
                  value={
                    applications.filter((item) => item.status === "Shortlisted")
                      .length
                  }
                  detail="roles to revisit"
                  accent="rose"
                />
                <Metric
                  icon={Send}
                  label="Applications"
                  value={appliedCount}
                  detail="confirmed by you"
                  accent="blue"
                />
                <Metric
                  icon={CalendarDays}
                  label="Interviews"
                  value={interviewCount}
                  detail={`${offerCount} offer${offerCount === 1 ? "" : "s"} received`}
                  accent="gold"
                />
              </section>
              <section className="home-columns">
                <div className="content-column">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">A GOOD PLACE TO START</p>
                      <h2>Recommended for you</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setSection("Recommended")}
                    >
                      See all <ArrowRight size={15} />
                    </button>
                  </div>
                  {recommended.length ? (
                    <div className="job-list">
                      {recommended.slice(0, 3).map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          onOpen={setSelectedJob}
                          onApply={startApplication}
                          applied={applications.some(
                            (item) => item.job.id === job.id,
                          )}
                        />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Compass}
                      title="Your first recommendations are close"
                      text="Run a search to bring in current roles from public job feeds."
                      action="Search jobs"
                      onClick={() => setSection("Job search")}
                    />
                  )}
                </div>
                <aside className="home-aside">
                  <div className="aside-heading">
                    <span className="aside-icon mint">
                      <Sparkles size={17} />
                    </span>
                    <div>
                      <p className="eyebrow">YOUR MOMENTUM</p>
                      <h3>Small steps add up</h3>
                    </div>
                  </div>
                  <div className="momentum-row">
                    <div
                      className="ring"
                      style={
                        {
                          "--progress": `${Math.min(100, applications.length * 20)}%`,
                        } as React.CSSProperties
                      }
                    >
                      <span>
                        {Math.min(100, applications.length * 20)}
                        <small>%</small>
                      </span>
                    </div>
                    <p>
                      Your search setup
                      <br />
                      is in good shape.
                    </p>
                  </div>
                  <div className="aside-divider" />
                  <div className="next-step">
                    <span className="step-number">01</span>
                    <div>
                      <strong>
                        {data.profile.resumeName
                          ? "Resume is ready"
                          : "Add a resume"}
                      </strong>
                      <p>
                        {data.profile.resumeName
                          ? data.profile.resumeName
                          : "Give JoblyAI your starting point."}
                      </p>
                    </div>
                    <button
                      className="round-arrow"
                      onClick={() => setSection("Resume studio")}
                      aria-label="Open resume studio"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <div className="next-step">
                    <span className="step-number">02</span>
                    <div>
                      <strong>Practice one answer</strong>
                      <p>Turn a real story into a strong response.</p>
                    </div>
                    <button
                      className="round-arrow"
                      onClick={() => setSection("Interview coach")}
                      aria-label="Open interview coach"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </aside>
              </section>
              <section className="bottom-insight">
                <div className="insight-mark">
                  <Gauge size={18} />
                </div>
                <div>
                  <strong>Your search, at a glance</strong>
                  <p>
                    {responseCount
                      ? `${responseCount} of ${appliedCount} recorded applications have a response.`
                      : "A good match is more than a score. Check the listing details before you apply."}
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setSection("Applications")}
                >
                  Open tracker <ArrowRight size={15} />
                </button>
              </section>
            </>
          )}

          {section === "Job search" && (
            <>
              <PageTitle
                eyebrow="FRESH FROM THE FEED"
                title="Find your next role"
                subtitle="Live listings from public job feeds. Verify details on the employer site before applying."
              />
              <div className="search-strip section-search iosbg">
                <div className="search-icon">
                  <Search size={19} />
                </div>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runSearch();
                  }}
                  placeholder="Try a title, company, or skill"
                />
                <span className="location-hint">
                  {data.profile.location || "Any location"}
                </span>
                <button
                  className="primary-button iosbtn search-button"
                  onClick={() => void runSearch()}
                  disabled={searching}
                >
                  {searching ? (
                    <span className="spinner" />
                  ) : (
                    <Search size={16} />
                  )}
                  {searching ? "Searching" : "Search roles"}
                </button>
              </div>
              <div className="source-note">
                <ShieldCheck size={15} /> Sources: Remotive and Arbeitnow ·{" "}
                {data.lastSearchAt
                  ? `Last checked ${dateLabel(data.lastSearchAt)}`
                  : "Search to check current listings"}
              </div>
              <JobResults
                jobs={data.jobs}
                applications={applications}
                onOpen={setSelectedJob}
                onApply={startApplication}
                onSearch={() => void runSearch()}
                searching={searching}
              />
            </>
          )}

          {section === "Recommended" && (
            <>
              <PageTitle
                eyebrow="MATCHED TO YOUR PROFILE"
                title="Recommended jobs"
                subtitle="A useful starting point, not a promise of eligibility. Scores are keyword estimates."
              />
              <div className="results-summary">
                <span>{recommended.length} roles found</span>
                <span className="score-legend">
                  <i /> Higher profile overlap
                </span>
                <button
                  className="quiet-button"
                  onClick={() => void runSearch()}
                  disabled={searching}
                >
                  <Activity size={15} /> Refresh results
                </button>
              </div>
              <JobResults
                jobs={recommended}
                applications={applications}
                onOpen={setSelectedJob}
                onApply={startApplication}
                onSearch={() => void runSearch()}
                searching={searching}
              />
            </>
          )}

          {section === "Resume studio" && (
            <>
              <PageTitle
                eyebrow="YOUR STORY, SHARPLY TOLD"
                title="Resume studio"
                subtitle="Keep your experience honest, make relevance easier to see, and export a clean PDF."
              />
              <div className="studio-layout">
                <div className="studio-main">
                  <div className="studio-panel">
                    <div className="panel-top">
                      <div className="panel-icon">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h3>Source resume</h3>
                        <p>
                          {data.profile.resumeName || "No resume uploaded yet"}
                        </p>
                      </div>
                      <label className="secondary-button upload-button">
                        <Upload size={15} /> Upload PDF / DOCX
                        <input
                          type="file"
                          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const form = new FormData();
                            form.set("resume", file);
                            try {
                              const response = await fetch("/api/resume", {
                                method: "POST",
                                body: form,
                              });
                              const result = await response.json();
                              if (!response.ok) throw new Error(result.error);
                              const refreshed = await fetch("/api").then(
                                (res) => res.json(),
                              );
                              setData(refreshed);
                              setProfileDraft(refreshed.profile);
                              setNotice(
                                `Resume analyzed: ${result.characters.toLocaleString()} readable characters extracted.`,
                              );
                            } catch (error) {
                              setNotice(
                                error instanceof Error
                                  ? error.message
                                  : "Resume upload failed.",
                              );
                            }
                          }}
                        />
                      </label>
                    </div>
                    {data.profile.resumeText ? (
                      <div className="resume-preview">
                        {data.profile.resumeText.slice(0, 2400)}
                        {data.profile.resumeText.length > 2400 ? "…" : ""}
                      </div>
                    ) : (
                      <div className="empty-upload">
                        <Upload size={21} />
                        <p>Upload a text-based PDF or DOCX to begin.</p>
                      </div>
                    )}
                  </div>
                  <div className="studio-panel">
                    <div className="panel-top">
                      <div className="panel-icon coral">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h3>Job-specific version</h3>
                        <p>
                          Uses your existing text; it never adds experience or
                          qualifications.
                        </p>
                      </div>
                    </div>
                    {recommended.length ? (
                      <div className="resume-target-list">
                        {recommended.slice(0, 4).map((job) => (
                          <div className="resume-target" key={job.id}>
                            <div>
                              <strong>{job.title}</strong>
                              <span>
                                {job.company} · Estimated keyword overlap{" "}
                                {job.ats}%
                              </span>
                            </div>
                            <button
                              className="secondary-button compact"
                              onClick={() => void downloadResume(job)}
                            >
                              <ArrowDownToLine size={15} /> Export PDF
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon={FileText}
                        title="Find a target role first"
                        text="Search jobs and your resume studio will create PDF versions per role."
                        action="Search roles"
                        onClick={() => setSection("Job search")}
                      />
                    )}
                  </div>
                </div>
                <aside className="studio-side">
                  <div className="score-card">
                    <p className="eyebrow">ATS KEYWORD ESTIMATE</p>
                    <div className="score-number">
                      {recommended[0]?.ats ?? "—"}
                      <small>
                        {recommended.length ? "/ 100" : "No target"}
                      </small>
                    </div>
                    <div className="score-track">
                      <span style={{ width: `${recommended[0]?.ats ?? 0}%` }} />
                    </div>
                    <p className="score-disclaimer">
                      A rough keyword overlap signal only. Employer systems
                      differ; this is not an actual ATS score.
                    </p>
                  </div>
                  <div className="keyword-card">
                    <h3>Skills in your profile</h3>
                    {data.profile.skills.length ? (
                      <div className="skill-tags">
                        {data.profile.skills.map((skill) => (
                          <span key={skill}>{skill}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        Add skills in your profile to improve matching.
                      </p>
                    )}
                    <button
                      className="text-button"
                      onClick={() => setSection("Profile & settings")}
                    >
                      Edit profile <ArrowRight size={15} />
                    </button>
                  </div>
                </aside>
              </div>
            </>
          )}

          {section === "Applications" && (
            <>
              <PageTitle
                eyebrow="KEEP THE THREAD"
                title="Applications tracker"
                subtitle="Every status is recorded by you. JoblyAI never reports a portal submission as confirmed."
              />
              <div className="tracker-stats">
                <span>
                  <strong>{applications.length}</strong> in your pipeline
                </span>
                <span>
                  <strong>{appliedCount}</strong> marked applied
                </span>
                <span>
                  <strong>{interviewCount}</strong> interviews
                </span>
                <span>
                  <strong>{offerCount}</strong> offers
                </span>
              </div>
              <div className="table-toolbar">
                <div className="table-search">
                  <Search size={16} />
                  <input
                    aria-label="Search applications"
                    value={tableSearch}
                    onChange={(event) => setTableSearch(event.target.value)}
                    placeholder="Search roles or companies"
                  />
                </div>
                <div className="filter-wrap">
                  <Filter size={15} />
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option>All statuses</option>
                    {[
                      "Pending approval",
                      "Shortlisted",
                      "Resume ready",
                      "Applied",
                      "Assessment",
                      "Interview",
                      "Offer",
                      "Rejected",
                    ].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
              {filteredApplications.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ROLE</th>
                        <th>STATUS</th>
                        <th>ADDED</th>
                        <th>FIT ESTIMATE</th>
                        <th>NEXT STEP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplications.map((application) => (
                        <tr key={application.id}>
                          <td>
                            <div className="table-role">
                              <span className="company-mark">
                                {initials(application.job.company)}
                              </span>
                              <div>
                                <a
                                  href={application.job.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {application.job.title}
                                </a>
                                <span>
                                  {application.job.company} ·{" "}
                                  {application.job.location}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <StatusPill status={application.status} />
                          </td>
                          <td>
                            {new Date(
                              application.createdAt,
                            ).toLocaleDateString()}
                          </td>
                          <td>
                            <span className="table-score">
                              {application.job.ats}%
                            </span>
                          </td>
                          <td>
                            <select
                              className="status-select"
                              value={application.status}
                              onChange={(event) =>
                                void changeStatus(
                                  application,
                                  event.target.value,
                                )
                              }
                              aria-label={`Update ${application.job.title} status`}
                            >
                              <option value={application.status}>
                                {application.status}
                              </option>
                              {[
                                "Shortlisted",
                                "Resume ready",
                                "Applied",
                                "Assessment",
                                "Interview",
                                "Offer",
                                "Rejected",
                              ]
                                .filter(
                                  (status) => status !== application.status,
                                )
                                .map((status) => (
                                  <option key={status}>{status}</option>
                                ))}
                            </select>
                            <button
                              className="table-download"
                              title="Download the resume saved with this application"
                              onClick={() =>
                                void downloadResume(
                                  application.job,
                                  application.resumeText,
                                )
                              }
                            >
                              <ArrowDownToLine size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={BriefcaseBusiness}
                  title={
                    applications.length
                      ? "No applications match those filters"
                      : "Your pipeline starts with one good fit"
                  }
                  text={
                    applications.length
                      ? "Try a different search or status."
                      : "Save a job to create a pending-approval record. Apply directly on the employer's site, then update its status here."
                  }
                  action={
                    applications.length
                      ? "Clear filters"
                      : "Explore recommended"
                  }
                  onClick={() =>
                    applications.length
                      ? (setFilter("All statuses"), setTableSearch(""))
                      : setSection("Recommended")
                  }
                />
              )}
            </>
          )}

          {section === "Interview coach" && (
            <>
              <PageTitle
                eyebrow="PRACTICE, WITHOUT THE PRESSURE"
                title="Interview coach"
                subtitle="Build answers from your own experience. JoblyAI won't make up achievements for you."
              />
              <div className="coach-layout">
                <div className="coach-main">
                  <div className="coach-top">
                    <div className="bot-face">
                      <span />
                      <i />
                    </div>
                    <div>
                      <span className="bot-status">
                        <span className="online-dot" /> YOUR PRACTICE SPACE
                      </span>
                      <h2>Let&apos;s find the story in your experience.</h2>
                      <p>
                        Choose a role, then answer a prompt out loud or in
                        writing. You&apos;ll get STAR-structured feedback.
                      </p>
                    </div>
                  </div>
                  <label className="coach-select-label">
                    Practice for
                    <select
                      value={selectedJob?.id ?? ""}
                      onChange={(event) =>
                        setSelectedJob(
                          recommended.find(
                            (job) => job.id === event.target.value,
                          ) ?? null,
                        )
                      }
                    >
                      <option value="">General interview practice</option>
                      {recommended.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.title} · {job.company}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="question-block">
                    <span className="question-label">TRY THIS QUESTION</span>
                    <p>
                      {selectedJob
                        ? `What interests you about the ${selectedJob.title} role at ${selectedJob.company}, and how does your experience prepare you for it?`
                        : "Tell me about a time you solved a difficult problem with limited information."}
                    </p>
                    <button
                      className="text-button"
                      onClick={() => {
                        setCoachAnswer("");
                        setCoachFeedback("");
                      }}
                    >
                      Start fresh <ArrowRight size={14} />
                    </button>
                  </div>
                  <label className="answer-label">
                    Your answer
                    <textarea
                      value={coachAnswer}
                      onChange={(event) => setCoachAnswer(event.target.value)}
                      placeholder="Use a real moment. What was happening, what did you do, and what changed?"
                      rows={7}
                    />
                  </label>
                  <div className="coach-actions">
                    <span>
                      <ShieldCheck size={15} /> Your answer stays in this
                      workspace unless AI is configured.
                    </span>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={() => void coach()}
                    >
                      {busy ? "Thinking…" : "Get feedback"}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {coachFeedback && (
                    <div className="feedback-box">
                      <div className="feedback-heading">
                        <Sparkles size={16} />
                        <strong>Coach notes</strong>
                        <span>
                          {coachMode === "ai" ? "AI COACH" : "STAR GUIDE"}
                        </span>
                      </div>
                      <p>{coachFeedback}</p>
                    </div>
                  )}
                </div>
                <aside className="coach-aside">
                  <div className="aside-heading">
                    <span className="aside-icon coral">
                      <MessageCircle size={17} />
                    </span>
                    <div>
                      <p className="eyebrow">QUESTION BANK</p>
                      <h3>Good ones to rehearse</h3>
                    </div>
                  </div>
                  {[
                    "Tell me about a time you received difficult feedback.",
                    "Describe a project that did not go to plan.",
                    "What kind of work helps you do your best?",
                    "How do you decide what to prioritize?",
                  ].map((question, index) => (
                    <button
                      key={question}
                      className="practice-prompt"
                      onClick={() => {
                        setCoachAnswer("");
                        setCoachFeedback("");
                      }}
                    >
                      {String(index + 1).padStart(2, "0")}
                      <span>{question}</span>
                      <ArrowRight size={14} />
                    </button>
                  ))}
                  <div className="star-note">
                    <strong>A small STAR reminder</strong>
                    <p>
                      Situation · Task · Action · Result. Keep the spotlight on
                      what you did.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}

          {section === "Reminders" && (
            <>
              <PageTitle
                eyebrow="KEEP YOUR PROMISES TO YOURSELF"
                title="Reminders"
                subtitle="A clear next step beats a perfect plan."
              />
              {applications.length ? (
                <div className="reminder-list">
                  {applications.map((application) => (
                    <div className="reminder-item" key={application.id}>
                      <span className="reminder-date">
                        <CalendarDays size={16} />
                        {dateLabel(application.updatedAt)}
                      </span>
                      <div>
                        <strong>
                          {application.status === "Pending approval"
                            ? "Review and apply on employer site"
                            : application.status === "Interview"
                              ? "Prepare for your interview"
                              : "Follow up or check for an update"}
                        </strong>
                        <p>
                          {application.job.title} · {application.job.company}
                        </p>
                      </div>
                      <a
                        className="round-arrow"
                        href={application.job.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open job listing"
                      >
                        <ArrowRight size={15} />
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CalendarDays}
                  title="Nothing to follow up on yet"
                  text="When you save a role, JoblyAI will keep your next action visible here."
                  action="Find a role"
                  onClick={() => setSection("Job search")}
                />
              )}
            </>
          )}

          {section === "Profile & settings" && (
            <>
              <PageTitle
                eyebrow="YOUR DETAILS, YOUR CALL"
                title="Profile & settings"
                subtitle="Keep your search preferences accurate. Your files and profile are encrypted in local storage."
              />
              <form className="settings-form" onSubmit={saveProfile}>
                <div className="settings-section">
                  <div>
                    <p className="eyebrow">PERSONAL DETAILS</p>
                    <h2>Profile</h2>
                  </div>
                  <div className="settings-fields">
                    {(
                      [
                        ["name", "Full name"],
                        ["email", "Email"],
                        ["phone", "Phone"],
                        ["location", "Location"],
                        ["roles", "Target roles"],
                        ["skills", "Skills"],
                        ["experience", "Experience"],
                        ["education", "Education"],
                        ["salary", "Salary expectation"],
                        ["industries", "Industries"],
                        ["companies", "Target companies"],
                      ] as [keyof Profile, string][]
                    ).map(([key, label]) => (
                      <label key={key}>
                        {label}
                        {[
                          "skills",
                          "roles",
                          "industries",
                          "companies",
                        ].includes(key) && <small>Comma-separated</small>}
                        <input
                          value={valueFor(key)}
                          onChange={(event) =>
                            patchProfile(key, event.target.value)
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Work preference
                      <select
                        value={profileDraft.workMode}
                        onChange={(event) =>
                          patchProfile("workMode", event.target.value)
                        }
                      >
                        {[
                          "Remote or hybrid",
                          "Remote",
                          "Hybrid",
                          "On-site",
                          "Flexible",
                        ].map((mode) => (
                          <option key={mode}>{mode}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="settings-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save profile"}
                      <Check size={15} />
                    </button>
                  </div>
                </div>
                <div className="settings-section danger-zone">
                  <div>
                    <p className="eyebrow">DATA CONTROL</p>
                    <h2>Delete local data</h2>
                    <p>
                      Removes your profile, extracted resume text, saved
                      listings, and application history from this device.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => void deleteData()}
                  >
                    <Trash2 size={15} /> Delete my data
                  </button>
                </div>
                <div className="settings-section privacy-section">
                  <ShieldCheck size={20} />
                  <p>
                    JoblyAI runs as a local single-user workspace. Do not expose
                    it to the public internet without adding authentication,
                    deployment-grade secret management, and an appropriate
                    privacy review.
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </section>
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      {selectedJob && (
        <JobModal
          job={selectedJob}
          resumeText={data.profile.resumeText}
          applied={applications.some((item) => item.job.id === selectedJob.id)}
          onClose={() => setSelectedJob(null)}
          onApply={async () => {
            await startApplication(selectedJob);
            setSelectedJob(null);
          }}
          onDownload={() => void downloadResume(selectedJob)}
        />
      )}
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Home;
  label: string;
  value: number;
  detail: string;
  accent: string;
}) {
  return (
    <div className="metric-card">
      <span className={`metric-icon ${accent}`}>
        <Icon size={17} />
      </span>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>
        {title}
        <span className="heading-dot">.</span>
      </h1>
      <p>{subtitle}</p>
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: typeof Home;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={20} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="secondary-button" onClick={onClick}>
        {action}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
function JobCard({
  job,
  onOpen,
  onApply,
  applied,
}: {
  job: Job;
  onOpen: (job: Job) => void;
  onApply: (job: Job) => void;
  applied: boolean;
}) {
  return (
    <article className="job-card">
      <div className="company-mark large">{initials(job.company)}</div>
      <div className="job-card-body">
        <div className="job-card-heading">
          <div>
            <button className="job-title-button" onClick={() => onOpen(job)}>
              {job.title}
            </button>
            <p>
              {job.company} <span>·</span> {job.location}
            </p>
          </div>
          <button
            className="icon-button save-icon"
            title="Save for application tracking"
            onClick={() => onApply(job)}
            disabled={applied}
          >
            {applied ? <Check size={17} /> : <Heart size={17} />}
          </button>
        </div>
        <div className="job-card-meta">
          <span>{job.remote ? "Remote" : job.location}</span>
          <span>{job.salary}</span>
          <span>{dateLabel(job.postedAt)}</span>
          <span className="source-tag">{job.source}</span>
          {job.suspicious && (
            <span className="suspicious-tag">
              <TriangleAlert size={11} /> Verify carefully
            </span>
          )}
        </div>
        <div className="job-card-footer">
          <div className="match-line">
            <span className="match-dot" />
            {job.match}% profile overlap{" "}
            <span className="meta-separator">·</span> ATS estimate {job.ats}%
          </div>
          <button className="text-button" onClick={() => onOpen(job)}>
            Review role <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
function JobResults({
  jobs,
  applications,
  onOpen,
  onApply,
  onSearch,
  searching,
}: {
  jobs: Job[];
  applications: Application[];
  onOpen: (job: Job) => void;
  onApply: (job: Job) => void;
  onSearch: () => void;
  searching: boolean;
}) {
  return jobs.length ? (
    <div className="job-list results-list">
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          onOpen={onOpen}
          onApply={onApply}
          applied={applications.some((item) => item.job.id === job.id)}
        />
      ))}
    </div>
  ) : (
    <EmptyState
      icon={Search}
      title={searching ? "Checking your sources…" : "No listings yet"}
      text="Search current public listings. Source availability and job freshness depend on each feed."
      action={searching ? "Searching" : "Search now"}
      onClick={onSearch}
    />
  );
}
function StatusPill({ status }: { status: string }) {
  const color =
    status === "Offer"
      ? "green"
      : status === "Interview"
        ? "blue"
        : status === "Rejected"
          ? "gray"
          : status === "Pending approval"
            ? "amber"
            : "neutral";
  return (
    <span className={`status-pill ${color}`}>
      <i />
      {status}
    </span>
  );
}
function BotAvatar({
  size = "regular",
  mood,
}: {
  size?: "regular" | "tiny" | "small";
  mood: "welcome" | "search" | "thinking" | "coach" | "guide";
}) {
  return (
    <div className={`bot-face ${size} mood-${mood}`} aria-hidden="true">
      <span />
      <i />
      <b />
    </div>
  );
}
function JobModal({
  job,
  resumeText,
  applied,
  onClose,
  onApply,
  onDownload,
}: {
  job: Job;
  resumeText: string;
  applied: boolean;
  onClose: () => void;
  onApply: () => void;
  onDownload: () => void;
}) {
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterMode, setCoverLetterMode] = useState("");
  const [drafting, setDrafting] = useState(false);
  const stopWords = new Set([
    "about",
    "after",
    "also",
    "and",
    "are",
    "can",
    "for",
    "from",
    "have",
    "into",
    "its",
    "our",
    "that",
    "the",
    "their",
    "this",
    "with",
    "you",
    "your",
  ]);
  const terms =
    job.description.toLowerCase().match(/\b[a-z][a-z0-9+#.-]{3,}\b/g) ?? [];
  const missing = [...new Set(terms)]
    .filter(
      (word) =>
        !stopWords.has(word) && !resumeText.toLowerCase().includes(word),
    )
    .slice(0, 8);
  async function draftCoverLetter() {
    setDrafting(true);
    try {
      const response = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not draft cover letter.");
      setCoverLetter(result.letter);
      setCoverLetterMode(result.mode);
    } catch (error) {
      setCoverLetter(
        error instanceof Error
          ? error.message
          : "Could not draft cover letter.",
      );
      setCoverLetterMode("error");
    } finally {
      setDrafting(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="job-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">ROLE DETAILS · {job.source.toUpperCase()}</p>
            <h2 id="modal-title">{job.title}</h2>
            <p>
              {job.company} · {job.location}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <div className="modal-meta">
          <span>{job.salary}</span>
          <span>{dateLabel(job.postedAt)}</span>
          <span>{job.match}% profile overlap</span>
          <span>ATS estimate {job.ats}%</span>
        </div>
        {job.suspicious && (
          <div className="suspicious-notice">
            <TriangleAlert size={15} /> This listing has a suspicious signal.
            Verify the employer and application link before sharing information.
          </div>
        )}
        <div className="modal-description">
          {job.description ||
            "The source did not provide a readable description. Review the original listing."}
        </div>
        <div className="keyword-gap">
          <strong>JD terms not found in your resume</strong>
          <p>
            {missing.join(" · ") ||
              "No obvious missing terms detected. Compare requirements with your actual experience."}
          </p>
        </div>
        <div className="cover-letter-tools">
          <button
            className="secondary-button"
            onClick={() => void draftCoverLetter()}
            disabled={drafting}
          >
            <Sparkles size={14} />
            {drafting
              ? "Drafting…"
              : coverLetter
                ? "Draft again"
                : "Draft cover letter"}
          </button>
          {coverLetter && coverLetterMode !== "error" && (
            <>
              <span>{coverLetterMode}</span>
              <button
                className="icon-button"
                title="Copy cover letter"
                onClick={() => void navigator.clipboard.writeText(coverLetter)}
              >
                <Clipboard size={15} />
              </button>
              <button
                className="icon-button"
                title="Download cover letter"
                onClick={() => {
                  const href = URL.createObjectURL(
                    new Blob([coverLetter], { type: "text/plain" }),
                  );
                  const anchor = document.createElement("a");
                  anchor.href = href;
                  anchor.download = `joblyai-${job.company.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-cover-letter.txt`;
                  anchor.click();
                  URL.revokeObjectURL(href);
                }}
              >
                <ArrowDownToLine size={15} />
              </button>
            </>
          )}
        </div>
        {coverLetter && (
          <textarea
            className="cover-letter-text"
            aria-label="Editable cover letter draft"
            value={coverLetter}
            onChange={(event) => setCoverLetter(event.target.value)}
            rows={7}
          />
        )}
        <div className="modal-footer">
          <a
            className="secondary-button"
            href={job.url}
            target="_blank"
            rel="noreferrer"
          >
            Open original listing <ArrowRight size={14} />
          </a>
          <button className="secondary-button" onClick={onDownload}>
            <ArrowDownToLine size={15} /> Resume PDF
          </button>
          <button
            className="primary-button"
            onClick={onApply}
            disabled={applied}
          >
            {applied ? "In your tracker" : "Prepare application"}
            <ArrowRight size={15} />
          </button>
        </div>
        <p className="approval-disclaimer">
          This creates a pending-approval tracker entry only. Review and submit
          on the employer&apos;s official site.
        </p>
      </section>
    </div>
  );
}
