export type ZoneIssue = 'healthy' | 'redness' | 'texture' | 'tan';

export function zoneTip(zoneLabel: string, issue: ZoneIssue): string | null {
  if (issue === 'redness') {
    return `${zoneLabel} shows more redness — a gentle, fragrance-free cleanser and avoiding harsh scrubbing there can help.`;
  }
  if (issue === 'texture') {
    return `${zoneLabel} shows uneven texture — regular gentle exfoliation and consistent moisturizing may smooth it over time.`;
  }
  if (issue === 'tan') {
    return `${zoneLabel} looks more tanned than the rest of your face — daily SPF and reapplying through the day can even this out.`;
  }
  return null;
}

export function ageTip(age: number | null): string | null {
  if (age === null) return null;
  if (age < 20) {
    return 'At this age, a gentle salicylic-acid cleanser can help manage breakouts without over-drying your skin.';
  }
  if (age <= 35) {
    return 'This is a great age to lock in a daily SPF habit — consistent sunscreen now prevents most visible aging later.';
  }
  if (age <= 50) {
    return 'Adding a morning antioxidant serum (like vitamin C) can help support skin resilience as natural collagen production slows.';
  }
  return "Richer, ceramide-based moisturizers can help since skin's natural barrier thins with age — pair with gentle, fragrance-free products.";
}
