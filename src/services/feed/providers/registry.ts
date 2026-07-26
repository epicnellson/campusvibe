import type { IFeedProvider, HealthStatus, RateBudget } from "./types";

export class ProviderRegistry {
  private providers = new Map<string, IFeedProvider>();
  private healthStates = new Map<string, HealthStatus>();
  private budgets = new Map<string, RateBudget>();

  register(provider: IFeedProvider): void {
    this.providers.set(provider.id, provider);
    this.healthStates.set(provider.id, {
      state: "healthy",
      consecutiveFailures: 0,
      lastSuccess: null,
      lastFailure: null,
      cooldownUntil: null,
    });
    this.budgets.set(provider.id, provider.getBudget());
  }

  unregister(id: string): void {
    this.providers.delete(id);
    this.healthStates.delete(id);
    this.budgets.delete(id);
  }

  getById(id: string): IFeedProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): IFeedProvider[] {
    return [...this.providers.values()];
  }

  getHealthy(): IFeedProvider[] {
    const now = Date.now();
    return this.getAll().filter((p) => {
      const h = this.healthStates.get(p.id);
      if (!h) return true;
      if (h.state === "broken") {
        if (h.cooldownUntil && now >= h.cooldownUntil.getTime()) return true;
        return false;
      }
      return true;
    });
  }

  getWithinBudget(): IFeedProvider[] {
    return this.getHealthy().filter((p) => {
      const b = this.budgets.get(p.id);
      if (!b) return true;
      return !b.isExhausted;
    });
  }

  updateHealth(id: string, success: boolean): void {
    const h = this.healthStates.get(id);
    if (!h) return;

    if (success) {
      h.consecutiveFailures = 0;
      h.state = "healthy";
      h.lastSuccess = new Date();
    } else {
      h.consecutiveFailures++;
      h.lastFailure = new Date();
      if (h.consecutiveFailures >= 3) {
        h.state = "broken";
        h.cooldownUntil = new Date(Date.now() + 60_000);
      } else if (h.consecutiveFailures >= 1) {
        h.state = "degraded";
      }
    }

    this.healthStates.set(id, h);
  }

  recordBudgetConsumption(id: string, units: number): void {
    const b = this.budgets.get(id);
    if (!b) return;
    b.used += units;
    if (b.used >= b.dailyLimit) b.isExhausted = true;
    this.budgets.set(id, { ...b });
  }

  getHealth(id: string): HealthStatus | undefined {
    return this.healthStates.get(id);
  }

  resetAll(): void {
    for (const [id, h] of this.healthStates) {
      if (h.state === "broken") continue;
      this.healthStates.set(id, {
        ...h,
        state: "healthy",
        consecutiveFailures: 0,
      });
    }
  }

  resetBudgets(): void {
    for (const [id, b] of this.budgets) {
      this.budgets.set(id, { ...b, used: 0, isExhausted: false });
    }
  }
}
