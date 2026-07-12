import { supabase } from "@/services/supabase";

type ModerationResult = {
  flagged: boolean;
  categories: string[];
};

export async function checkModeration(text: string): Promise<ModerationResult> {
  const { data, error } = await supabase.functions.invoke("moderate", {
    body: { content: text },
  });

  if (error || !data) {
    return { flagged: false, categories: [] };
  }

  if (data.flagged) {
    const flaggedCategories = Object.entries(data.categories)
      .filter(([_, value]: [string, unknown]) => value)
      .map(([key]) => key);
    return { flagged: true, categories: flaggedCategories };
  }

  return { flagged: false, categories: [] };
}
