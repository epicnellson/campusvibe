type ModerationResult = {
  flagged: boolean;
  categories: string[];
};

export async function checkModeration(text: string): Promise<ModerationResult> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) return { flagged: false, categories: [] };

  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: text }),
  });

  if (!response.ok) {
    throw new Error("Moderation service unavailable");
  }

  const data: { results: { flagged: boolean; categories: Record<string, boolean> }[] } =
    await response.json();
  const result = data.results[0];

  if (result.flagged) {
    const flaggedCategories = Object.entries(result.categories)
      .filter(([_, value]) => value)
      .map(([key]) => key);
    return { flagged: true, categories: flaggedCategories };
  }

  return { flagged: false, categories: [] };
}
