// Thin fetch wrapper. All calls go to /api, which Vite proxies in dev and
// FastAPI serves directly in the built app.
import type { Application, ApplicationInput, Contact, ContactInput } from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, message);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, json("POST", body)),
  patch: <T>(path: string, body: unknown) => request<T>(path, json("PATCH", body)),
  put: <T>(path: string, body: unknown) => request<T>(path, json("PUT", body)),
  del: (path: string) => request<void>(path, { method: "DELETE" }),

  listApplications: (includeArchived = false) =>
    request<Application[]>(`/applications${includeArchived ? "?include_archived=true" : ""}`),
  createApplication: (body: ApplicationInput) => request<Application>("/applications", json("POST", body)),
  updateApplication: (id: number, body: ApplicationInput) =>
    request<Application>(`/applications/${id}`, json("PATCH", body)),
  deleteApplication: (id: number) => request<void>(`/applications/${id}`, { method: "DELETE" }),
  staleApplications: () => request<Application[]>("/applications/stale"),

  listContacts: () => request<Contact[]>("/contacts"),
  createContact: (body: ContactInput) => request<Contact>("/contacts", json("POST", body)),
  updateContact: (id: number, body: ContactInput) => request<Contact>(`/contacts/${id}`, json("PATCH", body)),
  deleteContact: (id: number) => request<void>(`/contacts/${id}`, { method: "DELETE" }),
};
