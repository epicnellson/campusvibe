/**
 * Post creation + like/unlike tests
 *
 * Tests:
 * - Create a post
 * - Fetch posts
 * - Like a post (and trigger notification)
 * - Unlike a post
 */

import { createPost, fetchPosts, likePost, unlikePost } from "@/services/posts";

const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();

jest.mock("@/services/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({
          data: { user: { id: "user-1", email: "test@university.edu" } },
        }),
    },
  },
}));

// Mock notifications to avoid side effects
jest.mock("@/services/notifications", () => ({
  notifyPostLike: jest.fn(),
}));

function setupMockQuery(result: unknown) {
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockOrder.mockReturnThis();
  mockInsert.mockReturnThis();
  mockDelete.mockReturnThis();
  mockSingle.mockReturnThis();

  const chain: Record<string, jest.Mock> = {
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
  };

  mockFrom.mockImplementation(() => chain);
  mockSelect.mockResolvedValue(result);
  mockInsert.mockResolvedValue({ error: null });
  mockDelete.mockResolvedValue({ error: null });
  mockEq.mockResolvedValue(result);
  mockOrder.mockResolvedValue(result);
  mockSingle.mockResolvedValue(result);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createPost", () => {
  it("inserts a new post and returns it", async () => {
    const mockPost = {
      id: "post-1",
      user_id: "user-1",
      content: "Hello campus!",
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    };

    mockSelect.mockResolvedValue({ data: mockPost, error: null });
    mockEq.mockReturnThis();
    mockOrder.mockReturnThis();
    mockInsert.mockReturnThis();
    mockSingle.mockResolvedValue({ data: mockPost, error: null });

    mockFrom.mockImplementation(() => ({
      insert: mockInsert,
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
    }));

    const result = await createPost("Hello campus!");
    expect(result).toEqual(mockPost);
    expect(mockInsert).toHaveBeenCalledWith({
      user_id: "user-1",
      content: "Hello campus!",
    });
  });

  it("throws on empty content", async () => {
    await expect(createPost("")).rejects.toThrow();
  });
});

describe("fetchPosts", () => {
  it("returns ordered posts with profile and likes", async () => {
    const mockData = [
      {
        id: "post-1",
        content: "First!",
        user_id: "user-1",
        created_at: "2026-06-02T00:00:00Z",
        updated_at: "2026-06-02T00:00:00Z",
        profiles: { name: "Alice", department: "CS" },
        likes: [{ id: "like-1", user_id: "user-2" }],
      },
    ];

    setupMockQuery({ data: mockData, error: null });

    const result = await fetchPosts();
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("First!");
    expect(result[0].profiles?.name).toBe("Alice");
    expect(mockOrder).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("returns empty array when no posts", async () => {
    setupMockQuery({ data: [], error: null });
    const result = await fetchPosts();
    expect(result).toEqual([]);
  });

  it("throws on query error", async () => {
    setupMockQuery({ data: null, error: new Error("Database error") });
    await expect(fetchPosts()).rejects.toThrow("Database error");
  });
});

describe("likePost", () => {
  it("inserts a like", async () => {
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: { user_id: "user-2" },
        error: null,
      }),
      single: jest.fn().mockResolvedValue({
        data: { user_id: "user-2" },
        error: null,
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await likePost("post-1");
    expect(mockFrom).toHaveBeenCalledWith("posts");
  });

  it("does not notify if liking own post", async () => {
    const { notifyPostLike } = require("@/services/notifications");
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({
        data: { user_id: "user-1" },
        error: null,
      }),
      single: jest.fn().mockResolvedValue({
        data: { user_id: "user-1" },
        error: null,
      }),
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await likePost("post-1");
    expect(notifyPostLike).not.toHaveBeenCalled();
  });
});

describe("unlikePost", () => {
  it("deletes the like for current user and post", async () => {
    mockFrom.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq: jest
        .fn()
        .mockResolvedValueOnce({ error: null })
        .mockResolvedValueOnce({ error: null }),
    });

    await unlikePost("post-1");
    expect(mockFrom).toHaveBeenCalledWith("likes");
  });
});
