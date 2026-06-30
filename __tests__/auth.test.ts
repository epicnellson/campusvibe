/**
 * Auth flow tests
 *
 * Tests:
 * - Email domain validation (university email only)
 * - OTP send + verify
 * - Session persistence check
 */

import { validateEmailDomain, sendOTP, verifyOTP } from "@/services/auth";

// Mock supabase
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();

jest.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateEmailDomain", () => {
  it("returns null for allowed .edu domain", () => {
    expect(validateEmailDomain("test@harvard.edu")).toBeNull();
  });

  it("returns null for configured custom domain", () => {
    expect(validateEmailDomain("test@myuniversity.edu")).toBeNull();
  });

  it("returns error for non-university domain", () => {
    const result = validateEmailDomain("test@gmail.com");
    expect(result).toContain("Only university email addresses are allowed");
  });

  it("returns error for invalid email without domain", () => {
    const result = validateEmailDomain("invalid");
    expect(result).toBe("Invalid email address");
  });

  it("handles empty email", () => {
    const result = validateEmailDomain("");
    expect(result).toBe("Invalid email address");
  });
});

describe("sendOTP", () => {
  it("calls supabase auth signInWithOtp with email", async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });

    await sendOTP("test@university.edu");

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: "test@university.edu",
    });
  });

  it("throws if supabase returns error", async () => {
    mockSignInWithOtp.mockResolvedValueOnce({
      error: new Error("Rate limit exceeded"),
    });

    await expect(sendOTP("test@university.edu")).rejects.toThrow(
      "Rate limit exceeded"
    );
  });
});

describe("verifyOTP", () => {
  it("calls supabase auth verifyOtp with email and token", async () => {
    mockVerifyOtp.mockResolvedValueOnce({ error: null });

    await verifyOTP("test@university.edu", "123456");

    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: "test@university.edu",
      token: "123456",
      type: "email",
    });
  });

  it("throws if verification fails", async () => {
    mockVerifyOtp.mockResolvedValueOnce({
      error: new Error("Invalid or expired token"),
    });

    await expect(
      verifyOTP("test@university.edu", "000000")
    ).rejects.toThrow("Invalid or expired token");
  });
});
