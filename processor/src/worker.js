export default {
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      const { job_id } = message.body ?? {};

      if (!job_id) {
        console.error("Invalid queue message");
        message.ack();
        continue;
      }

      try {
        const job = await env.mediaflow_db
          .prepare(
            "SELECT id, status, platform FROM jobs WHERE id = ?"
          )
          .bind(job_id)
          .first();

        if (!job) {
          console.log("Job not found:", job_id);
          message.ack();
          continue;
        }

        if (job.status !== "pending") {
          console.log("Job is not pending:", job_id);
          message.ack();
          continue;
        }

        // Media Engine is not connected yet.
        // Keep the message in the queue until processing is implemented.
        console.log("Waiting for Media Engine:", job_id);
        message.retry({ delaySeconds: 60 });
      } catch (error) {
        console.error("Queue processing error:", error);
        message.retry({ delaySeconds: 60 });
      }
    }
  },
};