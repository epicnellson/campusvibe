export type NotificationPreferences = {
  likes: boolean;
  messages: boolean;
  new_events: boolean;
  popular_confessions: boolean;
  follows: boolean;
  comments: boolean;
  reposts: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  likes: true,
  messages: true,
  new_events: true,
  popular_confessions: true,
  follows: true,
  comments: true,
  reposts: true,
};

export type Profile = {
  id: string;
  email: string;
  email_domain: string;
  name: string;
  department: string;
  year: string;
  avatar_url: string | null;
  notification_preferences: NotificationPreferences;
  is_admin: boolean;
  banned: boolean;
  verification_status: "pending" | "approved" | "rejected" | null;
  student_document_type: "student_id" | "enrollment_letter" | "class_schedule" | "library_card" | "other" | null;
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  content_id: string;
  content_type: "post" | "confession" | "listing" | "message" | "user";
  reason: string;
  reporter_id: string;
  target_user_id?: string;
  created_at: string;
};

export type Post = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Like = {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
};

export type PostWithProfile = Post & {
  profiles: Pick<Profile, "name" | "department" | "avatar_url"> | null;
  likes: Pick<Like, "id" | "user_id">[];
};

export type Confession = {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type ConfessionLike = {
  id: string;
  confession_id: string;
  user_id: string;
  created_at: string;
};

export type ConfessionWithLikes = Confession & {
  confession_likes: Pick<ConfessionLike, "id" | "user_id">[];
};

export type Event = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  image_url: string | null;
  created_at: string;
};

export type EventRSVP = {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
};

export type EventWithRSVPs = Event & {
  creator: Pick<Profile, "name"> | null;
  event_rsvps: Pick<EventRSVP, "id" | "user_id">[];
};

export type Channel = {
  id: string;
  name: string;
  type: "general" | "department" | "hostel" | "dm";
  department: string | null;
  created_at: string;
};

export type ChannelMember = {
  id: string;
  channel_id: string;
  user_id: string;
  joined_at: string;
};

export type MessageType = "text" | "image" | "file" | "view_once" | "voice";

export type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  client_id?: string;
  pending?: boolean;
  type?: MessageType;
  media_url?: string;
  file_name?: string;
  file_size?: number;
  viewed?: boolean;
  reactions?: Record<string, string>;
  reply_to?: string;
  edited?: boolean;
  edited_at?: string;
  seen_by?: string[];
  voice_url?: string;
  voice_duration?: number;
  created_at: string;
};

export type MessageWithSender = Message & {
  sender: Pick<Profile, "name" | "avatar_url"> | null;
  replyToMessage?: MessageWithSender;
};

export type Listing = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  price: string;
  category: "Textbooks" | "Electronics" | "Clothing" | "Other";
  photos: string[];
  created_at: string;
};

export type ListingWithSeller = Listing & {
  seller: Pick<Profile, "name"> | null;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type CommentWithProfile = Comment & {
  profiles: Pick<Profile, "name" | "department"> | null;
};

export type AdminAction = {
  id: string;
  admin_email: string;
  action: "approved" | "rejected";
  target_user_id: string;
  created_at: string;
};

export type Repost = {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
};

export type Reaction = {
  id: string;
  user_id: string;
  post_id: string;
  emoji: string;
  created_at: string;
};

export type BlockedUser = {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

export type PinnedMessage = {
  id: string;
  channel_id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
};

export type OnlineStatus = {
  last_seen: string;
  userId?: string;
};
