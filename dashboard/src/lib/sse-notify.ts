type SSENotifyFn = (projectId: string, event: { type: string; data: unknown }) => void;

let _notify: SSENotifyFn | null = null;

export function setSSENotify(fn: SSENotifyFn) {
  _notify = fn;
}

export function notifyProject(projectId: string, event: { type: string; data: unknown }) {
  if (_notify) {
    try {
      _notify(projectId, event);
    } catch (err) {
      console.error("[sse] notify error:", err instanceof Error ? err.message : err);
    }
  }
}
