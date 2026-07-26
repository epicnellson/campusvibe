import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";
import { withRetry } from "@/services/retry";
import { sanitizeText } from "@/services/sanitize";
import type { ListingWithSeller } from "@/services/database.types";

export async function fetchListings(): Promise<ListingWithSeller[]> {
  return withRetry(async () => {
    const listings = await db_ops.query("listings", {
      orderBy: [{ field: "created_at", direction: "desc" }],
    });

    const userIds = [...new Set(listings.map((l) => l.user_id).filter(Boolean))];
    const profileMap = await fetchSellerNames(userIds);

    return listings.map((l) => ({
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
    const user = getCurrentUser();

    const listingId = await db_ops.add("listings", {
      user_id: user.uid,
      title: sanitizeText(data.title),
      description: sanitizeText(data.description),
      price: sanitizeText(data.price),
      category: sanitizeText(data.category),
      photos: [],
    });

    return listingId;
  });
}

export async function updateListingPhotos(
  listingId: string,
  photoUrls: string[]
): Promise<void> {
  return withRetry(async () => {
    await db_ops.update("listings", listingId, { photos: photoUrls });
  });
}

async function fetchSellerNames(userIds: string[]): Promise<Map<string, { name: string }>> {
  const map = new Map<string, { name: string }>();
  if (userIds.length === 0) return map;

  const profiles = await Promise.all(userIds.map((id) => db_ops.get("profiles", id)));
  for (const p of profiles.filter(Boolean)) {
    map.set(p!.id, { name: p!.name });
  }
  return map;
}
