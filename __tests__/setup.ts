// Mock Supabase client
jest.mock("@/services/supabase", () => {
  const mockSelect = jest.fn();
  const mockEq = jest.fn();
  const mockSingle = jest.fn();
  const mockOrder = jest.fn();
  const mockInsert = jest.fn();
  const mockDelete = jest.fn();
  const mockFrom = jest.fn(() => ({
    select: mockSelect.mockReturnThis(),
    insert: mockInsert.mockReturnThis(),
    delete: mockDelete.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    single: mockSingle,
    order: mockOrder.mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  }));

  return {
    supabase: {
      from: mockFrom,
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "test@university.edu" } },
          error: null,
        }),
        getSession: jest.fn().mockResolvedValue({
          data: {
            session: {
              user: { id: "user-1", email: "test@university.edu" },
            },
          },
        }),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn().mockResolvedValue({ error: null }),
          getPublicUrl: jest.fn(() => ({
            data: { publicUrl: "https://example.com/photo.jpg" },
          })),
        })),
      },
      channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
      })),
    },
    __mockReset: () => {
      mockSelect.mockClear();
      mockEq.mockClear();
      mockSingle.mockClear();
      mockOrder.mockClear();
      mockInsert.mockClear();
      mockDelete.mockClear();
      mockFrom.mockClear();
    },
  };
});
