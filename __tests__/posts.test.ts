/**
 * Post creation + like/unlike tests
 */

import { createPost, fetchPosts, likePost, unlikePost } from "@/services/posts";
import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";

jest.mock("@/services/notifications", () => ({
  notifyPostLike: jest.fn(),
}));
jest.mock("@/services/in-app-notifications", () => ({
  createNotification: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createPost", () => {
  it("inserts a new post via db_ops", async () => {
    (db_ops.add as jest.Mock).mockResolvedValueOnce("post-1");

    await createPost("Hello campus!");

    expect(db_ops.add).toHaveBeenCalledWith("posts", expect.objectContaining({
      content: "Hello campus!",
      likes: [],
    }));
  });
});

describe("fetchPosts", () => {
  it("returns posts with profile data", async () => {
    (db_ops.query as jest.Mock).mockResolvedValueOnce([
      { id: "post-1", content: "First!", user_id: "user-1", created_at: "2026-06-02T00:00:00Z" },
    ]);
    (db_ops.get as jest.Mock).mockResolvedValueOnce({ id: "user-1", name: "Alice", department: "CS" });

    const result = await fetchPosts();

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("First!");
    expect(result[0].profiles?.name).toBe("Alice");
  });

  it("returns empty array when no posts", async () => {
    (db_ops.query as jest.Mock).mockResolvedValueOnce([]);
    const result = await fetchPosts();
    expect(result).toEqual([]);
  });
});

describe("likePost", () => {
  it("adds user_id to likes array via addToArray", async () => {
    (getCurrentUser as jest.Mock).mockReturnValue({ uid: "user-1" });
    (db_ops.get as jest.Mock)
      .mockResolvedValueOnce({ id: "post-1", user_id: "user-2", likes: [] }) // post
      .mockResolvedValueOnce({ id: "user-1", name: "Test" }); // profile

    await likePost("post-1");

    expect(db_ops.addToArray).toHaveBeenCalledWith("posts", "post-1", "likes", "user-1");
  });

  it("does not notify if liking own post", async () => {
    const { notifyPostLike } = require("@/services/notifications");
    (getCurrentUser as jest.Mock).mockReturnValue({ uid: "user-1" });
    (db_ops.get as jest.Mock).mockResolvedValueOnce({
      id: "post-1", user_id: "user-1", likes: [],
    });

    await likePost("post-1");

    expect(notifyPostLike).not.toHaveBeenCalled();
  });
});

describe("unlikePost", () => {
  it("removes user_id from likes array", async () => {
    (getCurrentUser as jest.Mock).mockReturnValue({ uid: "user-1" });

    await unlikePost("post-1");

    expect(db_ops.removeFromArray).toHaveBeenCalledWith("posts", "post-1", "likes", "user-1");
  });
});
