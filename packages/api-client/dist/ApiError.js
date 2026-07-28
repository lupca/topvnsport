export class ApiError extends Error {
    constructor(message, status, info) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.info = info;
    }
}
