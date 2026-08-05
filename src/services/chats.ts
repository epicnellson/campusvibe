import { db_ops } from "@/services/db";
import { getCurrentUser, db, auth } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import { notifyMessage } from "@/services/notifications";
import { collection, query, where, onSnapshot, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, writeBatch } from "firebase/firestore";
import { toDate } from "@/utils/date";
import type {
  Channel,
  Message,
  MessageWithSender,
} from "@/services/database.types";

const profileCache = new Map<string, { name: string; avatar_url: string | null }>();
async function getCachedProfile(userId: string): Promise<{ name: string; avatar_url: string | null } | null> {
  if (profileCache.has(userId)) return profileCache.get(userId) ?? null;
  const p = await db_ops.get("profiles", userId);
  const result = p ? { name: p.name, avatar_url: p.avatar_url } : null;
  if (result) profileCache.set(userId, result);
  return result;
}

export async function fetchUserChannels(
  userId: string
): Promise<(Channel & { members: { user_id: string }[] })[]> {
  return withRetry(async () => {
    const memberships = await db_ops.query("channel_members", {
      conditions: [{ field: "user_id", op: "==", value: userId }],
    });

    const channelIds = [...new Set(memberships.map((m) => m.channel_id))];
    const channels = await Promise.all(
      channelIds.map((id) => db_ops.get("channels", id))
    );

    const validChannels = channels.filter(Boolean) as (Channel & { id: string })[];
    const channelsWithMembers = await Promise.all(
      validChannels.map(async (ch) => {
        const members = await db_ops.query("channel_members", {
          conditions: [{ field: "channel_id", op: "==", value: ch.id }],
        });
        return { ...ch, members: members.map((m) => ({ user_id: m.user_id })) };
      })
    );

    return channelsWithMembers;
  });
}

export async function fetchMessages(channelId: string): Promise<MessageWithSender[]> {
  return withRetry(async () => {
    const messages = await db_ops.query("messages", {
      conditions: [{ field: "channel_id", op: "==", value: channelId }],
    });

    messages.sort((a: any, b: any) => {
      const ta = toDate(a.created_at)?.getTime() ?? 0;
      const tb = toDate(b.created_at)?.getTime() ?? 0;
      return ta - tb;
    });

    const senderIds = [...new Set(messages.map((m) => m.user_id).filter(Boolean))];
    const profileEntries = await Promise.all(
      senderIds.map(async (id) => [id, await getCachedProfile(id)] as const)
    );
    const profileMap = new Map(profileEntries.filter(([, p]) => !!p));

    return messages.map((m) => {
      const p = profileMap.get(m.user_id);
      return {
        ...m,
        sender: p ? { name: p.name, avatar_url: p.avatar_url } : null,
      } as unknown as MessageWithSender;
    });
  });
}

export function generateMessageId(): string {
  return doc(collection(db, "messages")).id;
}

