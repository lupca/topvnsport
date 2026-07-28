class PopupService {
    constructor() {
        Object.defineProperty(this, "queue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "nextId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1
        });
    }
    subscribe(listener) {
        this.listeners.add(listener);
        listener(this.currentRequest());
        return () => {
            this.listeners.delete(listener);
        };
    }
    alert(message) {
        return this.enqueue("alert", message).then(() => undefined);
    }
    confirm(message) {
        return this.enqueue("confirm", message).then((result) => Boolean(result));
    }
    prompt(message, defaultValue = "") {
        return this.enqueue("prompt", message, defaultValue).then((result) => typeof result === "string" ? result : null);
    }
    resolveCurrent(value) {
        const current = this.queue.shift();
        if (!current) {
            return;
        }
        current.resolve(value);
        this.emit();
    }
    enqueue(kind, message, defaultValue) {
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
    currentRequest() {
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
    emit() {
        const current = this.currentRequest();
        this.listeners.forEach((listener) => listener(current));
    }
}
export const popupService = new PopupService();
export const showConfirm = (message) => popupService.confirm(message);
