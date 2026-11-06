import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./supabase", () => ({
  supabase: { auth: { getSession } },
}));

import { api } from "./api";

function response(
  body: unknown,
  options: { status?: number; contentType?: string } = {},
): Response {
  const { status = 200, contentType = "application/json" } = options;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": contentType }),
    json: async () => body,
    text: async () => String(body),
  } as Response;
}

describe("api", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", " https://api.example.test/// ");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    getSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("calls the configured API and parses the JSON response", async () => {
    fetchMock.mockResolvedValue(response({ ok: true }));

    await expect(api<{ ok: boolean }>("/health")).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/health",
      expect.objectContaining({
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("merges custom request headers", async () => {
    fetchMock.mockResolvedValue(response({}));

    await api("/items", { headers: { "X-Request-ID": "req-1" } });

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "Content-Type": "application/json",
      "X-Request-ID": "req-1",
    });
  });

  it("rejects when the API URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");

    await expect(api("/health")).rejects.toThrow("The backend URL is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed API URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "not a URL");

    await expect(api("/health")).rejects.toThrow("must be an absolute backend URL");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects non-HTTP API URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "ftp://api.example.test");

    await expect(api("/health")).rejects.toThrow("must use HTTP or HTTPS");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects HTML responses from a misconfigured API URL", async () => {
    fetchMock.mockResolvedValue(response("<html />", { contentType: "text/html" }));

    await expect(api("/health")).rejects.toThrow(
      "The request reached a web page instead of the API",
    );
  });

  it("includes the HTTP error status and body", async () => {
    fetchMock.mockResolvedValue(response("Not found", { status: 404, contentType: "text/plain" }));

    await expect(api("/missing")).rejects.toThrow("404 Not found");
  });

  it("requires a session when authentication is requested", async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await expect(api("/account/me", {}, true)).rejects.toThrow("Not signed in");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the session access token for authenticated requests", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "test-access-token" } },
    });
    fetchMock.mockResolvedValue(response({ role: "admin" }));

    await api("/account/me", {}, true);

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer test-access-token",
    });
  });
});
