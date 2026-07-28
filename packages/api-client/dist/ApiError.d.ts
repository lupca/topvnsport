export declare class ApiError extends Error {
    status: number;
    info?: any;
    constructor(message: string, status: number, info?: any);
}
