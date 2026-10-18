import { useState, useEffect, useRef } from "react";
import type { ExecutionLog } from "../types";
import { fetchRecentLogs, getSSEUrl, clearAllLogs } from "../lib/api";

export function useSSE(token: string | null) {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial load of history
  useEffect(() => {
    if (!token) return;
    fetchRecentLogs(60)
      .then((history) => {
        setLogs(history);
      })
      .catch((err) => {
        console.error("Failed to load log history:", err);
      });
  }, [token]);

  // Connect to SSE stream
  useEffect(() => {
    if (!token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    const sseUrl = getSSEUrl(token);
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const newLog: ExecutionLog = JSON.parse(event.data);
        setLogs((prev) => [newLog, ...prev.slice(0, 99)]); // Keep latest 100 entries
      } catch (err) {
        console.warn("Could not parse SSE message:", event.data);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
    };
  }, [token]);

  const clearLogs = async () => {
    try {
      await clearAllLogs();
    } catch (err) {
      console.error("Failed to clear logs on server:", err);
    } finally {
      setLogs([]);
    }
  };

  return {
    logs,
    isConnected,
    clearLogs,
  };
}
