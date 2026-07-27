import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { Reaction } from "@/services/reactions";

type PostInteractionsState = {
  reactionsMap: Map<string, Reaction[]>;
  repostedIds: Set<string>;
  repostCounts: Map<string, number>;
  commentCounts: Map<string, number>;
};

type PostInteractionsCtx = PostInteractionsState & {
  toggleLike: (postId: string, userId: string) => void;
  toggleReaction: (postId: string, userId: string, emoji: string | null) => void;
  toggleRepost: (postId: string, userId: string, reposted: boolean) => void;
  setCommentCount: (postId: string, count: number) => void;
  incrementCommentCount: (postId: string) => void;
  decrementCommentCount: (postId: string) => void;
  setReactionsForPost: (postId: string, reactions: Reaction[]) => void;
  bulkSetReactions: (map: Map<string, Reaction[]>) => void;
  bulkSetRepostedIds: (ids: Set<string>) => void;
  bulkSetRepostCounts: (counts: Map<string, number>) => void;
  bulkSetCommentCounts: (counts: Map<string, number>) => void;
};

const PostInteractionsContext = createContext<PostInteractionsCtx | null>(null);

export function PostInteractionsProvider({ children }: { children: React.ReactNode }) {
  const [reactionsMap, setReactionsMap] = useState<Map<string, Reaction[]>>(new Map());
  const [repostedIds, setRepostedIds] = useState<Set<string>>(new Set());
  const [repostCounts, setRepostCounts] = useState<Map<string, number>>(new Map());
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());

  const toggleLike = useCallback((postId: string, userId: string) => {
    setReactionsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(postId) ?? [];
      const hasLike = existing.some((r) => r.user_id === userId && r.emoji === "❤️");
      if (hasLike) {
        next.set(postId, existing.filter((r) => !(r.user_id === userId && r.emoji === "❤️")));
      } else {
        next.set(postId, [...existing, { id: `${userId}_${postId}`, user_id: userId, post_id: postId, emoji: "❤️", created_at: "" }]);
      }
      return next;
    });
  }, []);

  const toggleReaction = useCallback((postId: string, userId: string, emoji: string | null) => {
    setReactionsMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(postId) ?? [];
      if (emoji === null) {
        next.set(postId, existing.filter((r) => r.user_id !== userId));
      } else {
        const without = existing.filter((r) => r.user_id !== userId);
        without.push({ id: `${userId}_${postId}`, user_id: userId, post_id: postId, emoji, created_at: "" });
        next.set(postId, without);
      }
      return next;
    });
  }, []);

  const toggleRepost = useCallback((postId: string, userId: string, reposted: boolean) => {
    setRepostedIds((prev) => {
      const next = new Set(prev);
      if (reposted) next.add(postId);
      else next.delete(postId);
      return next;
    });
    setRepostCounts((prev) => {
      const next = new Map(prev);
      const current = next.get(postId) ?? 0;
      next.set(postId, reposted ? current + 1 : Math.max(0, current - 1));
      return next;
    });
  }, []);

  const setCommentCountFn = useCallback((postId: string, count: number) => {
    setCommentCounts((prev) => {
      const next = new Map(prev);
      next.set(postId, count);
      return next;
    });
  }, []);

  const incrementCommentCount = useCallback((postId: string) => {
    setCommentCounts((prev) => {
      const next = new Map(prev);
      next.set(postId, (next.get(postId) ?? 0) + 1);
      return next;
    });
  }, []);

  const decrementCommentCount = useCallback((postId: string) => {
    setCommentCounts((prev) => {
      const next = new Map(prev);
      next.set(postId, Math.max(0, (next.get(postId) ?? 0) - 1));
      return next;
    });
  }, []);

  const setReactionsForPost = useCallback((postId: string, reactions: Reaction[]) => {
    setReactionsMap((prev) => {
      const next = new Map(prev);
      next.set(postId, reactions);
      return next;
    });
  }, []);

  const value = useMemo<PostInteractionsCtx>(() => ({
    reactionsMap,
    repostedIds,
    repostCounts,
    commentCounts,
    toggleLike,
    toggleReaction,
    toggleRepost,
    setCommentCount: setCommentCountFn,
    incrementCommentCount,
    decrementCommentCount,
    setReactionsForPost,
    bulkSetReactions: setReactionsMap,
    bulkSetRepostedIds: setRepostedIds,
    bulkSetRepostCounts: setRepostCounts,
    bulkSetCommentCounts: setCommentCounts,
  }), [reactionsMap, repostedIds, repostCounts, commentCounts, toggleLike, toggleReaction, toggleRepost, setCommentCountFn, incrementCommentCount, decrementCommentCount, setReactionsForPost]);

  return (
    <PostInteractionsContext.Provider value={value}>
      {children}
    </PostInteractionsContext.Provider>
  );
}

export function usePostInteractions() {
  const ctx = useContext(PostInteractionsContext);
  if (!ctx) throw new Error("usePostInteractions must be used within PostInteractionsProvider");
  return ctx;
}