export async function sendMessage(
  channelId: string,
  content: string,
  messageId?: string
): Promise<void> {
  const user = getCurrentUser();

  const payload = {
    channel_id: channelId,
    user_id: user.uid,
    content: sanitizeText(content),
    status: "sent",
    seen_by: [],
    created_at: new Date().toISOString(),
  };

  if (messageId) {
    await db_ops.set("messages", messageId, {
      ...payload,
      client_id: messageId,
    });
  } else {
    await db_ops.add("messages", payload);
  }

  db_ops.query("channel_members", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  }).then((members) => {
    const otherUserIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== user.uid);
    if (otherUserIds.length > 0) {
      db_ops.get("profiles", user.uid).then((sender) => {
        for (const recipientId of otherUserIds) {
          notifyMessage(recipientId, sender?.name ?? "Someone", channelId).catch(() => {});
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}

export function subscribeToMessages(
  channelId: string,
  onMessage: (msg: MessageWithSender) => void,
  onUpdate?: (msg: MessageWithSender) => void
) {
  const q = query(
    collection(db, "messages"),
    where("channel_id", "==", channelId)
  );

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    for (const change of snapshot.docChanges()) {
      const msg = { id: change.doc.id, ...change.doc.data() } as Message;
      if (change.type === "added") {
        const profile = await getCachedProfile(msg.user_id);
        const msgWithSender: MessageWithSender = {
          ...msg,
          sender: profile ?? null,
        };
        onMessage(msgWithSender);
      } else if (change.type === "modified" && onUpdate) {
        const msgWithSender: MessageWithSender = {
          ...msg,
          sender: null,
        };
        onUpdate(msgWithSender);
      }
    }
  }, () => {});

  return unsubscribe;
}

export async function joinDefaultChannels(
  userId: string,
  department: string
): Promise<void> {
  return withRetry(async () => {
    const allChannels = await db_ops.query("channels", {
      conditions: [
        {
          field: "type",
          op: "in",
          value: ["general", "hostel"],
        },
      ],
    });

    const deptChannels = await db_ops.query("channels", {
      conditions: [
        { field: "type", op: "==", value: "department" },
        { field: "department", op: "==", value: department },
      ],
    });

    const channelsToJoin = [...allChannels, ...deptChannels];
    if (!channelsToJoin.length) return;

    for (const ch of channelsToJoin) {
      const membershipId = `${ch.id}_${userId}`;
      await db_ops.set("channel_members", membershipId, {
        channel_id: ch.id,
        user_id: userId,
      });
    }
  });
}

export async function getOrCreateDMChannel(
  userId1: string,
  userId2: string
): Promise<string> {
  return withRetry(async () => {
    // Deterministic channel ID prevents race condition duplicates
    const sorted = [userId1, userId2].sort();
    const deterministicId = `dm_${sorted[0]}_${sorted[1]}`;

    // Check if this DM already exists
    const existing = await db_ops.get("channels", deterministicId);
    if (existing) {
      return deterministicId;
    }

    // Create with deterministic ID
    await db_ops.set("channels", deterministicId, {
      name: "DM",
      type: "dm",
      created_at: new Date().toISOString(),
    });

    await Promise.all([
      db_ops.set("channel_members", `${deterministicId}_${userId1}`, {
        channel_id: deterministicId,
        user_id: userId1,
      }),
      db_ops.set("channel_members", `${deterministicId}_${userId2}`, {
        channel_id: deterministicId,
        user_id: userId2,
      }),
    ]);

    return deterministicId;
  });
}

export async function fetchAllUsers(
  search: string
): Promise<{ id: string; name: string; department: string; avatar_url?: string | null; email?: string }[]> {
  return withRetry(async () => {
    const profiles = await db_ops.query("profiles", {
      limitCount: 100,
    });

    const searchLower = search.toLowerCase();
    return profiles
      .filter((p) => {
        const name = p.name?.toLowerCase() ?? "";
        const email = p.email?.toLowerCase() ?? "";
        return name.includes(searchLower) || email.includes(searchLower);
      })
      .slice(0, 30) as any;
  });
}

export async function fetchChannelLastMessage(
  channelId: string
): Promise<{ content: string; created_at: string; senderName: string; type?: string; senderId: string } | null> {
  return withRetry(async () => {
    const messages = await db_ops.query("messages", {
      conditions: [{ field: "channel_id", op: "==", value: channelId }],
    });
    if (messages.length === 0) return null;
    messages.sort((a: any, b: any) => {
      const ta = toDate(a.created_at)?.getTime() ?? 0;
      const tb = toDate(b.created_at)?.getTime() ?? 0;
      return tb - ta;
    });
    const msg = messages[0] as any;
    const sender = await db_ops.get("profiles", msg.user_id);
    // Normalize timestamp to ISO string
    let createdAt = msg.created_at ?? "";
    if (createdAt?.seconds) {
      createdAt = new Date(createdAt.seconds * 1000).toISOString();
    } else if (typeof createdAt === "number") {
      createdAt = new Date(createdAt).toISOString();
    } else if (typeof createdAt !== "string") {
      const d = toDate(createdAt);
      createdAt = d ? d.toISOString() : "";
    }
    return {
      content: msg.content ?? "",
      created_at: createdAt,
      senderName: sender?.name ?? "",
      type: msg.type ?? "text",
      senderId: msg.user_id ?? "",
    };
  });
}

export async function fetchUnreadCount(
  channelId: string,
  userId: string
): Promise<number> {
  return withRetry(async () => {
    const lastReadKey = `chat_read_${channelId}_${userId}`;
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const lastRead = await AsyncStorage.getItem(lastReadKey);
    if (!lastRead) {
      const messages = await db_ops.query("messages", {
        conditions: [{ field: "channel_id", op: "==", value: channelId }],
      });
      return messages.filter((m: any) => m.user_id !== userId).length;
    }
    const messages = await db_ops.query("messages", {
      conditions: [
        { field: "channel_id", op: "==", value: channelId },
        { field: "created_at", op: ">", value: lastRead },
      ],
    });
    return messages.filter((m: any) => m.user_id !== userId).length;
  });
}

export async function markChannelRead(channelId: string, userId: string): Promise<void> {
  const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
  await AsyncStorage.setItem(`chat_read_${channelId}_${userId}`, new Date().toISOString());
}

export async function toggleReaction(
  messageId: string,
  emoji: string
): Promise<void> {
  const user = getCurrentUser();
  const msgRef = doc(db, "messages", messageId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) return;

  const data = msgSnap.data();
  const reactions: Record<string, string> = data.reactions ?? {};

  if (reactions[user.uid] === emoji) {
    delete reactions[user.uid];
  } else {
    reactions[user.uid] = emoji;
  }

  await updateDoc(msgRef, { reactions });
}

export async function sendReply(
  channelId: string,
  content: string,
  replyToId: string,
  messageId?: string
): Promise<void> {
  const user = getCurrentUser();

  const payload = {
    channel_id: channelId,
    user_id: user.uid,
    content: sanitizeText(content),
    reply_to: replyToId,
    status: "sent",
    seen_by: [],
    created_at: new Date().toISOString(),
  };

  if (messageId) {
    await db_ops.set("messages", messageId, {
      ...payload,
      client_id: messageId,
    });
  } else {
    await db_ops.add("messages", payload);
  }

  db_ops.query("channel_members", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  }).then((members) => {
    const otherUserIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== user.uid);
    if (otherUserIds.length > 0) {
      db_ops.get("profiles", user.uid).then((sender) => {
        for (const recipientId of otherUserIds) {
          notifyMessage(recipientId, sender?.name ?? "Someone", channelId).catch(() => {});
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}

export async function fetchChannelMembers(
  channelId: string
): Promise<string[]> {
  const members = await db_ops.query("channel_members", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  });
  return members.map((m) => m.user_id);
}

export async function fetchUserProfiles(
  userIds: string[]
): Promise<Map<string, { name: string; avatar_url: string | null }>> {
  const profiles = await Promise.all(
    userIds.map((id) => db_ops.get("profiles", id))
  );
  const map = new Map<string, { name: string; avatar_url: string | null }>();
  for (const p of profiles) {
    if (p) map.set(p.id, { name: p.name, avatar_url: p.avatar_url });
  }
  return map;
}

export type ChannelUpdate = {
  channelId: string;
  lastMessage: string;
  lastMessageTime: string;
  type?: string;
  userId: string;
};

export function subscribeToChannelUpdates(
  channelIds: string[],
  onUpdate: (update: ChannelUpdate) => void
): () => void {
  const unsubscribes: (() => void)[] = [];

  for (const channelId of channelIds) {
    const q = query(
      collection(db, "messages"),
      where("channel_id", "==", channelId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as any[];
      docs.sort((a: any, b: any) => {
        const ta = toDate(a.created_at)?.getTime() ?? 0;
        const tb = toDate(b.created_at)?.getTime() ?? 0;
        return tb - ta;
      });
      if (docs.length > 0) {
        const latest = docs[0];
        onUpdate({
          channelId,
          lastMessage: latest.content ?? "",
          lastMessageTime: latest.created_at ?? "",
          type: latest.type ?? "text",
          userId: latest.user_id ?? "",
        });
      }
    }, () => {});

    unsubscribes.push(unsubscribe);
  }

  return () => unsubscribes.forEach((unsub) => unsub());
}

export async function sendImageMessage(
  channelId: string,
  content: string,
  mediaUrl: string
): Promise<void> {
  const user = getCurrentUser();
  await db_ops.add("messages", {
    channel_id: channelId,
    user_id: user.uid,
    content: sanitizeText(content || "📷 Photo"),
    type: "image",
    media_url: mediaUrl,
    status: "sent",
    seen_by: [],
    created_at: new Date().toISOString(),
  });

  db_ops.query("channel_members", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  }).then((members) => {
    const otherUserIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== user.uid);
    if (otherUserIds.length > 0) {
      db_ops.get("profiles", user.uid).then((sender) => {
        for (const recipientId of otherUserIds) {
          notifyMessage(recipientId, sender?.name ?? "Someone", channelId).catch(() => {});
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}

export async function sendFileMessage(
  channelId: string,
  fileName: string,
  fileUrl: string,
  fileSize?: number
): Promise<void> {
  const user = getCurrentUser();
  await db_ops.add("messages", {
    channel_id: channelId,
    user_id: user.uid,
    content: sanitizeText(`📎 ${fileName}`),
    type: "file",
    media_url: fileUrl,
    file_name: fileName,
    file_size: fileSize,
    status: "sent",
    seen_by: [],
    created_at: new Date().toISOString(),
  });

  db_ops.query("channel_members", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  }).then((members) => {
    const otherUserIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== user.uid);
    if (otherUserIds.length > 0) {
      db_ops.get("profiles", user.uid).then((sender) => {
        for (const recipientId of otherUserIds) {
          notifyMessage(recipientId, sender?.name ?? "Someone", channelId).catch(() => {});
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}

export async function sendViewOnceMessage(
  channelId: string,
  content: string,
  mediaUrl?: string,
  type: "text" | "image" = "text"
): Promise<void> {
  const user = getCurrentUser();
  await db_ops.add("messages", {
    channel_id: channelId,
    user_id: user.uid,
    content: sanitizeText(content),
    type: "view_once",
    media_url: mediaUrl,
    viewed: false,
    status: "sent",
    seen_by: [],
    created_at: new Date().toISOString(),
  });

  db_ops.query("channel_members", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  }).then((members) => {
    const otherUserIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== user.uid);
    if (otherUserIds.length > 0) {
      db_ops.get("profiles", user.uid).then((sender) => {
        for (const recipientId of otherUserIds) {
          notifyMessage(recipientId, sender?.name ?? "Someone", channelId).catch(() => {});
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}

export async function markViewOnce(messageId: string): Promise<void> {
  const msgRef = doc(db, "messages", messageId);
  await updateDoc(msgRef, { viewed: true });
}

export async function editMessage(messageId: string, newContent: string): Promise<void> {
  const msgRef = doc(db, "messages", messageId);
  await updateDoc(msgRef, {
    content: sanitizeText(newContent),
    edited: true,
    edited_at: new Date().toISOString(),
  });
}

export async function deleteMessageForEveryone(messageId: string): Promise<void> {
  const msgRef = doc(db, "messages", messageId);
  await deleteDoc(msgRef);
}

export async function pinMessage(channelId: string, messageId: string): Promise<void> {
  const user = getCurrentUser();
  const pinId = `${channelId}_${messageId}`;
  await db_ops.set("pinned_messages", pinId, {
    channel_id: channelId,
    message_id: messageId,
    pinned_by: user.uid,
    created_at: new Date().toISOString(),
  });
}

export async function unpinMessage(channelId: string, messageId: string): Promise<void> {
  const pinId = `${channelId}_${messageId}`;
  await db_ops.delete("pinned_messages", pinId);
}

export async function fetchPinnedMessages(channelId: string): Promise<{ id: string; message_id: string; pinned_by: string }[]> {
  const pins = await db_ops.query("pinned_messages", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  });
  return pins as any;
}

export async function forwardMessage(messageId: string, targetChannelId: string): Promise<void> {
  const user = getCurrentUser();
  const msgSnap = await getDoc(doc(db, "messages", messageId));
  if (!msgSnap.exists()) return;
  const msgData = msgSnap.data();
  await db_ops.add("messages", {
    channel_id: targetChannelId,
    user_id: user.uid,
    content: msgData.content,
    type: msgData.type ?? "text",
    media_url: msgData.media_url ?? null,
    file_name: msgData.file_name ?? null,
    file_size: msgData.file_size ?? null,
    voice_url: msgData.voice_url ?? null,
    voice_duration: msgData.voice_duration ?? null,
    created_at: new Date().toISOString(),
  });
}

export async function blockUser(blockedId: string): Promise<void> {
  const user = getCurrentUser();
  const blockId = `${user.uid}_${blockedId}`;
  await db_ops.set("blocked_users", blockId, {
    blocker_id: user.uid,
    blocked_id: blockedId,
    created_at: new Date().toISOString(),
  });
}

export async function unblockUser(blockedId: string): Promise<void> {
  const user = getCurrentUser();
  const blockId = `${user.uid}_${blockedId}`;
  await db_ops.delete("blocked_users", blockId);
}

export async function isBlocked(blockedId: string): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
  const blockId = `${user.uid}_${blockedId}`;
  const blockDoc = await db_ops.get("blocked_users", blockId);
  return !!blockDoc;
}

export async function getBlockedUserIds(): Promise<string[]> {
  const user = getCurrentUser();
  if (!user) return [];
  const blocks = await db_ops.query("blocked_users", {
    conditions: [{ field: "blocker_id", op: "==", value: user.uid }],
  });
  return blocks.map((b: any) => b.blocked_id);
}

export async function markSeen(messageId: string): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  const msgRef = doc(db, "messages", messageId);
  await updateDoc(msgRef, {
    seen_by: arrayUnion(user.uid),
  });
}

export async function markAllSeen(messageIds: string[]): Promise<void> {
  const user = getCurrentUser();
  if (!user || messageIds.length === 0) return;
  const batch = writeBatch(db);
  for (const msgId of messageIds) {
    batch.update(doc(db, "messages", msgId), { seen_by: arrayUnion(user.uid) });
  }
  await batch.commit();
}

export async function updateOnlineStatus(): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  await db_ops.set("online_status", user.uid, {
    last_seen: new Date().toISOString(),
    userId: user.uid,
  });
}

export async function getOnlineStatus(userId: string): Promise<{ last_seen: string } | null> {
  const status = await db_ops.get("online_status", userId);
  return status as any;
}

export async function setTypingStatus(channelId: string, isTyping: boolean): Promise<void> {
  const user = getCurrentUser();
  if (!user) return;
  const typingId = `typing_${channelId}_${user.uid}`;
  if (isTyping) {
    await db_ops.set("typing_status", typingId, {
      channel_id: channelId,
      user_id: user.uid,
      started_at: new Date().toISOString(),
    });
  } else {
    await db_ops.delete("typing_status", typingId).catch(() => {});
  }
}

export function subscribeToTypingStatus(
  channelId: string,
  excludeUserId: string,
  callback: (isTyping: boolean) => void
): () => void {
  const q = query(
    collection(db, "typing_status"),
    where("channel_id", "==", channelId)
  );
  return onSnapshot(q, (snap) => {
    const otherTyping = snap.docs.some((d) => {
      const data = d.data();
      if (data.user_id === excludeUserId) return false;
      const started = new Date(data.started_at ?? 0).getTime();
      return Date.now() - started < 3000;
    });
    callback(otherTyping);
  }, () => {});
}

export function subscribeToOnlineStatus(
  userId: string,
  callback: (online: boolean) => void
): () => void {
  const statusRef = doc(db, "online_status", userId);
  return onSnapshot(statusRef, (snap) => {
    const data = snap.data();
    if (!data?.last_seen) {
      callback(false);
      return;
    }
    const lastSeen = new Date(data.last_seen).getTime();
    const now = Date.now();
    callback(now - lastSeen < 2 * 60 * 1000);
  }, () => {});
}

export async function reportUser(targetUserId: string, reason: string): Promise<void> {
  const user = getCurrentUser();
  await db_ops.add("reports", {
    content_id: targetUserId,
    content_type: "user",
    reason,
    reporter_id: user.uid,
    target_user_id: targetUserId,
  });
}

export async function reportMessage(messageId: string, reason: string, channelOwnerId: string): Promise<void> {
  const user = getCurrentUser();
  await db_ops.add("reports", {
    content_id: messageId,
    content_type: "message",
    reason,
    reporter_id: user.uid,
    target_user_id: channelOwnerId,
  });
}

export async function sendVoiceMessage(
  channelId: string,
  voiceUrl: string,
  duration: number,
  messageId?: string
): Promise<void> {
  const user = getCurrentUser();
  const payload = {
    channel_id: channelId,
    user_id: user.uid,
    content: "🎙️ Voice message",
    type: "voice",
    voice_url: voiceUrl,
    voice_duration: duration,
    status: "sent",
    seen_by: [],
    created_at: new Date().toISOString(),
  };
  if (messageId) {
    await db_ops.set("messages", messageId, {
      ...payload,
      client_id: messageId,
    });
  } else {
    await db_ops.add("messages", payload);
  }

  db_ops.query("channel_members", {
    conditions: [{ field: "channel_id", op: "==", value: channelId }],
  }).then((members) => {
    const otherUserIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== user.uid);
    if (otherUserIds.length > 0) {
      db_ops.get("profiles", user.uid).then((sender) => {
        for (const recipientId of otherUserIds) {
          notifyMessage(recipientId, sender?.name ?? "Someone", channelId).catch(() => {});
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}

export async function deleteMessageForMe(messageId: string): Promise<void> {
  const user = getCurrentUser();
  const msgRef = doc(db, "messages", messageId);
  await updateDoc(msgRef, {
    [`deleted_for_${user.uid}`]: true,
  });
}
