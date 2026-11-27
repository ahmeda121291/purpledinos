export const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const playerHref = (name: string) => `/players/${slugify(name)}`;
export const SITE = "https://purpledinos.ca";
export const utm = (path: string, campaign: string) => `${SITE}${path}${path.includes("?") ? "&" : "?"}utm_source=x&utm_medium=social&utm_campaign=${campaign}`;
