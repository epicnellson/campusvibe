// Mock Firebase modules
jest.mock("@/services/firebase", () => {
  const mockUser = { uid: "user-1", email: "test@university.edu" };
  return {
    app: {},
    auth: {
      currentUser: mockUser,
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
    db: {},
    storage: {},
    getCurrentUser: jest.fn(() => mockUser),
  };
});

// Mock Firebase Auth methods
jest.mock("firebase/auth", () => ({
  sendSignInLinkToEmail: jest.fn().mockResolvedValue(undefined),
  isSignInWithEmailLink: jest.fn().mockReturnValue(false),
  signInWithEmailLink: jest.fn().mockResolvedValue({
    user: { uid: "user-1", email: "test@university.edu" },
  }),
  signInWithPopup: jest.fn().mockResolvedValue({
    user: { uid: "user-1", email: "test@university.edu" },
  }),
  GoogleAuthProvider: jest.fn(),
  signOut: jest.fn().mockResolvedValue(undefined),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: { uid: "user-1", email: "test@university.edu" },
  }),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: { uid: "user-1", email: "test@university.edu" },
  }),
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  signInWithCredential: jest.fn().mockResolvedValue({
    user: { uid: "user-1", email: "test@university.edu" },
  }),
  signInWithRedirect: jest.fn().mockResolvedValue(undefined),
  getRedirectResult: jest.fn().mockResolvedValue(null),
  browserPopupRedirectResolver: {},
}));

// Bypass retry delays in unit tests — resolve on the first attempt
jest.mock("@/services/retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
  isNetworkError: jest.fn(() => false),
  isSupabaseError: jest.fn(() => false),
  getSupabaseErrorMessage: jest.fn(() => null),
  getAuthErrorMessage: jest.fn(() => "An unexpected error occurred"),
  getErrorMessage: jest.fn(() => "Something went wrong. Please try again."),
  isRetryableError: jest.fn(() => false),
}));

// Mock expo-web-browser (used by @/services/auth at module scope)
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: "cancel" }),
}));

// Mock Firestore
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({ exists: () => false, data: () => ({}), id: "doc-id" }),
  getDocs: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
  addDoc: jest.fn().mockResolvedValue({ id: "new-doc-id" }),
  setDoc: jest.fn().mockResolvedValue(undefined),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  onSnapshot: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [], size: 0 }),
  arrayUnion: jest.fn((val) => ({ _type: "union", _data: val })),
  arrayRemove: jest.fn((val) => ({ _type: "remove", _data: val })),
  increment: jest.fn((val) => ({ _type: "increment", _data: val })),
  serverTimestamp: jest.fn(() => ({ _type: "serverTimestamp" })),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock db_ops
jest.mock("@/services/db", () => ({
  db_ops: {
    get: jest.fn().mockResolvedValue(null),
    query: jest.fn().mockResolvedValue([]),
    add: jest.fn().mockResolvedValue("new-doc-id"),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    addToArray: jest.fn().mockResolvedValue(undefined),
    removeFromArray: jest.fn().mockResolvedValue(undefined),
    increment: jest.fn().mockResolvedValue(undefined),
    subscribeToDoc: jest.fn().mockReturnValue(jest.fn()),
    subscribeToCollection: jest.fn().mockReturnValue(jest.fn()),
    batch: jest.fn().mockReturnValue({
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    }),
    serverTimestamp: jest.fn(() => ({ _type: "serverTimestamp" })),
  },
}));
