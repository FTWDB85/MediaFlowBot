
const ALLOWED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "tiktok.com",
];

function getPlatform(hostname) {
  return ALLOWED_DOMAINS.find(
    (domain) =>
      hostname === domain || hostname.endsWith(`.${domain}`)
  );
}

function validateUrl(value) {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== "443") return null;

    const platform = getPlatform(url.hostname);

    if (!platform) return null;

    return {
      url: url.toString(),
      platform,
    };
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        status: "ok",
        service: "MediaFlowBot API",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === "/api/jobs" && request.method === "POST") {
      let body;

      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON body" },
          { status: 400 }
        );
      }

      if (typeof body.url !== "string" || !body.url.trim()) {
        return Response.json(
          { error: "A valid URL is required" },
          { status: 400 }
        );
      }

      const media = validateUrl(body.url.trim());

      if (!media) {
        return Response.json(
          { error: "Unsupported or invalid URL" },
          { status: 400 }
        );
      }

      const jobId = crypto.randomUUID();

      try {
        const expiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString();

        await env.mediaflow_db
          .prepare(
            `INSERT INTO jobs (id, source_url, platform, status, expires_at)
             VALUES (?, ?, ?, ?, ?)`
          )
          .bind(jobId, media.url, media.platform, "pending", expiresAt)
          .run();
      } catch (error) {
        console.error("Failed to save job:", error);

        return Response.json(
          { error: "Failed to save job" },
          { status: 500 }
        );
      }

      try {
        await env.mediaflow_jobs.send({
          job_id: jobId,
        });
      } catch (error) {
        console.error("Failed to enqueue job:", error);

        try {
          await env.mediaflow_db
            .prepare(
              "UPDATE jobs SET status = ? WHERE id = ?"
            )
            .bind("queue_failed", jobId)
            .run();
        } catch (dbError) {
          console.error("Failed to update job status:", dbError);
        }

        return Response.json(
          { error: "Failed to enqueue job" },
          { status: 503 }
        );
      }

      return Response.json(
        {
          job_id: jobId,
          platform: media.platform,
          status: "pending",
          message: "Job successfully queued.",
        },
        { status: 201 }
      );
    }

    return Response.json(
      {
        error: "Not Found",
        message: "The requested endpoint does not exist.",
      },
      { status: 404 }
    );
  },

  async scheduled(controller, env, ctx) {
    const now = new Date(controller.scheduledTime).toISOString();

    const result = await env.mediaflow_db
      .prepare(
        "DELETE FROM jobs WHERE expires_at IS NOT NULL AND expires_at <= ?"
      )
      .bind(now)
      .run();

    console.log("Expired jobs cleanup:", result.meta.changes);
  },
};
