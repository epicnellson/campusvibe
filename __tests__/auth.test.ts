/**
 * Auth flow tests — Firebase Email Link
 */

import { validateEmailDomain, sendMagicLink, completeEmailLinkSignIn } from "@/services/auth";
import { auth } from "@/services/firebase";
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";

jest.mock("firebase/auth");

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
    expect(validateEmailDomain("invalid")).toBe("Invalid email address");
  });

  it("handles empty email", () => {
    expect(validateEmailDomain("")).toBe("Invalid email address");
  });
});

describe("sendMagicLink", () => {
  it("calls Firebase sendSignInLinkToEmail with email and actionCodeSettings", async () => {
    (sendSignInLinkToEmail as jest.Mock).mockResolvedValueOnce(undefined);

    await sendMagicLink("test@university.edu");

    expect(sendSignInLinkToEmail).toHaveBeenCalledWith(auth, "test@university.edu", {
      url: expect.stringContaining("auth/callback"),
      handleCodeInApp: true,
    });
  });

  it("throws if Firebase returns error", async () => {
    (sendSignInLinkToEmail as jest.Mock).mockRejectedValueOnce(
      new Error("Rate limit exceeded")
    );

    await expect(sendMagicLink("test@university.edu")).rejects.toThrow(
      "Rate limit exceeded"
    );
  });
});

describe("completeEmailLinkSignIn", () => {
  it("calls Firebase signInWithEmailLink with email and link", async () => {
    (isSignInWithEmailLink as jest.Mock).mockReturnValueOnce(true);
    (signInWithEmailLink as jest.Mock).mockResolvedValueOnce({
      user: { uid: "user-1", email: "test@university.edu" },
    });

    await completeEmailLinkSignIn("test@university.edu", "https://example.com/...");

    expect(signInWithEmailLink).toHaveBeenCalledWith(auth, "test@university.edu", "https://example.com/...");
  });

  it("throws if link is invalid", async () => {
    (isSignInWithEmailLink as jest.Mock).mockReturnValueOnce(false);

    await expect(
      completeEmailLinkSignIn("test@university.edu", "https://invalid-link.com")
    ).rejects.toThrow("Invalid sign-in link");
  });
});
