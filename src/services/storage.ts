import { supabase } from "@/services/supabase";
import { db_ops } from "@/services/db";
import { withRetry } from "@/services/retry";
import * as ImageManipulator from "expo-image-manipulator";
import { Platform } from "react-native";

export type UploadResult = { success: boolean; url?: string; error?: string };

function formatStorageError(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err);
  console.error("[storage] full error:", err);
  if (msg.includes("does not exist") || msg.includes("not found") || msg.includes("bucket")) {
    return "Storage bucket is not set up. Ask the admin to create the 'student-id-verification' bucket in Supabase.";
  }
  if (msg.includes("file too large") || msg.includes("maximum size") || msg.includes("413")) {
    return "File is too large. Maximum size is 5MB.";
  }
  if (msg.includes("file type") || msg.includes("extension") || msg.includes("415")) {
    return "Please upload a JPG, PNG, or PDF only.";
  }
  if (msg.includes("policy") || msg.includes("permission") || msg.includes("403") || msg.includes("401")) {
    return "Permission denied. You may need to log out and log back in.";
  }
  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch")) {
    return "Network error. Check your internet connection and try again.";
  }
  return msg || "An unknown error occurred. Please try again.";
}

async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

async function uploadToSupabase(
  bucket: string,
  path: string,
  uri: string,
  contentType: string = "image/jpeg"
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { contentType, upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Failed to get public URL");
  return data.publicUrl;
}

export async function uploadProfilePhoto(
  userId: string,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    return await uploadToSupabase("profile-photos", `${userId}/avatar.jpg`, compressed);
  });
}

export async function uploadEventImage(
  eventId: string,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    return await uploadToSupabase("profile-photos", `event-images/${eventId}/event.jpg`, compressed);
  });
}

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function mimeToExt(mime?: string): string | null {
  if (!mime) return null;
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
  };
  return map[mime.toLowerCase()] ?? null;
}

export type StudentDocumentType = "student_id" | "enrollment_letter" | "class_schedule" | "library_card" | "other";

export async function uploadStudentId(
  userId: string,
  uri: string,
  fileSize?: number,
  mimeType?: string,
  documentType?: StudentDocumentType
): Promise<UploadResult> {
  try {
    const rawExt = mimeToExt(mimeType) || getExtension(uri.split("/").pop() ?? uri) || "";
    const ext = ALLOWED_EXTENSIONS.includes(rawExt) ? rawExt : "jpg";

    if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
      return { success: false, error: "File is too large. Maximum size is 5MB." };
    }

    const isPdf = ext === "pdf";
    const uploadUri = isPdf ? uri : await compressImage(uri);
    const filePath = `${userId}/student_id.${isPdf ? "pdf" : "jpg"}`;
    const uploadMime = isPdf ? "application/pdf" : "image/jpeg";

    const response = await fetch(uploadUri);
    const blob = await response.blob();

    const { error: uploadError } = await supabase.storage
      .from("student-id-verification")
      .upload(filePath, blob, { contentType: uploadMime, upsert: true });

    if (uploadError) throw new Error(uploadError.message);

    if (documentType) {
      try {
        await db_ops.update("profiles", userId, { student_document_type: documentType });
      } catch {}
    }

    return { success: true };
  } catch (err) {
    console.error("[uploadStudentId] unexpected error:", err);
    return { success: false, error: formatStorageError(err) };
  }
}

export async function uploadPostImage(
  postId: string,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    try {
      return await uploadToSupabase("post-images", `${postId}/photo.jpg`, compressed);
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err);
      if (msg.includes("bucket") || msg.includes("not found")) return "";
      throw new Error(formatStorageError(err));
    }
  });
}

export async function uploadListingPhoto(
  listingId: string,
  index: number,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    return await uploadToSupabase("listing-photos", `${listingId}/photo_${index}.jpg`, compressed);
  });
}

export async function uploadChatImage(
  channelId: string,
  fileName: string,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    return await uploadToSupabase("post-images", `chat/${channelId}/${fileName}`, compressed);
  });
}

export async function uploadChatFile(
  channelId: string,
  fileName: string,
  uri: string,
  contentType: string = "application/octet-stream"
): Promise<string> {
  return withRetry(async () => {
    return await uploadToSupabase("post-images", `chat/${channelId}/${fileName}`, uri, contentType);
  });
}

export function resolveImageUrl(
  path: string | null | undefined,
  bucket: string = "event-images"
): string | null {
  if (!path) return null;
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  return null;
}

export async function uploadChatVoice(
  channelId: string,
  fileName: string,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    return await uploadToSupabase("post-images", `chat/${channelId}/voice/${fileName}`, uri, "audio/m4a");
  });
}
