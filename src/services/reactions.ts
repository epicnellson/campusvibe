import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/services/firebase";

export const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😡", "👍"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type Reaction = {
  id: string;
  user_id: string;
  post_id: string;
  emoji: string;
  created_at: string;
};

export async function setReaction(postId: string, emoji: ReactionEmoji) {
  return withRetry(async () => {
    const user = getCurrentUser();
    const reactionId = `${user.uid}_${postId}`;
    await db_ops.set("reactions", reactionId, {
      user_id: user.uid,
      post_id: postId,
      emoji,
    });
  });
}

export async function removeReaction(postId: string) {
  return withRetry(async () => {
    const user = getCurrentUser();
    const reactionId = `${user.uid}_${postId}`;
    await db_ops.delete("reactions", reactionId);
  });
}

export async function fetchReactions(postId: string): Promise<Reaction[]> {
  const data = await db_ops.query("reactions", {
    conditions: [{ field: "post_id", op: "==", value: postId }],
  });
  return data as Reaction[];
}

export async function fetchReactionsForPosts(postIds: string[]): Promise<Map<string, Reaction[]>> {
  if (postIds.length === 0) return new Map();
  const allReactions: Reaction[] = [];

  for (const postId of postIds) {
    const reactions = await fetchReactions(postId);
    allReactions.push(...reactions);
  }

  const map = new Map<string, Reaction[]>();
  for (const r of allReactions) {
    const existing = map.get(r.post_id) ?? [];
    existing.push(r);
    map.set(r.post_id, existing);
  }
  return map;
}
