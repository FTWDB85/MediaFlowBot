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

    return Response.json(
      {
        error: "Not Found",
        message: "The requested endpoint does not exist.",
      },
      { status: 404 }
    );
  },
};