import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import { notifyMessage } from "@/services/notifications";
import type {
  Channel,
  Message,
  MessageWithSender,
} from "@/services/database.types";

export async function fetchUserChannels(
  userId: string
): Promise<(Channel & { members: { user_id: string }[] })[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("channel_members")
      .select(
        `
      channel_id,
      channels!inner(
        id,
        name,
        type,
        department,
        created_at
      )
    `
      )
      .eq("user_id", userId);

    if (error) throw error;

    const channelList = data?.map((d: any) => d.channels) ?? [];

    // For DM channels, also fetch member names to display as channel name
    const channelsWithMembers = await Promise.all(
      channelList.map(async (ch: Channel) => {
        const { data: members } = await supabase
          .from("channel_members")
          .select("user_id")
          .eq("channel_id", ch.id);
        return { ...ch, members: members ?? [] };
      })
    );

    return channelsWithMembers;
  });
}

export async function fetchMessages(channelId: string): Promise<MessageWithSender[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("messages")
      .select(
        `
      id,
      content,
      created_at,
      channel_id,
      user_id,
      sender:user_id(name)
    `
      )
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as MessageWithSender[];
  });
}

export async function sendMessage(
  channelId: string,
  content: string
): Promise<void> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { error } = await supabase.from("messages").insert({
      channel_id: channelId,
      user_id: user.id,
      content: sanitizeText(content),
    });
    if (error) throw error;

    // Notify other DM participants
    const { data: members } = await supabase
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", channelId);

    const otherUserIds = (members ?? [])
      .map((m) => m.user_id)
      .filter((uid) => uid !== user.id);

    if (otherUserIds.length > 0) {
      const { data: sender } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user.id)
        .single();

      for (const recipientId of otherUserIds) {
        notifyMessage(recipientId, sender?.name ?? "Someone", channelId);
      }
    }
  });
}

export function subscribeToMessages(
  channelId: string,
  onMessage: (msg: MessageWithSender) => void
) {
  const subscription = supabase
    .channel(`messages:${channelId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `channel_id=eq.${channelId}`,
      },
      async (payload) => {
        const msg = payload.new as Message;
        // Fetch sender name for the new message
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", msg.user_id)
          .single();

        const msgWithSender: MessageWithSender = {
          ...msg,
          sender: profile ?? null,
        };
        onMessage(msgWithSender);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}

export async function joinDefaultChannels(
  userId: string,
  department: string
): Promise<void> {
  return withRetry(async () => {
    const { data: channels } = await supabase
      .from("channels")
      .select("id, name")
      .in("type", ["general", "hostel"])
      .or(
        `and(type.eq.department,department.eq.${department.replace(/[^a-zA-Z0-9 _-]/g, "")})`
      );

    if (!channels?.length) return;

    const memberships = channels.map((ch) => ({
      channel_id: ch.id,
      user_id: userId,
    }));

    const { error } = await supabase.from("channel_members").upsert(memberships, {
      onConflict: "channel_id, user_id",
      ignoreDuplicates: true,
    });

    if (error) throw error;
  });
}

export async function getOrCreateDMChannel(
  userId1: string,
  userId2: string
): Promise<string> {
  return withRetry(async () => {
    // Find existing DM channel between these two users
    const { data: existing } = await supabase.rpc("get_dm_channel", {
      user1: userId1,
      user2: userId2,
    });

    if (existing) return existing;

    // Create new DM channel
    const { data: channel, error: channelError } = await supabase
      .from("channels")
      .insert({
        name: "DM",
        type: "dm",
      })
      .select("id")
      .single();

    if (channelError) throw channelError;

    // Add both users
    const { error: membersError } = await supabase
      .from("channel_members")
      .insert([
        { channel_id: channel.id, user_id: userId1 },
        { channel_id: channel.id, user_id: userId2 },
      ]);

    if (membersError) throw membersError;

    return channel.id;
  });
}

export async function fetchAllUsers(
  search: string
): Promise<{ id: string; name: string; department: string }[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, department")
      .ilike("name", `%${search}%`)
      .limit(20);

    if (error) throw error;
    return data ?? [];
  });
}
