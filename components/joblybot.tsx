"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, BriefcaseBusiness, MapPin, Send, Sparkles, X } from "lucide-react";

type Job = {
  id: string;
  title: string;
  location: string;
  workMode: string;
  jobType?: string;
  skills?: string[];
  company: { name: string };
};

type Message = {
  id: number;
  role: "bot" | "user";
  text: string;
  jobs?: Job[];
};

const suggestions = [ "Remote jobs", "Jobs for freshers"];
const skills = ["Next.js", "React", "Node.js", "Python", "JavaScript", "TypeScript", "Java", "Frontend", "Backend", "Full Stack", "DevOps", "PostgreSQL", "AWS"];

function getFilters(message: string) {
  const text = message.toLowerCase();
  const params = new URLSearchParams();
  const skill = skills.find((item) => text.includes(item.toLowerCase()));

  if (skill) params.set("search", skill);
  if (text.includes("remote")) params.set("workMode", "REMOTE");
  else if (text.includes("hybrid")) params.set("workMode", "HYBRID");
  else if (/onsite|on-site|office/.test(text)) params.set("workMode", "ONSITE");

  if (/intern(ship)?/.test(text)) params.set("jobType", "INTERNSHIP");
  if (/fresher|entry.level/.test(text)) params.set("experienceLevel", "ENTRY");

  const place = ["India", "Pune", "Bengaluru", "Mumbai", "Hyderabad", "Delhi"]
    .find((item) => text.includes(item.toLowerCase()));

  if (place) params.set(place === "India" ? "country" : "location", place);
  return params;
}

