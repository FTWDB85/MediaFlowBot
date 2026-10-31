import http from "node:http";
import { spawn } from "node:child_process";

const PORT = Number(process.env.PORT) || 3000;
const API_TOKEN = process.env.ENGINE_API_TOKEN;

const ALLOWED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
  "pornhub.com",
  "xvideos.com",
];

function validateUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.port && url.port !== "443") return false;

    const hostname = url.hostname.toLowerCase();

    return ALLOWED_DOMAINS.some(
      (domain) =>
        hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

function sendJson(res, status, data) {
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

function getMediaInfo(url) {
  return new Promise((resolve, reject) => {
    const process = spawn("yt-dlp", [
      "--dump-single-json",
      "--skip-download",
      "--no-warnings",
      "--no-playlist",
      "--no-call-home",
      url,
    ]);

    let output = "";
    let errorOutput = "";

    const timeout = setTimeout(() => {
      process.kill("SIGKILL");
      reject(new Error("Processing timeout"));
    }, 45000);

    process.stdout.on("data", (chunk) => {
      output += chunk.toString();

      if (output.length > 10 * 1024 * 1024) {
        process.kill("SIGKILL");
        reject(new Error("Response too large"));
      }
    });

    process.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });

    process.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    process.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error("Media extraction failed"));
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error("Invalid extractor response"));
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, {
      status: "ok",
      service: "MediaFlow Engine",
    });
  }

  if (req.method !== "POST" || req.url !== "/info") {
    return sendJson(res, 404, {
      error: "Not Found",
    });
  }

  if (!API_TOKEN || req.headers.authorization !== `Bearer ${API_TOKEN}`) {
    return sendJson(res, 401, {
      error: "Unauthorized",
    });
  }

  try {
    let body = "";

    for await (const chunk of req) {
      body += chunk;

      if (body.length > 8192) {
        return sendJson(res, 413, {
          error: "Request too large",
        });
      }
    }

    const data = JSON.parse(body);

    if (typeof data.url !== "string" || !validateUrl(data.url)) {
      return sendJson(res, 400, {
        error: "Invalid or unsupported URL",
      });
    }

    const info = await getMediaInfo(data.url);

    const formats = (info.formats || [])
      .filter((format) => format.url && format.format_id)
      .map((format) => ({
        format_id: format.format_id,
        extension: format.ext,
        resolution: format.resolution || null,
        filesize: format.filesize || format.filesize_approx || null,
        has_video: Boolean(format.vcodec && format.vcodec !== "none"),
        has_audio: Boolean(format.acodec && format.acodec !== "none"),
      }));

    return sendJson(res, 200, {
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader,
      platform: info.extractor_key,
      formats,
    });
  } catch (error) {
    console.error("Media info error:", error.message);

    return sendJson(res, 500, {
      error: "Could not extract media information",
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`MediaFlow Engine listening on port ${PORT}`);
});