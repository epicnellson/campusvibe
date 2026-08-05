import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { MessageBubble } from "@/components/message-bubble";
import { DateSeparator } from "@/components/chat/date-separator";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { MessageInput } from "@/components/chat/message-input";
import { ActiveCallModal } from "@/components/chat/active-call-modal";
import { OnlineDot } from "@/components/chat/online-dot";
import { Avatar } from "@/components/ui/Avatar";
import { ThemedText } from "@/components/themed-text";
import { MaxContentWidth } from "@/constants/theme";
import { ChatDetailSkeleton } from "@/components/feed-skeleton";
import { useProfile } from "@/hooks/use-profile";
import {
  fetchMessages,
  generateMessageId,
  sendMessage,
  subscribeToMessages,
  markChannelRead,
  toggleReaction,
  sendReply,
  sendImageMessage,
  sendFileMessage,
  sendVoiceMessage,
  fetchChannelMembers,
  fetchUserProfiles,
  editMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  pinMessage,
  unpinMessage,
  fetchPinnedMessages,
  forwardMessage,
  blockUser,
  isBlocked,
  markSeen,
  markAllSeen,
  subscribeToOnlineStatus,
  subscribeToTypingStatus,
  setTypingStatus,
  reportMessage,
} from "@/services/chats";
import { uploadChatImage, uploadChatFile, uploadChatVoice } from "@/services/storage";
import { db_ops } from "@/services/db";
import { auth } from "@/services/firebase";
import type { MessageWithSender } from "@/services/database.types";
import { useToast } from "@/components/ui/Toast";
import { getErrorMessage } from "@/services/retry";
import { emit } from "@/utils/chat-events";
import { useTheme } from "@/hooks/use-theme";
import { router, useLocalSearchParams } from "expo-router";

const REACTION_EMOJIS = ["❤️", "😂", "👍", "😮", "😢", "🔥"];
const REPORT_REASONS = ["Spam", "Inappropriate content", "Harassment", "Fake account", "Other"];

type CallSession = {
  mode: "outgoing" | "incoming";
  type: "audio" | "video";
  callId?: string;
  otherUserId: string;
  name: string;
  status: "ringing" | "connecting" | "connected" | "ended";
};

