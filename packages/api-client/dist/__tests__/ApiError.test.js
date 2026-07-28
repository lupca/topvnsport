"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const ApiError_1 = require("../ApiError");
(0, vitest_1.describe)("ApiError", () => {
    (0, vitest_1.test)("creates an instance of ApiError with message, status, and info", () => {
        const error = new ApiError_1.ApiError("Failed request", 400, { detail: "Invalid input" });
        (0, vitest_1.expect)(error).toBeInstanceOf(Error);
        (0, vitest_1.expect)(error.name).toBe("ApiError");
        (0, vitest_1.expect)(error.message).toBe("Failed request");
        (0, vitest_1.expect)(error.status).toBe(400);
        (0, vitest_1.expect)(error.info).toEqual({ detail: "Invalid input" });
    });
});
