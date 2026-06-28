export type JournalEntry = {
  id: number;
  userId: string;
  title: string | null;
  body: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  photoUri: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateJournalEntry = {
  title?: string;
  body: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  photoUri?: string;
};

const base = () =>
  (process.env.EXPO_PUBLIC_SAFETY_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

async function authHeaders(getToken: () => Promise<string | null>) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = await getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function listJournalEntries(
  getToken: () => Promise<string | null>,
): Promise<JournalEntry[]> {
  const res = await fetch(`${base()}/api/journal`, { headers: await authHeaders(getToken) });
  if (!res.ok) throw new Error(`Journal list failed (${res.status})`);
  return res.json() as Promise<JournalEntry[]>;
}

export async function createJournalEntry(
  getToken: () => Promise<string | null>,
  body: CreateJournalEntry,
): Promise<JournalEntry> {
  const res = await fetch(`${base()}/api/journal`, {
    method: "POST",
    headers: await authHeaders(getToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Journal create failed (${res.status})`);
  return res.json() as Promise<JournalEntry>;
}

export async function deleteJournalEntry(
  getToken: () => Promise<string | null>,
  id: number,
): Promise<void> {
  const res = await fetch(`${base()}/api/journal/${id}`, {
    method: "DELETE",
    headers: await authHeaders(getToken),
  });
  if (!res.ok) throw new Error(`Journal delete failed (${res.status})`);
}
