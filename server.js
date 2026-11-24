const http = require("node:http");
const path = require("node:path");
const { readFile } = require("node:fs/promises");

const PORT = Number(process.env.PORT) || 3000;
const RATE_CACHE_TTL = 5 * 60 * 1000;
const rateCache = new Map();
const publicDirectory = path.join(__dirname, "public");
const staticFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" }
};

async function getRates(base) {
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < RATE_CACHE_TTL) {
    return cached.data;
  }

  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!response.ok) {
    throw new Error(`Exchange rate service returned HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.result !== "success" || payload.base_code !== base || !payload.rates) {
    throw new Error("The exchange rate service returned an invalid response.");
  }

  const data = {
    base: payload.base_code,
    rates: payload.rates,
    updatedAt: payload.time_last_update_utc
  };
  rateCache.set(base, { data, fetchedAt: Date.now() });
  return data;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method !== "GET") {
    response.writeHead(405, { Allow: "GET", "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Only GET requests are supported." }));
    return;
  }

  if (requestUrl.pathname === "/api/rates") {
    const base = (requestUrl.searchParams.get("base") || "USD").toUpperCase();
    if (!/^[A-Z]{3}$/.test(base)) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Base currency must be a three-letter currency code." }));
      return;
    }

    try {
      const data = await getRates(base);
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      });
      response.end(JSON.stringify(data));
    } catch (error) {
      console.error("Failed to load exchange rates:", error.message);
      response.writeHead(502, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: "Live exchange rates are currently unavailable." }));
    }
    return;
  }

  const staticFile = staticFiles[requestUrl.pathname];
  if (!staticFile) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  try {
    const content = await readFile(path.join(publicDirectory, staticFile.file));
    response.writeHead(200, { "Content-Type": staticFile.type });
    response.end(content);
  } catch (error) {
    console.error(`Failed to read ${staticFile.file}:`, error.message);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unable to load the application.");
  }
});

server.listen(PORT, () => {
  console.log(`Currency converter running at http://localhost:${PORT}`);
});