/* Twinkling sparkle used around the mascot */
function Sparkle({ x, y, delay = 0, color = "#a78bfa" }: { x: number; y: number; delay?: number; color?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.path
        d="M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7Z"
        fill={color}
        animate={reduceMotion ? undefined : { scale: [0.5, 1.15, 0.5], opacity: [0.35, 1, 0.35], rotate: [0, 20, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, delay, ease: "easeInOut" }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </g>
  );
}

/* Cute plush mascot (SVG + motion) */
function Muse({ small = false, className }: { small?: boolean; className?: string }) {
  const reduceMotion = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const fur = `fur-${uid}`, orb = `orb-${uid}`, blur = `blur-${uid}`;
  const box = { transformBox: "fill-box", transformOrigin: "center" } as const;
  const earBase = { transformBox: "fill-box", transformOrigin: "50% 90%" } as const;

  return (
    <motion.div
      animate={reduceMotion || small ? undefined : { y: [0, -4, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      role="img"
      aria-label="Muse mascot"
      className={`relative shrink-0 ${className ?? (small ? "h-full w-full" : "h-32 w-28")}`}
    >
      <svg viewBox={small ? "12 6 96 90" : "0 0 120 130"} className="h-full w-full overflow-visible" aria-hidden>
        <defs>
          <radialGradient id={fur} cx="35%" cy="25%" r="85%">
            <stop offset="0" stopColor="#fff6ea" />
            <stop offset="0.55" stopColor="#f3dcc0" />
            <stop offset="1" stopColor="#d9b88f" />
          </radialGradient>
          <radialGradient id={orb} cx="32%" cy="26%" r="80%">
            <stop offset="0" stopColor="#e6ffff" />
            <stop offset="0.25" stopColor="#67e5ff" />
            <stop offset="0.65" stopColor="#4f8cf0" />
            <stop offset="1" stopColor="#8b6cf0" />
          </radialGradient>
          <filter id={blur} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {!small && (
          <>
            {/* shadow, body, feet */}
            <motion.ellipse
              cx="60" cy="124" rx="26" ry="4" fill="#8d6c49" opacity="0.18"
              animate={reduceMotion ? undefined : { scaleX: [1, 0.85, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={box}
            />
            <ellipse cx="60" cy="98" rx="26" ry="22" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />
            <ellipse cx="46" cy="119" rx="10" ry="6" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />
            <ellipse cx="74" cy="119" rx="10" ry="6" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />
          </>
        )}

        {/* ears */}
        <motion.g animate={reduceMotion ? undefined : { rotate: [0, -5, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }} style={earBase}>
          <circle cx="30" cy="30" r="15" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />
          <circle cx="30" cy="31" r="8" fill="#ffc9d6" />
        </motion.g>
        <motion.g animate={reduceMotion ? undefined : { rotate: [0, 5, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} style={earBase}>
          <circle cx="90" cy="30" r="15" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />
          <circle cx="90" cy="31" r="8" fill="#ffc9d6" />
        </motion.g>

        {/* head */}
        <ellipse cx="60" cy="56" rx="40" ry="34" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />
        <path d="M60 23 C58 14 66 12 65 18" stroke="#c9a77f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <ellipse cx="60" cy="68" rx="14" ry="9.5" fill="#fff7ef" />

        {/* eyes (blink) */}
        <motion.g
          animate={reduceMotion ? undefined : { scaleY: [1, 1, 0.1, 1, 1] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.46, 0.5, 0.54, 1] }}
          style={box}
        >
          <ellipse cx="44" cy="55" rx="6.5" ry="8" fill="#2b1d1a" />
          <ellipse cx="76" cy="55" rx="6.5" ry="8" fill="#2b1d1a" />
          <circle cx="46.5" cy="52" r="2.6" fill="#fff" />
          <circle cx="42.5" cy="58.5" r="1.3" fill="#fff" />
          <circle cx="78.5" cy="52" r="2.6" fill="#fff" />
          <circle cx="74.5" cy="58.5" r="1.3" fill="#fff" />
        </motion.g>

        {/* blush, nose, smile */}
        <ellipse cx="34" cy="67" rx="7" ry="4" fill="#ff9fb5" opacity="0.55" />
        <ellipse cx="86" cy="67" rx="7" ry="4" fill="#ff9fb5" opacity="0.55" />
        <ellipse cx="60" cy="64" rx="3.2" ry="2.4" fill="#5a3d33" />
        <path d="M54 70 Q57 75 60 70 Q63 75 66 70" stroke="#5a3d33" strokeWidth="1.8" fill="none" strokeLinecap="round" />

        {!small && (
          <>
            {/* glowing orb + paws */}
            <circle cx="60" cy="102" r="17" fill="#67e5ff" opacity="0.45" filter={`url(#${blur})`} />
            <motion.g
              animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={box}
            >
              <circle cx="60" cy="102" r="12.5" fill={`url(#${orb})`} stroke="#fff" strokeOpacity="0.85" strokeWidth="2" />
              <ellipse cx="55.5" cy="97" rx="3.2" ry="2.2" fill="#fff" opacity="0.85" transform="rotate(-30 55.5 97)" />
              <path d="M49 104 Q60 98 71 104" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" fill="none" />
            </motion.g>
            <circle cx="46" cy="104" r="8" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />
            <circle cx="74" cy="104" r="8" fill={`url(#${fur})`} stroke="#cfae88" strokeWidth="1.2" />

            <Sparkle x={108} y={22} />
            <Sparkle x={10} y={46} delay={0.8} color="#67e5ff" />
            <Sparkle x={106} y={84} delay={1.6} color="#fbbf24" />
          </>
        )}
      </svg>
    </motion.div>
  );
}

function JobCard({ job }: { job: Job }) {
  return (
    <a href={`/jobs/${job.id}`} className="group mt-2 block rounded-2xl border border-orange-100 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-500">
          <BriefcaseBusiness size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-stone-800">{job.title}</h3>
          <p className="mt-1 text-xs text-stone-500">{job.company.name}</p>
        </div>
        <ArrowRight size={16} className="text-violet-400 transition group-hover:translate-x-1" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
        <span className="inline-flex items-center gap-1 text-stone-500"><MapPin size={11} />{job.location}</span>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{job.workMode.replace("_", " ")}</span>
        {job.jobType && <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">{job.jobType.replace("_", " ")}</span>}
      </div>
      {!!job.skills?.length && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {job.skills.slice(0, 4).map((skill) => <span key={skill} className="rounded-md bg-orange-50 px-2 py-1 text-[10px] text-stone-600">{skill}</span>)}
        </div>
      )}
    </a>
  );
}

export default function JoblyBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: "bot", text: "I'm JoblyAI ✨, what you're looking for..." },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);
  const busy = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, typing, open, reduceMotion]);

  async function sendMessage(raw: string, event?: FormEvent) {
    event?.preventDefault();
    const text = raw.trim();
    if (!text || busy.current) return;

    busy.current = true;
    setInput("");
    setMessages((prev) => [...prev, { id: nextId.current++, role: "user", text }]);
    setTyping(true);

    const reply = (text: string, jobs?: Job[]) =>
      setMessages((prev) => [...prev, { id: nextId.current++, role: "bot", text, jobs }]);

    try {
      const lower = text.toLowerCase();

      if (/^(hi|hii|hello|hey|good morning|good evening)\b/.test(lower)) {
        reply("Hii! 🫧 So happy you're here. Ask me for React jobs, remote opportunities, or jobs for freshers!");
        return;
      }

      if (/help|what can you|how does/.test(lower)) {
        reply("I'm Muse, your tiny job-hunting buddy! 💙 Search by skill, location, work mode, or experience. Try “React jobs in Pune” or “remote jobs for freshers”.");
        return;
      }

      const params = getFilters(text);
      if (!params.size) {
        reply("Let's find your next opportunity! 🌷 Include a skill, city, or preference, like “React jobs in Pune” or “remote internships”.");
        return;
      }

      params.set("limit", "5");
      const response = await fetch(`/api/jobs?${params.toString()}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) throw new Error("Request failed");

      const result = await response.json();
      if (!result.success) throw new Error("Invalid response");

      const jobs: Job[] = result.data ?? [];
      const total = result.pagination?.total ?? jobs.length;

      reply(
        jobs.length
          ? `Yay! ✨ I found ${total} matching published ${total === 1 ? "job" : "jobs"}. Here are ${jobs.length} to explore!`
          : "Aww, no published jobs matched those filters. Try another skill or remove a filter. 💙",
        jobs
      );
    } catch {
      reply("Oops! 💫 I couldn't load the job listings. Please try again in a moment.");
    } finally {
      busy.current = false;
      setTyping(false);
    }
  }

  return (
    <div className="fixed z-50 bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open && (
          <motion.section
            key="chat"
            initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            aria-label="Muse AI career assistant"
            className="fixed inset-x-2 bottom-4 flex h-[80dvh] flex-col overflow-hidden rounded-2xl border border-transparent bg-[linear-gradient(#fffdfa,#fffdfa)_padding-box,linear-gradient(135deg,#e5e7eb,#f5d0a9,#e9d5ff)_border-box] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.22),0_8px_24px_-12px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:inset-x-auto sm:right-4 sm:w-[360px] p-0.5">
            {/* <header className="flex shrink-0 items-center gap-3 border-b border-orange-100 bg-white px-4 py-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-violet-100"><Muse small /></div>
              <div className="min-w-0 flex-1">
                <h2 className="flex items-center gap-1 text-sm text-violet-500 font-bold">JoblyAI <Sparkles size={13} className="text-red-400" /></h2>
                <p className="mt-1 text-[11px] text-stone-500">Your little career companion</p>
                <p className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Ready to help</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close chat" className="grid h-9 w-9 place-items-center rounded-xl bg-stone-50 text-stone-500 hover:bg-violet-50"><X size={18} /></button>
            </header> */}
            <div className="pointer-events-none absolute -inset-1 -z-10 rounded-3xl bg-gradient-to-r from-violet-400/20 via-pink-300/20 to-orange-300/20 blur-2xl" />

            <div className="relative flex shrink-0 items-center overflow-hidden bg-gradient-to-br from-[#fff0dc] via-[#f5eaff] to-[#e3f7ff] p-4">
              <div className="relative z-10">
                <h3 className="text-lg font-bold leading-tight text-[#57453a]">Your next chapter<br />starts with <span className="textbg"> JoblyAI.</span></h3>
                <p className="mt-2 text-xs font-medium tracking-wide bg-gradient-to-r from-stone-500 via-amber-700 to-stone-500 bg-clip-text text-transparent">
                  Big dreams. Little steps. ✨
                </p>              
              </div>
              <div className="absolute right-1"><Muse className="h-[80px] w-[90px]" /></div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#fffaf5] px-3 py-3 rounded">
              {messages.map((message) => (
                <motion.div key={message.id} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex items-end gap-2 ${message.role === "user" ? "justify-end" : ""}`}>
                  {message.role === "bot" && <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-violet-100"><Muse small /></div>}
                  <div className="min-w-0 max-w-[86%]">
                    <div className={`whitespace-pre-wrap break-words rounded-2xl px-2 py-1 text-xs leading-6 ${message.role === "user" ? "rounded-br-sm bg-gradient-to-br from-violet-500 to-indigo-500 text-white" : "rounded-bl-sm border border-orange-100 bg-white text-stone-600 shadow-sm"}`}>{message.text}</div>
                    {message.jobs?.map((job) => <JobCard key={job.id} job={job} />)}
                  </div>
                </motion.div>
              ))}

              {typing && (
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-violet-50"><Muse small /></div>
                  <div className="flex items-center gap-1 rounded-xl border border-orange-100 bg-white px-4 py-3">
                    {[0, 1, 2].map((i) => <motion.span key={i} animate={reduceMotion ? undefined : { y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.12 }} className="h-1.5 w-1.5 rounded-full bg-violet-400" />)}
                    <span className="ml-1 text-[10px] text-stone-400">Muse is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 border-t border-orange-100 bg-[#fffaf5] px-3 py-2">
              <p className="mb-2 flex items-center gap-1 text-[9px] font-bold tracking-wide text-stone-400"><Sparkles size={11} /> TRY ASKING</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((prompt, i) => (
                  <button key={prompt} disabled={typing} onClick={() => void sendMessage(prompt)} className="rounded-xl border border-orange-100 bg-white px-2 py-0.5 text-xs! text-stone-600 transition hover:border-violet-200 hover:bg-violet-50 disabled:opacity-50">
                    {["☁️", "🌱"][i]} {prompt}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={(e) => void sendMessage(input, e)} className="mx-3 focushide h-10 mb-2 flex items-center gap-2 rounded-full border border-stone-200 bg-white p-1 pl-4 shadow-sm transition focus-within:border-violet-400 focus-within:ring-4 focus-within:ring-violet-500/10 dark:border-white/10 dark:bg-[#1c1c1e]">
              <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={300} aria-label="Message JoblyAI" placeholder="Tell JoblyAI your dream job..." className="min-w-0 focushide flex-1 bg-transparent py-2 text-sm! outline-none placeholder:text-stone-400 dark:text-white" />
              <button type="submit" disabled={!input.trim() || typing} aria-label="Send message" className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-b from-violet-500 to-indigo-600 text-white transition active:scale-90 disabled:bg-none disabled:bg-stone-100 disabled:text-stone-400 dark:disabled:bg-white/10">
                <Send size={14} />
              </button>
            </form>
            <p className="shrink-0 bg-white py-2 px-0.5 text-center text-[9px] text-stone-400">Verify job details ·<span className="textbg"> JoblyAI</span></p>
          </motion.section>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label={open ? "Close Muse" : "Chat with Muse"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        whileHover={{ scale: 1.04, y: -3 }}
        whileTap={{ scale: 0.94 }}
        animate={open || reduceMotion ? undefined : { y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className={`relative ml-auto grid place-items-center border border-white bg-gradient-to-br from-[#fff0dc] via-[#f2eaff] to-[#def6ff] shadow-[0_10px_30px_#795d4c30] ${open ? "h-6 w-6 rounded-2xl" : "h-16 w-16 rounded-2xl"}`}
      >
        {open ? <X size={20} className="text-violet-600" /> : (
          <>
            <Muse className="h-[60px] w-[56px]" />
            <span className="absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-xl border border-orange-100 bg-[#fffdfa] px-3 py-2 text-[10px] font-bold text-stone-600 shadow-sm">Ask Muse ♡</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
