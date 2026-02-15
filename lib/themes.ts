export const themes = [
  { id: "light", name: "Light", group: "Default", isDark: false },
  { id: "dark", name: "Dark", group: "Default", isDark: true },
  { id: "gruvbox-light", name: "Light", group: "Gruvbox", isDark: false },
  { id: "gruvbox-dark", name: "Dark", group: "Gruvbox", isDark: true },
  { id: "nord-light", name: "Snow Storm", group: "Nord", isDark: false },
  { id: "nord-dark", name: "Polar Night", group: "Nord", isDark: true },
  { id: "rose-pine-light", name: "Dawn", group: "Rosé Pine", isDark: false },
  { id: "rose-pine-dark", name: "Moon", group: "Rosé Pine", isDark: true },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export const themeIds = themes.map((t) => t.id);

const darkIds: Set<string> = new Set(themes.filter((t) => t.isDark).map((t) => t.id));

export function isDarkTheme(id: string): boolean {
  return darkIds.has(id);
}

/** Themes grouped by group name, preserving insertion order. */
export const themeGroups = themes.reduce<
  { group: string; items: (typeof themes)[number][] }[]
>((acc, t) => {
  let g = acc.find((x) => x.group === t.group);
  if (!g) {
    g = { group: t.group, items: [] };
    acc.push(g);
  }
  g.items.push(t);
  return acc;
}, []);
