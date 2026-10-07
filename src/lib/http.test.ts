import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { version } from "../../package.json";
import { GET } from "../app/api/health/route";
import { ipRateLimit, jsonError, withErrors } from "./http";
import { log } from "./log";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("jsonError", () => {
  it("returns a JSON error with the requested status and no-store", async () => {
    const response = jsonError(400, "INVALID_INPUT", "Invalid input");
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({ error: { code: "INVALID_INPUT", message: "Invalid input" } });
  });

  it("includes details without allowing them to replace the error identity", async () => {
    const response = jsonError(429, "RATE_LIMITED", "Try later", {
      retryAfter: 60, code: "override", message: "override",
    });
    expect(await response.json()).toEqual({
      error: { code: "RATE_LIMITED", message: "Try later", retryAfter: 60 },
    });
  });
});

describe("withErrors", () => {
  it("forwards request and route context and preserves the response", async () => {
    const request = new Request("https://example.com/api/example");
    const context = { params: Promise.resolve({ id: "example" }) };
    const response = new Response("created", { status: 201, headers: { "X-Example": "yes" } });
    const handler = vi.fn(async (req: Request, ctx: typeof context) => {
      expect(req).toBe(request);
      expect(ctx).toBe(context);
      return response;
    });
    expect(await withErrors(handler)(request, context)).toBe(response);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("accepts synchronous handlers and preserves intentional errors", async () => {
    const response = jsonError(404, "NOT_FOUND", "Not found");
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await withErrors(() => response)()).toBe(response);
    expect(output).not.toHaveBeenCalled();
  });

  it.each(["sync", "async"])("handles %s failures without leaking private values", async (mode) => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    const privateMessage = "private@example.com bearer secret-value";
    const handler = mode === "sync"
      ? () => { throw new Error(privateMessage); }
      : async () => { throw privateMessage; };
    const response = await withErrors(handler)();
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
    expect(output).toHaveBeenCalledOnce();
    const serialized = output.mock.calls[0][0] as string;
    expect(serialized).not.toContain(privateMessage);
    expect(JSON.parse(serialized)).toMatchObject({
      level: "error", msg: "Unexpected request error", fields: { status: 500 },
    });
  });
});

describe("structured logging", () => {
  it.each(["info", "warn", "error"] as const)("writes %s as one structured JSON record", (level) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    const output = vi.spyOn(console, level).mockImplementation(() => {});
    log(level, "Request completed", { status: 200, durationMs: 12, cached: true });
    expect(output).toHaveBeenCalledExactlyOnceWith(JSON.stringify({
      level, msg: "Request completed", fields: { status: 200, durationMs: 12, cached: true },
      ts: "2026-10-07T12:00:00.000Z",
    }));
  });
});

describe("ipRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
  });

  it("allows exactly the limit and keeps keys independent", () => {
    expect(ipRateLimit("quota:a", 2, 1_000)).toBe(true);
    expect(ipRateLimit("quota:a", 2, 1_000)).toBe(true);
    expect(ipRateLimit("quota:a", 2, 1_000)).toBe(false);
    expect(ipRateLimit("quota:b", 2, 1_000)).toBe(true);
  });

  it("resets at the exact window boundary without extending it on rejection", () => {
    expect(ipRateLimit("boundary", 1, 1_000)).toBe(true);
    vi.advanceTimersByTime(999);
    expect(ipRateLimit("boundary", 1, 1_000)).toBe(false);
    vi.advanceTimersByTime(1);
    expect(ipRateLimit("boundary", 1, 1_000)).toBe(true);
    expect(ipRateLimit("boundary", 1, 1_000)).toBe(false);
  });

  it("rejects all requests for a zero quota", () => {
    expect(ipRateLimit("zero", 0, 1_000)).toBe(false);
  });

  it.each([
    [-1, 1_000], [1.5, 1_000], [NaN, 1_000], [Infinity, 1_000],
    [1, 0], [1, -1], [1, 0.5], [1, NaN], [1, Infinity],
  ])("rejects invalid configuration (%s, %s)", (limit, windowMs) => {
    expect(() => ipRateLimit("invalid", limit, windowMs)).toThrow(RangeError);
  });

  it("bounds stored keys and recovers capacity after expiry", async () => {
    vi.resetModules();
    const { ipRateLimit: isolatedLimit } = await import("./http");
    for (let i = 0; i < 10_000; i++) {
      expect(isolatedLimit(`capacity:${i}`, 2, 1_000)).toBe(true);
    }
    expect(isolatedLimit("overflow", 2, 1_000)).toBe(false);
    expect(isolatedLimit("capacity:0", 2, 1_000)).toBe(true);
    expect(isolatedLimit("capacity:0", 2, 1_000)).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(isolatedLimit("overflow", 2, 1_000)).toBe(true);
  });
});

describe("health", () => {
  it.each([
    ["", "", "", "memory", false],
    ["https://redis.example", "", "", "memory", false],
    ["", "fake-token", "", "memory", false],
    ["https://redis.example", "fake-token", "fake-tmdb-key", "redis", true],
  ] as const)("reports configuration without exposing values (%s, %s, %s)", async (url, token, tmdb, store, enabled) => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", url);
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", token);
    vi.stubEnv("TMDB_API_KEY", tmdb);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: true, version, time: "2026-10-07T12:00:00.000Z", store, tmdb: enabled,
    });
  });

  it("generates a fresh time on each request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    const first = await GET().json();
    vi.advanceTimersByTime(1_000);
    const second = await GET().json();
    expect(Date.parse(second.time) - Date.parse(first.time)).toBe(1_000);
    const { dynamic } = await import("../app/api/health/route");
    expect(dynamic).toBe("force-dynamic");
  });
});

describe("security configuration", () => {
  it.each(["production", "development", "test"])("sets security headers in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    vi.resetModules();
    const { default: config } = await import("../../next.config");
    expect(config.poweredByHeader).toBe(false);
    expect(config.images?.remotePatterns).toEqual([
      { protocol: "https", hostname: "static.tvmaze.com" },
      { protocol: "https", hostname: "image.tmdb.org" },
    ]);
    const rules = await config.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    const headers = Object.fromEntries(rules[0].headers.map(({ key, value }) => [key, value]));
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    const directives = headers["Content-Security-Policy"].split("; ");
    expect(directives).toEqual(expect.arrayContaining([
      "default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'",
      "form-action 'self'", "style-src 'self' 'unsafe-inline'",
      `script-src 'self' 'unsafe-inline'${environment === "development" ? " 'unsafe-eval'" : ""}`,
    ]));
    const images = directives.find((value) => value.startsWith("img-src "))!;
    for (const host of ["https://static.tvmaze.com", "https://image.tmdb.org", "https://media.giphy.com"]) {
      expect(images.split(" ")).toContain(host);
    }
    if (environment !== "development") {
      expect(headers["Content-Security-Policy"]).not.toContain("'unsafe-eval'");
    }
  });
});
