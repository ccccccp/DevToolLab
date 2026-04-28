const AI_COOLDOWN_MS = 60_000;
const aiUnavailableUntil = new Map<string, number>();

export function makeAiCooldownKey(parts: { provider: string; baseUrl: string; model: string }) {
  return [parts.provider, parts.baseUrl, parts.model].join("|");
}

export function isAiCoolingDown(key: string) {
  return (aiUnavailableUntil.get(key) || 0) > Date.now();
}

export function markAiCoolingDown(key: string) {
  aiUnavailableUntil.set(key, Date.now() + AI_COOLDOWN_MS);
}
