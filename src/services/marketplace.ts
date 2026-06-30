import { supabase } from "@/services/supabase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import type { ListingWithSeller } from "@/services/database.types";

export async function fetchListings(): Promise<ListingWithSeller[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from("listings")
      .select("id, title, description, price, category, photos, created_at, user_id")
      .order("created_at", { ascending: false });

    if (error) throw error;
    const listings = (data ?? []) as any[];
    const userIds = [...new Set(listings.map((l: any) => l.user_id).filter(Boolean))];
    const profileMap = await fetchSellerNames(userIds);
    return listings.map((l: any) => ({
      ...l,
      seller: profileMap.get(l.user_id) ?? null,
    })) as unknown as ListingWithSeller[];
  });
}

export type CreateListingData = {
  title: string;
  description: string;
  price: string;
  category: string;
};

export async function createListing(
  data: CreateListingData
): Promise<string> {
  return withRetry(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: listing, error } = await supabase
      .from("listings")
      .insert({
        user_id: user.id,
        title: sanitizeText(data.title),
        description: sanitizeText(data.description),
        price: sanitizeText(data.price),
        category: sanitizeText(data.category),
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "42501" || error.message?.includes("permission denied")) {
        throw new Error("You need a verified student ID to create listings. Please upload your student ID first.");
      }
      throw error;
    }
    return listing.id;
  });
}

export async function updateListingPhotos(
  listingId: string,
  photoUrls: string[]
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from("listings")
      .update({ photos: photoUrls })
      .eq("id", listingId);

    if (error) throw error;
  });
}

async function fetchSellerNames(userIds: string[]): Promise<Map<string, { name: string }>> {
  const map = new Map<string, { name: string }>();
  if (userIds.length === 0) return map;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name")
    .in("id", userIds);
  for (const p of profiles ?? []) {
    map.set(p.id, { name: p.name });
  }
  return map;
}
