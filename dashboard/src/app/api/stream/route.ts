import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory event bus for SSE connections
// Maps project_id -> Set of controller callbacks
const projectListeners = new Map<string, Set<(data: string) => void>>();

function notifyProjectUpdate(projectId: string, event: { type: string; data: unknown }) {
  const listeners = projectListeners.get(projectId);
  if (!listeners) return;
  const msg = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const send of listeners) {
    try { send(msg); } catch { /* listener disconnected */ }
  }
}

// Global reference so other routes can call notifyProjectUpdate
if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, unknown>).__anStreamNotify = notifyProjectUpdate;
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("project");
  if (!projectId) {
    return new Response("Missing project param", { status: 400 });
  }

  // Auth check
  try {
    const { auth } = await import("@/lib/auth");
    const { resolveSession } = await import("@/lib/resolve-session");
    const rawSession = await auth();
    const resolved = await resolveSession(rawSession);
    if (!resolved) {
      return new Response("Unauthorized", { status: 401 });
    }
  } catch {
    return new Response("Auth failed", { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: string) => {
        controller.enqueue(encoder.encode(msg));
      };

      // Register listener
      if (!projectListeners.has(projectId)) {
        projectListeners.set(projectId, new Set());
      }
      projectListeners.get(projectId)!.add(send);

      // Tell browser to reconnect after 3s if disconnected
      send(`retry: 3000\n\n`);

      // Send initial connection event
      send(`event: connected\ndata: ${JSON.stringify({ project: projectId, listeners: (projectListeners.get(projectId)?.size || 1) })}\n\n`);

      // Heartbeat every 15s to keep connection alive (avoids proxy/LB timeouts)
      const heartbeat = setInterval(() => {
        try {
          send(`event: heartbeat\ndata: ${JSON.stringify({ t: Date.now(), listeners: projectListeners.get(projectId)?.size || 0 })}\n\n`);
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on close
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        const listeners = projectListeners.get(projectId);
        if (listeners) {
          listeners.delete(send);
          if (listeners.size === 0) projectListeners.delete(projectId);
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
