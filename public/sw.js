const SHELL_CACHE = "gsbot-shell-v2";
const JOBS_CACHE = "gsbot-public-jobs-v1";
const APP_ROUTES = ["/", "/applications", "/job-search", "/recommended", "/resume-studio", "/interview-coach", "/reminders", "/settings"];

self.addEventListener("install", (event) => {
  const htmlRequests = APP_ROUTES.map((route) => new Request(new URL(route, self.location.origin), { headers: { Accept: "text/html" } }));
  event.waitUntil(Promise.all([
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([...htmlRequests, "/icon.svg", "/manifest.webmanifest"])),
    caches.open(JOBS_CACHE),
  ]));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, JOBS_CACHE].includes(key)).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname === "/api/jobs") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) void caches.open(JOBS_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => (await caches.open(JOBS_CACHE).then((cache) => cache.match(request))) || Response.error()));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) void caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
      return response;
    }).catch(async () => {
      const cache = await caches.open(SHELL_CACHE);
      return (await cache.match(request)) || (await cache.match(new Request(new URL("/", self.location.origin), { headers: { Accept: "text/html" } }))) || Response.error();
    }));
    return;
  }
  if (url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) void cache.put(request, response.clone());
      return response;
    }));
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== "gsbot-job-refresh") return;
  event.waitUntil(fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "search", query: "" }),
  }).then((response) => {
    if (!response.ok) throw new Error("Background job refresh failed.");
    return fetch("/api/jobs");
  }).then(async (response) => {
    if (!response.ok) throw new Error("Could not cache refreshed jobs.");
    const cache = await caches.open(JOBS_CACHE);
    await cache.put(new Request(new URL("/api/jobs", self.location.origin)), response);
  }));
});