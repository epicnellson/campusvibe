/**
 * Confession creation + moderation + like tests
 */

import { createConfession, fetchConfessions, likeConfession, unlikeConfession } from "@/services/confessions";
import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { checkModeration } from "@/services/moderation";

jest.mock("@/services/moderation", () => ({
  checkModeration: jest.fn(),
}));
jest.mock("@/services/notifications", () => ({
  notifyPopularConfession: jest.fn(),
}));
jest.mock("@/services/in-app-notifications", () => ({
  createNotification: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createConfession", () => {
  it("passes moderation and saves confession", async () => {
    (getCurrentUser as jest.Mock).mockReturnValue({ uid: "user-1" });
    (checkModeration as jest.Mock).mockResolvedValueOnce({ flagged: false, categories: [] });
    (db_ops.add as jest.Mock).mockResolvedValueOnce("conf-1");

    await createConfession("This is a test confession");

    expect(db_ops.add).toHaveBeenCalledWith("confessions", expect.objectContaining({
      content: "This is a test confession",
      likes: [],
    }));
  });

  it("throws when moderation flags content", async () => {
    (getCurrentUser as jest.Mock).mockReturnValue({ uid: "user-1" });
    (checkModeration as jest.Mock).mockResolvedValueOnce({
      flagged: true,
      categories: ["harassment"],
    });

    await expect(createConfession("Bad content")).rejects.toThrow("flagged for");
  });

  it("throws on empty content", async () => {
    await expect(createConfession("")).rejects.toThrow("Please write something");
  });
});

describe("fetchConfessions", () => {
  it("returns confessions ordered by newest", async () => {
    (db_ops.query as jest.Mock).mockResolvedValueOnce([
      { id: "conf-1", user_id: "user-2", content: "Anonymous post", likes: ["user-3"] },
    ]);

    const result = await fetchConfessions();
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("Anonymous post");
  });
});

describe("likeConfession", () => {
  it("adds user_id to likes array", async () => {
    (getCurrentUser as jest.Mock).mockReturnValue({ uid: "user-1" });
    (db_ops.get as jest.Mock).mockResolvedValueOnce({
      id: "conf-1", user_id: "user-2", likes: [],
    });

    await likeConfession("conf-1");

    expect(db_ops.addToArray).toHaveBeenCalledWith("confessions", "conf-1", "likes", "user-1");
  });
});

describe("unlikeConfession", () => {
  it("removes user_id from likes array", async () => {
    (getCurrentUser as jest.Mock).mockReturnValue({ uid: "user-1" });

    await unlikeConfession("conf-1");

    expect(db_ops.removeFromArray).toHaveBeenCalledWith("confessions", "conf-1", "likes", "user-1");
  });
});
