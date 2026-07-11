import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";

export type UploadResult = { success: boolean; url?: string; error?: string };

function formatStorageError(err: unknown): string {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err);
  console.error("[storage] full error:", err);
  if (msg.includes("does not exist") || msg.includes("not found") || msg.includes("bucket")) {
    return "Storage not configured. Please contact support.";
  }
  if (msg.includes("file too large") || msg.includes("maximum size")) {
    return "Image must be under 5MB.";
  }
  if (msg.includes("file type") || msg.includes("extension")) {
    return "Please upload a JPG, PNG, or PDF only.";
  }
  return msg;
}

async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function uploadProfilePhoto(
  userId: string,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    const formData = new FormData();
    const filename = `avatar.jpg`;
    formData.append("file", {
      uri: compressed,
      type: "image/jpeg",
      name: filename,
    } as unknown as Blob);

    const { error: uploadError } = await supabase.storage
      .from("profile-photos")
      .upload(`${userId}/${filename}`, formData, {
        upsert: true,
      });

    if (uploadError) throw new Error(formatStorageError(uploadError));

    const { data: urlData } = supabase.storage
      .from("profile-photos")
      .getPublicUrl(`${userId}/${filename}`);

    return urlData.publicUrl;
  });
}

export async function uploadEventImage(
  eventId: string,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    const formData = new FormData();
    const filename = `event.jpg`;
    formData.append("file", {
      uri: compressed,
      type: "image/jpeg",
      name: filename,
    } as unknown as Blob);

    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(`${eventId}/${filename}`, formData, {
        upsert: true,
      });

    if (uploadError) throw new Error(formatStorageError(uploadError));

    const { data: urlData } = supabase.storage
      .from("event-images")
      .getPublicUrl(`${eventId}/${filename}`);

    return urlData.publicUrl;
  });
}

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

export async function uploadStudentId(
  userId: string,
  uri: string,
  fileSize?: number,
  mimeType?: string
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

    const file = new File(uploadUri);

    const { error: uploadError } = await supabase.storage
      .from("student-id-verification")
      .upload(filePath, file, {
        contentType: uploadMime,
        upsert: true,
      });

    if (uploadError) {
      console.error("[uploadStudentId] upload error details:", JSON.stringify(uploadError));
      return { success: false, error: formatStorageError(uploadError) };
    }

    // Notify the server that this user has uploaded their ID
    try {
      await supabase.rpc("set_my_verification_pending");
    } catch {} // non-critical

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
    const formData = new FormData();
    const filename = `photo.jpg`;
    formData.append("file", {
      uri: compressed,
      type: "image/jpeg",
      name: filename,
    } as unknown as Blob);

    const fileName = `${postId}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, formData, {
        upsert: true,
      });

    if (uploadError) {
      if (uploadError.message?.includes("bucket")) {
        // bucket may not exist; silently skip
        return "";
      }
      throw new Error(formatStorageError(uploadError));
    }

    const { data: urlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  });
}

export async function uploadListingPhoto(
  listingId: string,
  index: number,
  uri: string
): Promise<string> {
  return withRetry(async () => {
    const compressed = await compressImage(uri);
    const formData = new FormData();
    const filename = `photo_${index}.jpg`;
    formData.append("file", {
      uri: compressed,
      type: "image/jpeg",
      name: filename,
    } as unknown as Blob);

    const { error: uploadError } = await supabase.storage
      .from("listing-photos")
      .upload(`${listingId}/${filename}`, formData, {
        upsert: true,
      });

    if (uploadError) throw new Error(formatStorageError(uploadError));

    const { data: urlData } = supabase.storage
      .from("listing-photos")
      .getPublicUrl(`${listingId}/${filename}`);

    return urlData.publicUrl;
  });
}
