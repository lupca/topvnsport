export type PopupKind = "alert" | "confirm" | "prompt";
export interface PopupRequest {
    id: number;
    kind: PopupKind;
    message: string;
    defaultValue?: string;
}
type PopupResult = void | boolean | string | null;
declare class PopupService {
    private queue;
    private listeners;
    private nextId;
    subscribe(listener: (request: PopupRequest | null) => void): () => void;
    alert(message: string): Promise<void>;
    confirm(message: string): Promise<boolean>;
    prompt(message: string, defaultValue?: string): Promise<string | null>;
    resolveCurrent(value: PopupResult): void;
    private enqueue;
    private currentRequest;
    private emit;
}
export declare const popupService: PopupService;
export declare const showConfirm: (message: string) => Promise<boolean>;
export {};
