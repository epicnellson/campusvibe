import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import * as ImageManipulator from "expo-image-manipulator";

function getStorageErrorMessage(err: unknown): never {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("file too large") || msg.includes("maximum size")) {
    throw new Error("Image must be under 5MB");
  }
  if (msg.includes("file type") || msg.includes("extension")) {
    throw new Error("Please upload a JPG or PNG only");
  }
  throw err;
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

    if (uploadError) getStorageErrorMessage(uploadError);

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

    if (uploadError) getStorageErrorMessage(uploadError);

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

export async function uploadStudentId(
  userId: string,
  uri: string,
  fileSize?: number
): Promise<void> {
  const ext = getExtension(uri.split("/").pop() ?? uri);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error("Only JPG, JPEG, PNG, and PDF files are allowed.");
  }

  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE) {
    throw new Error("File is too large. Maximum size is 5MB.");
  }

  const uploadUri = ext === "pdf" ? uri : await compressImage(uri);
  const filename = `student_id.${ext === "pdf" ? "pdf" : "jpg"}`;
  const mimeType = ext === "pdf" ? "application/pdf" : "image/jpeg";
  const formData = new FormData();
  formData.append("file", {
    uri: uploadUri,
    type: mimeType,
    name: filename,
  } as unknown as Blob);

  const { error: uploadError } = await supabase.storage
    .from("student-id-verification")
    .upload(`${userId}/${filename}`, formData, {
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // verification_status is set to 'pending' automatically via
  // database trigger on_student_id_upload — no client update needed.
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

    if (uploadError) getStorageErrorMessage(uploadError);

    const { data: urlData } = supabase.storage
      .from("listing-photos")
      .getPublicUrl(`${listingId}/${filename}`);

    return urlData.publicUrl;
  });
}
