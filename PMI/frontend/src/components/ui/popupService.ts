export type PopupKind = "alert" | "confirm" | "prompt";

export interface PopupRequest {
  id: number;
  kind: PopupKind;
  message: string;
  defaultValue?: string;
}

type PopupResult = void | boolean | string | null;

type QueueItem = PopupRequest & {
  resolve: (value: PopupResult) => void;
};

class PopupService {
  private queue: QueueItem[] = [];
  private listeners = new Set<(request: PopupRequest | null) => void>();
  private nextId = 1;

  subscribe(listener: (request: PopupRequest | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentRequest());

    return () => {
      this.listeners.delete(listener);
    };
  }

  alert(message: string): Promise<void> {
    return this.enqueue("alert", message).then(() => undefined);
  }

  confirm(message: string): Promise<boolean> {
    return this.enqueue("confirm", message).then((result) => Boolean(result));
  }

  prompt(message: string, defaultValue = ""): Promise<string | null> {
    return this.enqueue("prompt", message, defaultValue).then((result) =>
      typeof result === "string" ? result : null
    );
  }

  resolveCurrent(value: PopupResult): void {
    const current = this.queue.shift();
    if (!current) {
      return;
    }

    current.resolve(value);
    this.emit();
  }

  private enqueue(kind: PopupKind, message: string, defaultValue?: string): Promise<PopupResult> {
    return new Promise((resolve) => {
      this.queue.push({
        id: this.nextId++,
        kind,
        message,
        defaultValue,
        resolve,
      });
      this.emit();
    });
  }

  private currentRequest(): PopupRequest | null {
    const current = this.queue[0];
    if (!current) {
      return null;
    }

    return {
      id: current.id,
      kind: current.kind,
      message: current.message,
      defaultValue: current.defaultValue,
    };
  }

  private emit(): void {
    const current = this.currentRequest();
    this.listeners.forEach((listener) => listener(current));
  }
}

export const popupService = new PopupService();

export const showConfirm = (message: string) => popupService.confirm(message);
