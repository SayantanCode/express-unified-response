import { describe, it, expect } from "vitest";
import { createAppError, AppError } from "../src/core/errors";

describe("Error Adapter Safety", () => {
  it("should continue to the next adapter if one adapter crashes", () => {
    // 1. An adapter that crashes (throws an error)
    const crashingAdapter = () => {
      throw new Error("I am a buggy adapter");
    };

    // 2. A functional adapter that comes after the crashing one
    const workingAdapter = (err: any) => {
      if (err.isTarget) {
        return new AppError("Handled by working adapter", 400, "CUSTOM_HANDLED");
      }
      return null;
    };

    const mockError = { isTarget: true };
    
    // We pass the crashing one first in the array
    const result = createAppError(mockError, [crashingAdapter, workingAdapter]);

    // The result should be the one from the working adapter, not a crash
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe("CUSTOM_HANDLED");
    expect(result.message).toBe("Handled by working adapter");
  });

  it("should fallback to default error if all adapters crash", () => {
    const crashingAdapter = () => {
      throw new Error("Boom");
    };

    const result = createAppError(new Error("Original Error"), [crashingAdapter]);

    // Should return a standard 500 AppError instead of crashing the process
    expect(result).toBeInstanceOf(AppError);
    expect(result.statusCode).toBe(500);
    expect(result.code).toBe("INTERNAL_ERROR");
  });

  it("should ignore adapters that return non-AppError values", () => {
    // Adapter returns a string instead of an AppError instance (invalid)
    const invalidAdapter = () => "not an app error" as any;
    
    const result = createAppError(new Error("Test"), [invalidAdapter]);

    // Should ignore the string and use the internal logic to wrap the Error
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toBe("Test");
  });
});