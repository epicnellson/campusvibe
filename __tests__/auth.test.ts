/**
 * Auth flow tests — Firebase Email/Password + Google
 */

import { signUp, signIn, resendVerification, signOut } from "@/services/auth";
import { auth } from "@/services/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut as fbSignOut,
} from "firebase/auth";

const mockFirebaseUser = { uid: "user-1", email: "test@university.edu" };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("signUp", () => {
  it("creates the user and sends an email verification", async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: mockFirebaseUser,
    });

    const user = await signUp("test@university.edu", "secret123");

    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "test@university.edu",
      "secret123"
    );
    expect(sendEmailVerification).toHaveBeenCalledWith(mockFirebaseUser);
    expect(user).toBe(mockFirebaseUser);
  });

  it("throws when Firebase rejects", async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValueOnce(
      new Error("email-already-in-use")
    );

    await expect(signUp("test@university.edu", "secret123")).rejects.toThrow(
      "email-already-in-use"
    );
  });
});

describe("signIn", () => {
  it("signs in via Firebase email + password", async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValueOnce({
      user: mockFirebaseUser,
    });

    const user = await signIn("test@university.edu", "secret123");

    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      auth,
      "test@university.edu",
      "secret123"
    );
    expect(user).toBe(mockFirebaseUser);
  });
});

describe("resendVerification", () => {
  it("sends a verification email to the current user", async () => {
    await resendVerification();

    expect(sendEmailVerification).toHaveBeenCalledWith(
      expect.objectContaining({ uid: "user-1" })
    );
  });

  it("throws when there is no signed-in user", async () => {
    const original = auth.currentUser;
    (auth as any).currentUser = null;

    await expect(resendVerification()).rejects.toThrow("No authenticated user");

    (auth as any).currentUser = original;
  });
});

describe("signOut", () => {
  it("calls Firebase signOut", async () => {
    (fbSignOut as jest.Mock).mockResolvedValueOnce(undefined);

    await signOut();

    expect(fbSignOut).toHaveBeenCalledWith(auth);
  });
});
