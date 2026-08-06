import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function getHandler(mod) {
  if (typeof mod === "function") return mod;
  if (mod && typeof mod.default === "function") return mod.default;
  if (mod && typeof mod.fetch === "function") return mod.fetch.bind(mod);
  if (mod && mod.default && typeof mod.default.fetch === "function") return mod.default.fetch.bind(mod.default);
  return null;
}

let cachedRscHandler = null;

async function getRscHandler() {
  if (cachedRscHandler) return cachedRscHandler;

  const candidatePaths = [
    path.resolve(process.cwd(), "dist/server/index.js"),
    path.resolve(process.cwd(), "../dist/server/index.js"),
    path.resolve(process.cwd(), ".next/server/index.js"),
  ];

  for (const candidatePath of candidatePaths) {
    if (fs.existsSync(candidatePath)) {
      try {
        const mod = await import(pathToFileURL(candidatePath).href);
        const handlerFn = getHandler(mod);
        if (handlerFn) {
          cachedRscHandler = handlerFn;
          return cachedRscHandler;
        }
      } catch (err) {
        console.warn("Failed loading RSC handler from:", candidatePath, err);
      }
    }
  }

  try {
    const mod = await import("../dist/server/index.js");
    cachedRscHandler = getHandler(mod);
    return cachedRscHandler;
  } catch (err) {
    console.error("Static relative import fallback failed:", err);
    return null;
  }
}

export default async function handler(req, res) {
  try {
    const rscHandler = await getRscHandler();
    if (!rscHandler) {
      throw new Error("Failed to resolve RSC handler function from dist/server/index.js");
    }

    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["host"] || "localhost";
    
    // On Vercel rewrites to /api/index, req.url may be "/api/index".
    // Retrieve the original requested path from Vercel headers if present.
    let reqPath = req.url || "/";
    if (reqPath === "/api/index" || reqPath.startsWith("/api/index?") || reqPath.startsWith("/api/index/")) {
      const originalPath =
        req.headers["x-invoke-path"] ||
        req.headers["x-matched-path"] ||
        req.headers["x-original-url"] ||
        req.headers["x-rewrite-url"] ||
        "/";
      reqPath = originalPath;
    }

    const url = new URL(reqPath, `${protocol}://${host}`);

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val !== undefined) {
        if (Array.isArray(val)) {
          for (const v of val) headers.append(key, v);
        } else {
          headers.set(key, String(val));
        }
      }
    }

    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }

    const webRequest = new Request(url.href, {
      method: req.method,
      headers,
      body,
    });

    const response = await rscHandler(webRequest);

    if (!response) {
      res.statusCode = 404;
      res.end("Not Found");
      return;
    }

    res.statusCode = response.status;

    // Handle Set-Cookie headers properly using getSetCookie if available
    const setCookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
    if (setCookies.length > 0) {
      if (typeof res.appendHeader === "function") {
        for (const cookie of setCookies) {
          res.appendHeader("set-cookie", cookie);
        }
      } else {
        res.setHeader("set-cookie", setCookies);
      }
    }

    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "set-cookie") {
        if (setCookies.length === 0) {
          if (typeof res.appendHeader === "function") {
            res.appendHeader(key, value);
          } else {
            res.setHeader(key, value);
          }
        }
      } else {
        res.setHeader(key, value);
      }
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (err) {
    console.error("Vercel handler error:", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
}

