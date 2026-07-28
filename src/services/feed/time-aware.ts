import type { ContentCategory } from "./types";

export type TimeOfDayPhase = "morning" | "afternoon" | "evening" | "latenight" | "weekend";

export type PhaseWeights = {
  categoryBoost: Partial<Record<ContentCategory, number>>;
  campusBoost: number;
  externalBoost: number;
  confessionBoost: number;
  explorationBoost: number;
};

const PHASE_CONFIGS: Record<TimeOfDayPhase, PhaseWeights> = {
  morning: {
    categoryBoost: {
      study: 0.3,
      news: 0.25,
      events: 0.2,
      career: 0.15,
      academic: 0.15,
      lifestyle: 0.1,
    },
    campusBoost: 0.15,
    externalBoost: -0.05,
    confessionBoost: -0.1,
    explorationBoost: 0.05,
  },
  afternoon: {
    categoryBoost: {
      academic: 0.2,
      career: 0.15,
      technology: 0.15,
      sports: 0.1,
      events: 0.1,
    },
    campusBoost: 0.1,
    externalBoost: 0,
    confessionBoost: 0,
    explorationBoost: 0.1,
  },
  evening: {
    categoryBoost: {
      memes: 0.25,
      sports: 0.2,
      gaming: 0.15,
      music: 0.15,
      social: 0.1,
    },
    campusBoost: 0.05,
    externalBoost: 0.1,
    confessionBoost: 0.1,
    explorationBoost: 0.05,
  },
  latenight: {
    categoryBoost: {
      confessions: 0.3,
      memes: 0.2,
      music: 0.15,
      career: 0.1,
      social: 0.1,
    },
    campusBoost: 0.05,
    externalBoost: 0.05,
    confessionBoost: 0.25,
    explorationBoost: 0.15,
  },
  weekend: {
    categoryBoost: {
      marketplace: 0.2,
      events: 0.2,
      lifestyle: 0.15,
      social: 0.15,
      memes: 0.1,
      sports: 0.1,
    },
    campusBoost: 0.1,
    externalBoost: 0.05,
    confessionBoost: 0.1,
    explorationBoost: 0.1,
  },
};

export function getCurrentPhase(): TimeOfDayPhase {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) return "weekend";
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "latenight";
}

export function getPhaseWeights(phase?: TimeOfDayPhase): PhaseWeights {
  return PHASE_CONFIGS[phase ?? getCurrentPhase()];
}

export function computeSessionFitScore(category: ContentCategory, phase?: TimeOfDayPhase): number {
  const weights = getPhaseWeights(phase);
  const boost = weights.categoryBoost[category] ?? 0;
  return 0.5 + boost;
}

export function getCampusBoost(phase?: TimeOfDayPhase): number {
  return getPhaseWeights(phase).campusBoost;
}

export function getExternalBoost(phase?: TimeOfDayPhase): number {
  return getPhaseWeights(phase).externalBoost;
}

export function getConfessionBoost(phase?: TimeOfDayPhase): number {
  return getPhaseWeights(phase).confessionBoost;
}

export function getExplorationBoost(phase?: TimeOfDayPhase): number {
  return getPhaseWeights(phase).explorationBoost;
}
