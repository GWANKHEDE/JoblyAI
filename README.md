# JoblyAI

JoblyAI is a local-first job search and career workspace. It discovers listings from public job-board APIs, ranks them against a user profile, extracts text from PDF/DOCX resumes, creates a role-labeled PDF from supplied resume content, tracks user-confirmed application statuses, and offers STAR interview feedback.

## Run locally

Requirements: Node.js 20.9+ and npm.

```powershell
cd gsbot
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The first profile save starts a search. JoblyAI checks Remotive and Arbeitnow when a search is requested, and refreshes at most every 30 minutes while the app is open and visible. Returning to the app or network triggers a stale check. Some installed browsers may also allow best-effort periodic background sync; browser scheduling is not guaranteed. JoblyAI does not scrape company websites. Feed availability, freshness, and listing accuracy depend on providers, so verify listings on the employer's site.

For a production build, run `npm run build` and then `npm start`.

## Publish online and install

JoblyAI already has a web app manifest and service worker, so it can be installed from an HTTPS deployment. The current server is intentionally bound to `127.0.0.1` and stores one user's encrypted data in `.data/`. Do not expose this build directly to the internet: it has no sign-in, and serverless filesystems are usually temporary.

Before a public or multi-device launch:

1. Add authentication and enforce per-user access on every API route.
2. Move profile, job, and application data from the local file store to a hosted database such as PostgreSQL. Store resume files in private object storage and encrypt them with managed secrets/keys.
3. Configure reliable server-side scheduled job refreshes, permitted source integrations, and per-user notifications. The current 30-minute schedule is client-side while open; background sync is opportunistic, and push notifications are not implemented.
4. Deploy the Next.js app to a host that supports Node.js (for example, Vercel, Railway, or Render), configure the database and AI secrets in that host's secret settings, and attach an HTTPS domain. Vercel is suitable after persistence has moved out of `.data/`; its function filesystem is not a durable database.
5. Test account isolation, document deletion, backups, and recovery before inviting users. Never commit `.env.local`, encryption keys, uploaded resumes, or `.data/`.

For a personal, private pilot, a persistent-volume Node host can keep the current local file store, but use the host's access controls and keep it single-user. It still does not provide account-based sync across devices.

Once the HTTPS site is live, install it from the same URL:

- **Desktop:** open the site in Chrome or Edge, choose the install icon in the address bar or the browser menu's **Install JoblyAI** action.
- **Android:** open the site in Chrome, open the menu, then choose **Install app** or **Add to Home screen**.
- **iPhone/iPad:** open the site in Safari, tap **Share**, then **Add to Home Screen**.

The installed app uses the online server for profile and application data. It keeps a small snapshot of public job listings for offline viewing, but cannot discover new roles without a network connection. Search resumes when you return online. Browser push alerts and offline application workflows are not implemented.

## Optional configuration

- `GSBOT_ENCRYPTION_KEY`: base64-encoded 32-byte AES key for encrypting the local database. If unset, JoblyAI creates a local key file in `.data/`. Back up the key separately from the encrypted database or the data cannot be recovered.
- `OPENAI_API_KEY`: enables optional AI interview coaching. Without it, the app provides local STAR-structure guidance. Do not use an untrusted AI endpoint with personal resume data.
- `OPENAI_MODEL`: optional OpenAI chat-completions model name; defaults to `gpt-4o-mini`.

Generate a key with PowerShell: ` [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) ` and put the result in `.env.local`.

## Data and safety boundaries

- Profile data, extracted resume text, jobs, and application history are stored in an AES-256-GCM encrypted file under `.data/`; the database and key are excluded from Git. Resume uploads are parsed in memory and the original file is not retained.
- Browser storage contains only a limited snapshot of public job cards and a setup marker to enable offline display. Profile details and resume content are not put in browser storage or service-worker caches.
- This development build is single-user and has no authentication, cloud sync, multi-device account system, hosted notifications, or deployment-grade key management. Do not expose it to the public internet or use it as a multi-user service without adding those controls and reviewing applicable privacy requirements.
- Preparing an application only adds a `Pending approval` record. JoblyAI does not fill or submit third-party portal applications. A user must apply on the employer's site and explicitly confirm the status change; the UI warns before recording `Applied`.
- Resume PDF export preserves user-provided resume text and contact details. The current exporter formats that text for a role; it does not invent experience or guarantee ATS compatibility. Scores are heuristic keyword estimates, not actual ATS results.
- The service worker caches the app shell and the public `/api/jobs` response only; it never caches `/api` profile, resume, application, or coaching responses.
- Use Settings to remove the profile, resume text, saved jobs, and application history from this local database.

## Included workflows

- Profile onboarding with roles, location, skills, preferences, interests, salary, education, experience, and PDF/DOCX intake.
- On-demand and 30-minute-while-open searches against Remotive and Arbeitnow, duplicate collapse, source links, posting date, heuristic match estimates, and a public offline job snapshot.
- Application queue with status history, direct listing links, status filters, saved resume text, and PDF export.
- Interview prompt practice with a local STAR rubric or optional AI coaching.
- Responsive installable PWA shell for supported browsers.
