import { describe, expect, test } from "vitest";
import { ApiError } from "../ApiError";

describe("ApiError", () => {
  test("creates an instance of ApiError with message, status, and info", () => {
    const error = new ApiError("Failed request", 400, { detail: "Invalid input" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("Failed request");
    expect(error.status).toBe(400);
    expect(error.info).toEqual({ detail: "Invalid input" });
  });
});
