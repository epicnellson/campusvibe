export type NotificationPreferences = {
  likes: boolean;
  messages: boolean;
  new_events: boolean;
  popular_confessions: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  likes: true,
  messages: true,
  new_events: true,
  popular_confessions: true,
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
  created_at: string;
  updated_at: string;
};

export type Report = {
  id: string;
  content_id: string;
  content_type: "post" | "confession" | "listing";
  reason: string;
  reporter_id: string;
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

export type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type MessageWithSender = Message & {
  sender: Pick<Profile, "name"> | null;
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
