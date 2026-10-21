export function niceDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
export function shortId(id: string) { return id.slice(0, 8).toUpperCase(); }
export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase() || "").join("") || "?";
}
