type ModerationResult = {
  flagged: boolean;
  categories: string[];
};

const MODERATE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/moderate`;

export async function checkModeration(text: string): Promise<ModerationResult> {
  try {
    const res = await fetch(MODERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });

    if (!res.ok) return { flagged: false, categories: [] };

    const data = await res.json();

    if (data.flagged) {
      const flaggedCategories = Object.entries(data.categories)
        .filter(([_, value]: [string, unknown]) => value)
        .map(([key]) => key);
      return { flagged: true, categories: flaggedCategories };
    }

    return { flagged: false, categories: [] };
  } catch {
    return { flagged: false, categories: [] };
  }
}