function dayLabel(dateStr: string | any): string {
  try {
    let d: Date;
    if (!dateStr) return "";
    if (typeof dateStr === "object" && dateStr?.seconds) {
      d = new Date(dateStr.seconds * 1000);
    } else if (typeof dateStr === "number") {
      d = new Date(dateStr);
    } else {
      d = new Date(dateStr);
    }
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    ) {
      return "Yesterday";
    }
    return d.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function sameDay(a: string | any, b: string | any): boolean {
  try {
    if (!a || !b) return false;
    const da = typeof a === "object" && a?.seconds ? new Date(a.seconds * 1000) : new Date(a);
    const db = typeof b === "object" && b?.seconds ? new Date(b.seconds * 1000) : new Date(b);
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return false;
    return (
      da.getDate() === db.getDate() &&
      da.getMonth() === db.getMonth() &&
      da.getFullYear() === db.getFullYear()
    );
  } catch {
    return false;
  }
}

function safeDate(dateStr: string | any): Date {
  if (!dateStr) return new Date(0);
  if (typeof dateStr === "object" && dateStr?.seconds) return new Date(dateStr.seconds * 1000);
  if (typeof dateStr === "number") return new Date(dateStr);
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const channelId = id!;
  const { profile } = useProfile();
  const toast = useToast();
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState("dm");
  const [initialCount, setInitialCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageWithSender | null>(null);
  const [otherUserId, setOtherUserId] = useState("");
  const [otherUserAvatar, setOtherUserAvatar] = useState<string | null>(null);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    message: MessageWithSender | null;
  }>({ visible: false, message: null });

  // Edit mode
  const [editingMessage, setEditingMessage] = useState<MessageWithSender | null>(null);
  const [editText, setEditText] = useState("");

  // Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState<{ message_id: string }[]>([]);

  // Forward modal
  const [forwardModal, setForwardModal] = useState<{ visible: boolean; messageId: string }>({
    visible: false,
    messageId: "",
  });
  const [channels, setChannels] = useState<any[]>([]);
  const [channelNames, setChannelNames] = useState<Record<string, string>>({});

  // Report modal
  const [reportModal, setReportModal] = useState<{ visible: boolean; messageId: string; channelOwnerId: string }>({
    visible: false,
    messageId: "",
    channelOwnerId: "",
  });

  // Blocked status
  const [blocked, setBlocked] = useState(false);

  // In-chat search
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageWithSender[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);

  // More options menu
  const [moreOptionsVisible, setMoreOptionsVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const muteKey = `chat_muted_${channelId}`;

  useEffect(() => {
    import("@react-native-async-storage/async-storage").then((mod) =>
      mod.default.getItem(muteKey).then((val) => setIsMuted(val === "true"))
    ).catch(() => {});
  }, [muteKey]);

  // Active call overlay. Always defaults to null — never initialized with
  // mock/hardcoded call data. Outgoing calls start here; incoming calls are
  // surfaced by the global IncomingCallOverlay (app root), which owns the
  // ringing-call listener for the whole session.
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  const initialLoadedRef = useRef(false);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const shouldAutoScroll = useRef(true);
  const isNearBottomRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const scrollToEnd = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated });
      }, 100);
    });
  }, []);

  const handleContentSizeChange = useCallback(() => {
    if (shouldAutoScroll.current) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    isNearBottomRef.current = distanceFromBottom < 100;
    shouldAutoScroll.current = distanceFromBottom < 100;
    setShowScrollToBottom(distanceFromBottom > 150);
  }, []);

  const sortedMessages = useMemo(() => {
    const seen = new Map<string, MessageWithSender>();
    const orphaned: MessageWithSender[] = [];
    for (const m of messages) {
      const key = m.id || m.client_id;
      if (!key) {
        orphaned.push(m);
        continue;
      }
      const existing = seen.get(key);
      if (existing) {
        seen.set(key, { ...existing, ...m, pending: existing.pending && m.pending });
      } else {
        seen.set(key, m);
      }
    }
    const unique = [...seen.values(), ...orphaned];
    return unique.sort((a, b) => {
      const timeA = safeDate(a.created_at).getTime();
      const timeB = safeDate(b.created_at).getTime();
      return timeA - timeB;
    });
  }, [messages]);

  const retryLoad = useCallback(() => {
    setLoadError(false);
    setReloadKey((k) => k + 1);
  }, []);

  // Load channel data
  useEffect(() => {
    if (!channelId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const user = auth.currentUser;
        setCurrentUserId(user?.uid ?? null);

        let msgs: MessageWithSender[] = [];
        try {
          msgs = await fetchMessages(channelId);
          setLoadError(false);
        } catch (e) {
          console.warn("fetchMessages failed:", e);
          setLoadError(true);
        }

        setMessages(msgs);
        setInitialCount(msgs.length);

        // Track all known message IDs so subscription skips them
        messageIdsRef.current = new Set(msgs.map((m) => m.id));
        initialLoadedRef.current = true;

        let ch: any = null;
        try {
          ch = await db_ops.get("channels", channelId);
        } catch (e) {
          console.warn("Failed to load channel:", e);
        }

        if (ch) {
          setChannelType(ch.type);
          if (ch.type === "dm") {
            try {
              const memberIds = await fetchChannelMembers(channelId);
              const otherId = memberIds.find((uid) => uid !== user?.uid);
              if (otherId) {
                setOtherUserId(otherId);
                const profiles = await fetchUserProfiles([otherId]);
                const otherProfile = profiles.get(otherId);
                if (otherProfile) {
                  setChannelName(otherProfile.name);
                  setOtherUserAvatar(otherProfile.avatar_url);
                }
                const blockedStatus = await isBlocked(otherId);
                setBlocked(blockedStatus);
              }
            } catch {
              setChannelName("DM");
            }
          } else {
            setChannelName(ch.name);
          }
        }

        if (user?.uid) {
          await markChannelRead(channelId, user.uid);
          emit("channel_read", channelId, user.uid);
        }

        // Load pinned messages
        try {
          const pins = await fetchPinnedMessages(channelId);
          setPinnedMessages(pins);
        } catch {}
      } catch (e) {
        console.warn("Failed to load chat:", e);
        setLoadError(true);
      } finally {
        setLoading(false);
        scrollToEnd(false);
      }
    };
    load();
  }, [channelId, reloadKey]);

  // Subscribe to messages — process new ones and updates (read receipts)
  useEffect(() => {
    const unsub = subscribeToMessages(
      channelId,
      (msg) => {
        if (!initialLoadedRef.current) return;
        if (messageIdsRef.current.has(msg.id)) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id || m.client_id === msg.client_id ? { ...m, ...msg, pending: false } : m))
          );
          return;
        }
        messageIdsRef.current.add(msg.id);
        setMessages((prev) => [...prev, msg]);
        scrollToEnd(true);
      },
      (update) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === update.id ? { ...m, ...update } : m))
        );
      }
    );
    return unsub;
  }, [channelId, scrollToEnd]);

  // Online status subscription
  useEffect(() => {
    if (!otherUserId || channelType !== "dm") return;
    const unsub = subscribeToOnlineStatus(otherUserId, (online) => {
      setIsOtherOnline(online);
    });
    return unsub;
  }, [otherUserId, channelType]);

  // Typing indicator subscription
  useEffect(() => {
    if (!currentUserId) return;
    const unsub = subscribeToTypingStatus(channelId, currentUserId, (typing) => {
      setOtherUserTyping(typing);
    });
    return unsub;
  }, [channelId, currentUserId]);

  // Online status heartbeat via AppState
  useEffect(() => {
    if (!currentUserId) return;
    const update = () => { import("@/services/chats").then((m) => m.updateOnlineStatus()).catch(() => {}); };
    update();
    const interval = setInterval(update, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") update();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [currentUserId]);

  // Mark messages as seen
  useEffect(() => {
    if (!currentUserId || sortedMessages.length === 0) return;
    const unreadIds = sortedMessages
      .filter((m) => m.user_id !== currentUserId && (!(m as any).seen_by || !(m as any).seen_by.includes(currentUserId)))
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      markAllSeen(unreadIds).catch(() => {});
    }
  }, [sortedMessages, currentUserId]);

  // Send text
  const handleSend = useCallback(
    async (text: string) => {
      if (!currentUserId) return;
      const optimisticId = generateMessageId();
      const optimisticMsg: MessageWithSender = {
        id: optimisticId,
        client_id: optimisticId,
        pending: true,
        channel_id: channelId,
        user_id: currentUserId,
        content: text,
        created_at: new Date().toISOString(),
        sender: profile ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url } as any : null,
      } as MessageWithSender;
      messageIdsRef.current.add(optimisticId);
      setMessages((prev) => [...prev, optimisticMsg]);
      scrollToEnd(true);
      setReplyingTo(null);

      setTypingStatus(channelId, false).catch(() => {});
      try {
        if (replyingTo) {
          await sendReply(channelId, text, replyingTo.id, optimisticId);
        } else {
          await sendMessage(channelId, text, optimisticId);
        }
      } catch (err) {
        messageIdsRef.current.delete(optimisticId);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        toast.show(getErrorMessage(err), "error");
      }
    },
    [channelId, profile, replyingTo, currentUserId]
  );

  // Send image with preview
  const handleSendImage = useCallback(
    async (uriOrBlob: string | Blob) => {
      if (!currentUserId) return;
      setSending(true);
      try {
        const fileName = `photo_${Date.now()}.jpg`;
        let url: string;
        if (typeof uriOrBlob === "string") {
          url = await uploadChatImage(channelId, fileName, uriOrBlob);
        } else {
          url = await uploadChatImage(channelId, fileName, uriOrBlob);
        }
        if (url) {
          await sendImageMessage(channelId, "📷 Photo", url);
        }
      } catch (e) {
        console.warn("Failed to send image:", e);
        Alert.alert("Error", "Could not send photo.");
      } finally {
        setSending(false);
      }
    },
    [channelId]
  );

  // Send file with preview
  const handleSendFile = useCallback(
    async (uri: string, name: string, contentType?: string) => {
      if (!currentUserId) return;
      setSending(true);
      try {
        let url: string;
        if (Platform.OS === "web") {
          const response = await fetch(uri);
          const blob = await response.blob();
          url = await uploadChatFile(channelId, name, blob, contentType ?? (blob.type || "application/octet-stream"));
        } else {
          url = await uploadChatFile(channelId, name, uri, contentType);
        }
        if (url) {
          await sendFileMessage(channelId, name, url);
        }
      } catch (e) {
        console.warn("Failed to send file:", e);
        Alert.alert("Error", "Could not send file.");
      } finally {
        setSending(false);
      }
    },
    [channelId]
  );

  // Send voice message
  const handleSendVoice = useCallback(
    async (uriOrBlob: string | Blob, duration: number) => {
      if (!currentUserId) return;
      const optimisticId = generateMessageId();
      const optimisticVoice: MessageWithSender = {
        id: optimisticId,
        client_id: optimisticId,
        pending: true,
        type: "voice",
        channel_id: channelId,
        user_id: currentUserId,
        content: "🎙️ Voice message",
        voice_url: typeof uriOrBlob === "string" ? uriOrBlob : undefined,
        voice_duration: duration,
        created_at: new Date().toISOString(),
        sender: profile
          ? { id: profile.id, name: profile.name, avatar_url: profile.avatar_url } as any
          : null,
      } as MessageWithSender;
      messageIdsRef.current.add(optimisticId);
      setMessages((prev) => [...prev, optimisticVoice]);
      scrollToEnd(true);

      setSending(true);
      try {
        const fileName = `voice_${Date.now()}.m4a`;
        const url = await uploadChatVoice(channelId, fileName, uriOrBlob);
        if (url) {
          await sendVoiceMessage(channelId, url, duration, optimisticId);
        } else {
          messageIdsRef.current.delete(optimisticId);
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
          Alert.alert("Upload failed", "Could not upload voice message. Check that the storage bucket is configured.");
        }
      } catch (e) {
        messageIdsRef.current.delete(optimisticId);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        console.warn("Failed to send voice:", e);
        Alert.alert("Error", `Could not send voice message: ${e instanceof Error ? e.message : "Unknown error"}`);
      } finally {
        setSending(false);
      }
    },
    [channelId, currentUserId, profile]
  );

  // Context menu handlers
  const handleLongPress = useCallback((item: MessageWithSender) => {
    setContextMenu({ visible: true, message: item });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, message: null });
  }, []);

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      try {
        await toggleReaction(messageId, emoji);
      } catch (err) {
        toast.show(getErrorMessage(err), "error");
      }
    },
    []
  );

  const handleCopy = useCallback(() => {
    if (contextMenu.message) {
      Clipboard.setString(contextMenu.message.content);
      Alert.alert("Copied", "Message copied to clipboard");
    }
    closeContextMenu();
  }, [contextMenu.message, closeContextMenu]);

  const handleReply = useCallback((message?: MessageWithSender) => {
    const target = message ?? contextMenu.message;
    if (target) setReplyingTo(target);
    closeContextMenu();
  }, [contextMenu.message, closeContextMenu]);

  const handleEdit = useCallback(() => {
    if (contextMenu.message) {
      setEditingMessage(contextMenu.message);
      setEditText(contextMenu.message.content);
    }
    closeContextMenu();
  }, [contextMenu.message, closeContextMenu]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
    setEditText("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingMessage || !editText.trim()) return;
    try {
      await editMessage(editingMessage.id, editText.trim());
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessage.id
            ? { ...m, content: editText.trim(), edited: true, edited_at: new Date().toISOString() }
            : m
        )
      );
    } catch (err) {
      toast.show(getErrorMessage(err), "error");
    }
    handleCancelEdit();
  }, [editingMessage, editText, handleCancelEdit]);

  const handlePin = useCallback(async () => {
    if (!contextMenu.message) return;
    try {
      await pinMessage(channelId, contextMenu.message.id);
      const pins = await fetchPinnedMessages(channelId);
      setPinnedMessages(pins);
    } catch (err) {
      toast.show(getErrorMessage(err), "error");
    }
    closeContextMenu();
  }, [channelId, contextMenu.message, closeContextMenu]);

  const handleForward = useCallback(() => {
    if (contextMenu.message) {
      setForwardModal({ visible: true, messageId: contextMenu.message.id });
    }
    closeContextMenu();
  }, [contextMenu.message, closeContextMenu]);

  const handleForwardToChannel = useCallback(
    async (targetChannelId: string) => {
      try {
        await forwardMessage(forwardModal.messageId, targetChannelId);
        Alert.alert("Forwarded", "Message forwarded.");
      } catch (err) {
        toast.show(getErrorMessage(err), "error");
      }
      setForwardModal({ visible: false, messageId: "" });
    },
    [forwardModal.messageId]
  );

  const handleDeleteForMe = useCallback(async () => {
    if (!contextMenu.message) return;
    try {
      await deleteMessageForMe(contextMenu.message.id);
      setMessages((prev) => prev.filter((m) => m.id !== contextMenu.message!.id));
    } catch (err) {
      toast.show(getErrorMessage(err), "error");
    }
    closeContextMenu();
  }, [contextMenu.message, closeContextMenu]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (!contextMenu.message) return;
    Alert.alert("Delete for everyone", "This will delete the message for all participants.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMessageForEveryone(contextMenu.message!.id);
            setMessages((prev) => prev.filter((m) => m.id !== contextMenu.message!.id));
          } catch (err) {
            toast.show(getErrorMessage(err), "error");
          }
          closeContextMenu();
        },
      },
    ]);
  }, [contextMenu.message, closeContextMenu]);

  const handleReport = useCallback(() => {
    if (contextMenu.message) {
      setReportModal({
        visible: true,
        messageId: contextMenu.message.id,
        channelOwnerId: contextMenu.message.user_id,
      });
    }
    closeContextMenu();
  }, [contextMenu.message, closeContextMenu]);

  const handleReportSubmit = useCallback(
    async (reason: string) => {
      try {
        await reportMessage(reportModal.messageId, reason, reportModal.channelOwnerId);
        Alert.alert("Reported", "Thank you for your report.");
      } catch (err) {
        toast.show(getErrorMessage(err), "error");
      }
      setReportModal({ visible: false, messageId: "", channelOwnerId: "" });
    },
    [reportModal]
  );

  const handleBlock = useCallback(async () => {
    if (!otherUserId) return;
    Alert.alert("Block user", `Block ${channelName}? They won't be able to message you.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(otherUserId);
            setBlocked(true);
            Alert.alert("Blocked", `${channelName} has been blocked.`);
          } catch (err) {
            toast.show(getErrorMessage(err), "error");
          }
        },
      },
    ]);
    closeContextMenu();
  }, [otherUserId, channelName, closeContextMenu]);

  // Load channels for forward modal
  useEffect(() => {
    if (forwardModal.visible) {
      import("@/services/chats").then(({ fetchUserChannels, fetchChannelMembers, fetchUserProfiles }) => {
        const user = auth.currentUser;
        if (user) {
          fetchUserChannels(user.uid).then(async (chs) => {
            setChannels(chs);
            const names: Record<string, string> = {};
            await Promise.all(chs.map(async (ch: any) => {
              if (ch.type === "dm") {
                const members = await fetchChannelMembers(ch.id);
                const otherId = members.find((uid: string) => uid !== user?.uid);
                if (otherId) {
                  const profiles = await fetchUserProfiles([otherId]);
                  names[ch.id] = profiles.get(otherId)?.name ?? "DM";
                } else {
                  names[ch.id] = "DM";
                }
              } else {
                names[ch.id] = ch.name;
              }
            }));
            setChannelNames(names);
          }).catch(() => {});
        }
      });
    }
  }, [forwardModal.visible]);

  // In-chat search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCurrentResultIndex(0);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = sortedMessages.filter(
      (m) => m.content?.toLowerCase().includes(q)
    );
    setSearchResults(results);
    setCurrentResultIndex(0);
    if (results.length > 0) {
      const idx = sortedMessages.findIndex((m) => m.id === results[0].id);
      if (idx >= 0) {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      }
    }
  }, [searchQuery, sortedMessages]);

  const searchResultIds = useMemo(
    () => new Set(searchResults.map((m) => m.id)),
    [searchResults]
  );

  const highlightedId = useMemo(
    () => (searchResults.length > 0 ? searchResults[currentResultIndex]?.id : null),
    [searchResults, currentResultIndex]
  );

  const navigateSearchResult = useCallback(
    (direction: "next" | "prev") => {
      if (searchResults.length === 0) return;
      const newIndex =
        direction === "next"
          ? (currentResultIndex + 1) % searchResults.length
          : (currentResultIndex - 1 + searchResults.length) % searchResults.length;
      setCurrentResultIndex(newIndex);
      const msgId = searchResults[newIndex]?.id;
      const idx = sortedMessages.findIndex((m) => m.id === msgId);
      if (idx >= 0) {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
      }
    },
    [searchResults, currentResultIndex, sortedMessages]
  );

  const handleStartCall = useCallback(
    (type: "audio" | "video") => {
      if (!otherUserId) return;
      setActiveCall((prev) => prev ?? {
        mode: "outgoing",
        type,
        otherUserId,
        name: channelName || "User",
        status: "ringing",
      });
    },
    [otherUserId, channelName]
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.flex}>
          <ChatDetailSkeleton />
        </View>
      </View>
    );
  }

  const ownMessage = contextMenu.message?.user_id === currentUserId;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (searchVisible) {
                setSearchVisible(false);
                setSearchQuery("");
              } else {
                router.canGoBack() ? router.back() : router.replace("/");
              }
            }}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          {searchVisible ? (
            <View style={styles.searchHeader}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search messages..."
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
              {searchResults.length > 0 && (
                <ThemedText style={styles.searchCounter}>
                  {currentResultIndex + 1} of {searchResults.length}
                </ThemedText>
              )}
              <View style={styles.searchNav}>
                <Pressable
                  onPress={() => navigateSearchResult("prev")}
                  style={[
                    styles.searchNavBtn,
                    searchResults.length === 0 && { opacity: 0.3 },
                  ]}
                >
                  <Ionicons name="chevron-up" size={16} color={theme.text} />
                </Pressable>
                <Pressable
                  onPress={() => navigateSearchResult("next")}
                  style={[
                    styles.searchNavBtn,
                    searchResults.length === 0 && { opacity: 0.3 },
                  ]}
                >
                  <Ionicons name="chevron-down" size={16} color={theme.text} />
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  setSearchVisible(false);
                  setSearchQuery("");
                }}
                style={styles.searchClear}
              >
                <Ionicons name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  if (channelType === "dm" && otherUserId) router.push(`/user/${otherUserId}`);
                }}
                style={styles.headerCenter}
                disabled={channelType !== "dm"}
              >
                <View>
                  <Avatar uri={otherUserAvatar} name={channelName || "Chat"} size={36} />
                  {channelType === "dm" && isOtherOnline && <OnlineDot />}
                </View>
                <View style={styles.headerInfo}>
                  <ThemedText style={styles.headerName} numberOfLines={1}>
                    {channelName || "Chat"}
                  </ThemedText>
                  {otherUserTyping ? (
                    <ThemedText style={styles.headerTyping}>typing...</ThemedText>
                  ) : channelType === "dm" ? (
                    <ThemedText style={styles.headerSubtitle}>
                      {isOtherOnline ? "Online" : ""}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>

              {channelType === "dm" && (
                <>
                  <Pressable
                    onPress={() => handleStartCall("audio")}
                    style={styles.headerAction}
                    accessibilityLabel="Start audio call"
                    accessibilityRole="button"
                  >
                    <Ionicons name="call" size={20} color={theme.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleStartCall("video")}
                    style={styles.headerAction}
                    accessibilityLabel="Start video call"
                    accessibilityRole="button"
                  >
                    <Ionicons name="videocam" size={20} color={theme.primary} />
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => setMoreOptionsVisible(true)}
                style={styles.headerAction}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.text} />
              </Pressable>
            </>
          )}
        </View>

      </SafeAreaView>

      {/* Pinned messages bar */}
      {pinnedMessages.length > 0 && (
        <Pressable
          style={styles.pinnedBar}
          onPress={() => {
            const firstPin = pinnedMessages[0];
            const msg = messages.find((m) => m.id === firstPin.message_id);
            if (msg) {
              flatListRef.current?.scrollToIndex({
                index: sortedMessages.findIndex((m) => m.id === msg.id),
                animated: true,
              });
            }
          }}
        >
          <Ionicons name="pin" size={14} color={theme.primary} />
          <ThemedText style={styles.pinnedText} numberOfLines={1}>
            {pinnedMessages.length} pinned message{pinnedMessages.length > 1 ? "s" : ""}
          </ThemedText>
          <Ionicons name="chevron-forward" size={14} color={theme.primary} />
        </Pressable>
      )}

      {/* Context menu */}
      <Modal visible={contextMenu.visible} transparent animationType="slide" onRequestClose={closeContextMenu}>
        <View style={styles.contextOverlay}>
          <Pressable style={styles.contextBackdrop} onPress={closeContextMenu} />
          <View style={styles.contextSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.reactionsRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => {
                    handleReaction(contextMenu.message!.id, emoji);
                    closeContextMenu();
                  }}
                  style={styles.reactionOption}
                >
                  <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.contextDivider} />
            <Pressable onPress={() => handleReply()} style={styles.contextItem}>
              <Ionicons name="arrow-undo-outline" size={20} color={theme.text} />
              <ThemedText style={styles.contextText}>Reply</ThemedText>
            </Pressable>
            <Pressable onPress={handleCopy} style={styles.contextItem}>
              <Ionicons name="copy-outline" size={20} color={theme.text} />
              <ThemedText style={styles.contextText}>Copy</ThemedText>
            </Pressable>
            <Pressable onPress={handleForward} style={styles.contextItem}>
              <Ionicons name="arrow-redo-outline" size={20} color={theme.text} />
              <ThemedText style={styles.contextText}>Forward</ThemedText>
            </Pressable>
            {ownMessage && (
              <Pressable onPress={handleEdit} style={styles.contextItem}>
                <Ionicons name="create-outline" size={20} color={theme.text} />
                <ThemedText style={styles.contextText}>Edit</ThemedText>
              </Pressable>
            )}
            <Pressable onPress={handlePin} style={styles.contextItem}>
              <Ionicons name="pin-outline" size={20} color={theme.text} />
              <ThemedText style={styles.contextText}>Pin</ThemedText>
            </Pressable>
            {ownMessage && (
              <>
                <Pressable onPress={handleDeleteForMe} style={styles.contextItem}>
                  <Ionicons name="trash-outline" size={20} color={theme.error} />
                  <ThemedText style={[styles.contextText, { color: theme.error }]}>
                    Delete for me
                  </ThemedText>
                </Pressable>
                <Pressable onPress={handleDeleteForEveryone} style={styles.contextItem}>
                  <Ionicons name="trash" size={20} color={theme.error} />
                  <ThemedText style={[styles.contextText, { color: theme.error }]}>
                    Delete for everyone
                  </ThemedText>
                </Pressable>
              </>
            )}
            {!ownMessage && (
              <>
                <View style={styles.contextDivider} />
                <Pressable onPress={handleReport} style={styles.contextItem}>
                  <Ionicons name="flag-outline" size={20} color={theme.warning} />
                  <ThemedText style={[styles.contextText, { color: theme.warning }]}>
                    Report message
                  </ThemedText>
                </Pressable>
                {channelType === "dm" && (
                  <Pressable onPress={handleBlock} style={styles.contextItem}>
                    <Ionicons name="ban-outline" size={20} color={theme.error} />
                    <ThemedText style={[styles.contextText, { color: theme.error }]}>
                      Block user
                    </ThemedText>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit mode bar */}
      {editingMessage && (
        <View style={styles.editBar}>
          <View style={styles.editBarContent}>
            <Ionicons name="create-outline" size={18} color={theme.primary} />
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              autoFocus
              onSubmitEditing={handleSaveEdit}
            />
            <Pressable onPress={handleCancelEdit} style={styles.editCancel}>
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </Pressable>
            <Pressable onPress={handleSaveEdit} style={styles.editSave}>
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      <KeyboardAvoidingView
        style={[styles.flex, Platform.OS === "ios" ? { paddingBottom: insets.bottom } : null]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={sortedMessages}
          keyExtractor={(item, index) => item.client_id ?? item.id ?? `${index}-${item.created_at ?? Date.now()}`}
          renderItem={({ item, index }) => {
            const showDate =
              index === 0 ||
              !sameDay(item.created_at, sortedMessages[index - 1]?.created_at ?? "");
            const prevMsg = sortedMessages[index - 1];
            const prevTime = prevMsg ? safeDate(prevMsg.created_at).getTime() : 0;
            const curTime = safeDate(item.created_at).getTime();
            const timeGapMs = 2 * 60 * 1000;
            const isOwn = String(item.user_id) === String(currentUserId) || Boolean((item as any).isMe);
            const isGrouped = !showDate && prevMsg && prevMsg.user_id === item.user_id && (curTime - prevTime) < timeGapMs;
            return (
              <View key={item.client_id ?? item.id} style={[styles.messageRow, isOwn ? styles.messageRowOwn : styles.messageRowOther]}>
                {showDate && <DateSeparator label={dayLabel(item.created_at)} />}
                  <MessageBubble
                    message={item}
                    isOwn={isOwn}
                    isGrouped={isGrouped}
                    isHighlighted={searchResultIds.has(item.id)}
                    readStatus={item.pending ? "sending" : (item as any).seen_by?.includes(otherUserId) ? "seen" : (item as any).status === "sending" ? "sending" : "delivered"}
                    onLongPress={handleLongPress}
                    onReaction={handleReaction}
                    onReply={handleReply}
                    currentUserId={currentUserId ?? undefined}
                  />
                {hasUnread && index === initialCount - 1 && (
                  <View style={styles.unreadDivider}>
                    <View style={styles.unreadLine} />
                    <ThemedText style={styles.unreadText}>NEW MESSAGES</ThemedText>
                    <View style={styles.unreadLine} />
                  </View>
                )}
              </View>
            );
          }}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={handleContentSizeChange}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onScrollToIndexFailed={() => scrollToEnd()}
          ListFooterComponent={otherUserTyping ? <TypingIndicator /> : null}
          ListEmptyComponent={
            loadError ? (
              <View style={styles.emptyChat}>
                <ThemedText style={styles.emptyIcon}>⚠️</ThemedText>
                <ThemedText style={styles.emptyTitle}>Couldn't load messages</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Check your connection and try again.
                </ThemedText>
                <Pressable onPress={retryLoad} style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
                  <ThemedText style={[styles.retryBtnText, { color: theme.text }]}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyChat}>
                <ThemedText style={styles.emptyIcon}>💬</ThemedText>
                <ThemedText style={styles.emptyTitle}>Start a conversation</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Send a message to {channelName || "this chat"}
                </ThemedText>
              </View>
            )
          }
        />

        {showScrollToBottom && sortedMessages.length > 0 && (
          <Pressable
            onPress={() => scrollToEnd(true)}
            style={styles.scrollToBottomBtn}
          >
            <Ionicons name="chevron-down" size={20} color={theme.text} />
          </Pressable>
        )}

        {sending && (
          <View style={styles.sendingBar}>
            <ThemedText style={styles.sendingText}>Sending...</ThemedText>
          </View>
        )}

        {blocked ? (
          <View style={styles.blockedBar}>
            <ThemedText style={styles.blockedText}>
              You have blocked this user
            </ThemedText>
          </View>
        ) : (
          <MessageInput
            onSend={handleSend}
            onSendImage={handleSendImage}
            onSendFile={handleSendFile}
            onSendVoice={handleSendVoice}
            onTyping={(typing) => setTypingStatus(channelId, typing).catch(() => {})}
            replyPreview={
              replyingTo ? (
                <View style={styles.replyPreview}>
                  <View style={styles.replyBar} />
                  <View style={styles.replyContent}>
                    <ThemedText style={styles.replyName} numberOfLines={1}>
                      Replying to {replyingTo.sender?.name ?? "Unknown"}
                    </ThemedText>
                    <ThemedText style={styles.replyText} numberOfLines={1}>
                      {replyingTo.content}
                    </ThemedText>
                  </View>
                  <Pressable onPress={() => setReplyingTo(null)} style={styles.replyClose}>
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ) : undefined
            }
          />
        )}
      </KeyboardAvoidingView>

      {/* More options modal */}
      <Modal visible={moreOptionsVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Pressable style={styles.contextBackdrop} onPress={() => setMoreOptionsVisible(false)} />
          <View style={styles.moreSheet}>
            <View style={styles.dragHandle} />

            <Pressable
              style={styles.moreOption}
              onPress={() => {
                setMoreOptionsVisible(false);
                if (otherUserId) router.push(`/user/${otherUserId}`);
              }}
            >
              <Ionicons name="person-outline" size={20} color={theme.text} />
              <ThemedText style={styles.moreOptionText}>View Profile</ThemedText>
            </Pressable>

            <Pressable
              style={styles.moreOption}
              onPress={() => {
                setMoreOptionsVisible(false);
                setSearchVisible(true);
                setSearchQuery("");
              }}
            >
              <Ionicons name="search-outline" size={20} color={theme.text} />
              <ThemedText style={styles.moreOptionText}>Search in Chat</ThemedText>
            </Pressable>

            <Pressable
              style={styles.moreOption}
              onPress={() => {
                const next = !isMuted;
                setIsMuted(next);
                setMoreOptionsVisible(false);
                import("@react-native-async-storage/async-storage").then((mod) =>
                  mod.default.setItem(muteKey, next ? "true" : "false")
                ).catch(() => {});
                toast.show(next ? "Notifications muted" : "Notifications unmuted");
              }}
            >
              <Ionicons
                name={isMuted ? "notifications-off-outline" : "notifications-outline"}
                size={20}
                color={theme.text}
              />
              <ThemedText style={styles.moreOptionText}>
                {isMuted ? "Unmute Notifications" : "Mute Notifications"}
              </ThemedText>
            </Pressable>

            <View style={styles.moreDivider} />

            <Pressable
              style={styles.moreOption}
              onPress={() => {
                setMoreOptionsVisible(false);
                handleBlock();
              }}
            >
              <Ionicons name="ban-outline" size={20} color={theme.error} />
              <ThemedText style={[styles.moreOptionText, { color: theme.error }]}>Block User</ThemedText>
            </Pressable>

            <Pressable
              style={styles.moreOption}
              onPress={() => {
                setMoreOptionsVisible(false);
                Alert.alert("Report Conversation", "Why are you reporting this conversation?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Spam",
                    onPress: () => toast.show("Report submitted. Thank you."),
                  },
                  {
                    text: "Inappropriate",
                    onPress: () => toast.show("Report submitted. Thank you."),
                  },
                  {
                    text: "Harassment",
                    onPress: () => toast.show("Report submitted. Thank you."),
                  },
                ]);
              }}
            >
              <Ionicons name="flag-outline" size={20} color={theme.warning} />
              <ThemedText style={[styles.moreOptionText, { color: theme.warning }]}>Report</ThemedText>
            </Pressable>

            <Pressable
              onPress={() => setMoreOptionsVisible(false)}
              style={styles.modalCancel}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Forward modal */}
      <Modal
        visible={forwardModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setForwardModal({ visible: false, messageId: "" })}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setForwardModal({ visible: false, messageId: "" })}
          />
          <View style={styles.modalSheet}>
            <ThemedText style={styles.modalTitle}>Forward to</ThemedText>
              <FlatList
              data={channels}
              keyExtractor={(c) => c.id}
              renderItem={({ item: ch }) => {
                const displayName = channelNames[ch.id] ?? ch.name;
                return (
                  <Pressable
                    onPress={() => handleForwardToChannel(ch.id)}
                    style={styles.channelItem}
                  >
                    <Avatar uri={null} name={displayName} size={40} />
                    <ThemedText style={styles.channelItemName}>{displayName}</ThemedText>
                    <Ionicons name="arrow-redo-outline" size={18} color={theme.primary} />
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <ThemedText style={styles.emptyText}>No other channels</ThemedText>
              }
            />
            <Pressable
              onPress={() => setForwardModal({ visible: false, messageId: "" })}
              style={styles.modalCancel}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Report modal */}
      <Modal
        visible={reportModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModal({ visible: false, messageId: "", channelOwnerId: "" })}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setReportModal({ visible: false, messageId: "", channelOwnerId: "" })}
          />
          <View style={styles.modalSheet}>
            <ThemedText style={styles.modalTitle}>Report message</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Why are you reporting this message?
            </ThemedText>
            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                onPress={() => handleReportSubmit(reason)}
                style={styles.reportOption}
              >
                <ThemedText style={styles.reportOptionText}>{reason}</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </Pressable>
            ))}
            <Pressable
              onPress={() => setReportModal({ visible: false, messageId: "", channelOwnerId: "" })}
              style={styles.modalCancel}
            >
              <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {activeCall && activeCall.status !== "ended" && (
        <ActiveCallModal
          visible
          mode={activeCall.mode}
          callType={activeCall.type}
          callId={activeCall.callId}
          otherUserId={activeCall.otherUserId}
          otherName={activeCall.name}
          onAccepted={() =>
            setActiveCall((prev) => (prev ? { ...prev, status: "connecting" } : prev))
          }
          onClose={() => setActiveCall(null)}
        />
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  safeArea: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    backgroundColor: theme.backgroundSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontWeight: "600", color: theme.text, lineHeight: 20 },
  headerSubtitle: { fontSize: 12, color: theme.success, lineHeight: 16 },
  headerTyping: { fontSize: 12, color: theme.primary, fontStyle: "italic", lineHeight: 16 },
  headerAction: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1, maxWidth: MaxContentWidth, width: "100%", alignSelf: "center" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    backgroundColor: theme.backgroundSecondary,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inputBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: theme.text,
    paddingVertical: 0,
  },
  searchCount: { fontSize: 12, color: theme.textSecondary, fontWeight: "500" },
  searchClear: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  searchNav: { flexDirection: "row", gap: 2 },
  searchNavBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center",     backgroundColor: theme.backgroundElement },
  messageList: { paddingVertical: 8, flexGrow: 1 },
  messageRow: { width: "100%", flexDirection: "column", marginVertical: 4, paddingHorizontal: 12 },
  messageRowOwn: { alignItems: "flex-end" },
  messageRowOther: { alignItems: "flex-start" },
  unreadDivider: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  unreadLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.primary },
  unreadText: { fontSize: 11, fontWeight: "700", color: theme.primary, letterSpacing: 0.8 },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 120, gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "600", color: theme.text },
  emptySubtitle: { fontSize: 14, color: theme.textSecondary, textAlign: "center" },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  retryBtnText: { fontSize: 15, fontWeight: "600" },
  sendingBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: theme.backgroundSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
  },
  sendingText: { fontSize: 12,     color: theme.primary, fontStyle: "italic" },

  // Pinned bar
  pinnedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: theme.backgroundSecondary,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.divider,
  },
  pinnedText: { fontSize: 13,     color: theme.primary, fontWeight: "500" },

  // Context menu
  contextOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  contextBackdrop: { flex: 1, backgroundColor: theme.overlay },
  contextSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.backgroundElement,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
    gap: 4,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.borderLight,
    alignSelf: "center",
    marginBottom: 12,
  },
  reactionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  reactionOption: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  reactionOptionEmoji: { fontSize: 28 },
  contextDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginBottom: 8 },
  contextItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  contextText: { fontSize: 16, color: theme.text },

  // Edit bar
  editBar: {
    backgroundColor: theme.backgroundSecondary,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  editBarContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editInput: {
    flex: 1,
    backgroundColor: theme.backgroundElement,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.text,
  },
  editCancel: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  editSave: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Reply preview
  replyPreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.backgroundSecondary,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  replyBar: { display: "none" },
  replyContent: { flex: 1, gap: 2 },
  replyName: { fontSize: 12, fontWeight: "600", color: theme.primary },
  replyText: { fontSize: 13,     color: theme.textSecondary, lineHeight: 18 },
  replyClose: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },

  // Blocked bar
  blockedBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.error + "1A",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.divider,
  },
  blockedText: { fontSize: 13,     color: theme.error, textAlign: "center", fontWeight: "500" },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: "flex-end",
  },
  modalBackdrop: { flex: 1 },
  modalSheet: {
    backgroundColor: theme.backgroundElement,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    maxHeight: "70%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: theme.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: theme.textSecondary, marginBottom: 16 },
  channelItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  channelItemName: { flex: 1, fontSize: 15, color: theme.text },
  reportOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  reportOptionText: { fontSize: 15, color: theme.text },
  emptyText: { fontSize: 14, color: theme.textSecondary, textAlign: "center", paddingVertical: 20 },
  modalCancel: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalCancelText: { fontSize: 16,     color: theme.primary, fontWeight: "600" },

  // Scroll to bottom FAB
  scrollToBottomBtn: {
    position: "absolute",
    bottom: 8,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.backgroundElement,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
    elevation: 5,
  },

  // Search header
  searchHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.backgroundElement,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
    gap: 6,
  },
  searchCounter: {
    fontSize: 12,
    color: theme.textSecondary,
    minWidth: 40,
    textAlign: "center",
  },

  // More options modal
  moreSheet: {
    backgroundColor: theme.backgroundElement,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 36,
  },
  moreOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  moreOptionText: { fontSize: 16, color: theme.text },
  moreDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 4 },
  });
}
