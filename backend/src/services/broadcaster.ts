import { ExecutionLog } from "../domain/log";

type Listener = (log: ExecutionLog) => void;

class LogBroadcaster {
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(log: ExecutionLog): void {
    for (const listener of this.listeners) {
      try {
        listener(log);
      } catch (err) {
        console.error("[Broadcaster] Error in subscriber:", err);
      }
    }
  }

  subscriberCount(): number {
    return this.listeners.size;
  }
}

export const logBroadcaster = new LogBroadcaster();
