import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type Profile = {
  name: string;
  email: string;
  phone: string;
  location: string;
  skills: string[];
  experience: string;
  education: string;
  roles: string[];
  salary: string;
  industries: string[];
  companies: string[];
  workMode: string;
  resumeText: string;
  resumeName: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  source: string;
  postedAt: string;
  url: string;
  description: string;
  remote: boolean;
  match: number;
  ats: number;
  suspicious: boolean;
};

export type Application = {
  id: string;
  job: Job;
  status: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
  history: { status: string; at: string }[];
  resumeText: string;
  followUpAt: string;
};

export type Store = {
  profile: Profile | null;
  jobs: Job[];
  applications: Application[];
  lastSearchAt: string | null;
};

const dataDir = path.join(process.cwd(), ".data");
const dataPath = path.join(dataDir, "gsbot.enc");
const keyPath = path.join(dataDir, ".key");
const emptyStore: Store = { profile: null, jobs: [], applications: [], lastSearchAt: null };
let writeQueue = Promise.resolve();

async function getKey() {
  if (process.env.GSBOT_ENCRYPTION_KEY) {
    const key = Buffer.from(process.env.GSBOT_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) throw new Error("GSBOT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
    return key;
  }
  await mkdir(dataDir, { recursive: true });
  try {
    return await readFile(keyPath);
  } catch {
    const key = randomBytes(32);
    await writeFile(keyPath, key, { flag: "wx", mode: 0o600 });
    return key;
  }
}

function encrypt(value: Store, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

function decrypt(value: Buffer, key: Buffer): Store {
  const decipher = createDecipheriv("aes-256-gcm", key, value.subarray(0, 12));
  decipher.setAuthTag(value.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString("utf8")) as Store;
}

async function readStoreFile(): Promise<Store> {
  try {
    return decrypt(await readFile(dataPath), await getKey());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(emptyStore);
    throw error;
  }
}

export async function readStore(): Promise<Store> {
  await writeQueue;
  return readStoreFile();
}

export function updateStore<T>(update: (store: Store) => T | Promise<T>): Promise<T> {
  const task = writeQueue.then(async () => {
    const store = await readStoreFile();
    const result = await update(store);
    await mkdir(dataDir, { recursive: true });
    const temporaryPath = `${dataPath}.${randomBytes(5).toString("hex")}.tmp`;
    await writeFile(temporaryPath, encrypt(store, await getKey()), { mode: 0o600 });
    await rename(temporaryPath, dataPath);
    return result;
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

export function deleteStore() {
  const task = writeQueue.then(async () => {
    await Promise.all([rm(dataPath, { force: true }), rm(keyPath, { force: true })]);
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}