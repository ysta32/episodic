/** @typedef {{kind: "episode" | "movie", title: string, season?: number, episode?: number, progress: number}} Scrobble */
/** @typedef {{currentTime: number, duration: number}} Playback */

const episodePattern = /\bS(?:eason)?\s*(\d+)\s*[:·,\-]?\s*E(?:pisode|p)?\.?\s*(\d+)\b/i;
const incompleteEpisodePattern = /\b(?:season\s*\d+|episode\s*\d+|S\d+\s*[:\-]?\s*E)/i;

/** @param {Document} doc @param {string[]} selectors */
function firstText(doc, selectors) {
  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (!node) continue;
    const walker = doc.createTreeWalker(node, 4);
    const parts = [];
    while (walker.nextNode()) parts.push(walker.currentNode.textContent || "");
    const text = (node.getAttribute("content") || parts.join(" ")).replace(/\s+/g, " ").trim();
    if (text) return text;
  }
  return "";
}

/** @param {string} title */
function cleanTitle(title) {
  return title.replace(/\s*(?:\||[-–—])\s*(?:Netflix|Hulu|Max|HBO Max)(?:\s*.*)?$/i, "")
    .replace(/^Watch\s+/i, "").trim();
}

/**
 * @param {Document} doc
 * @param {Playback | null} video
 * @param {string[]} titles
 * @param {string[]} metadata
 * @returns {Scrobble | null}
 */
function detect(doc, video, titles, metadata) {
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0 ||
      !Number.isFinite(video.currentTime)) return null;
  const title = cleanTitle(firstText(doc, titles) || doc.title);
  if (!title || /^(?:Netflix|Hulu|Max|HBO Max|Home|Watch)$/i.test(title)) return null;
  const details = firstText(doc, metadata);
  const match = title.match(episodePattern) || details.match(episodePattern) || doc.title.match(episodePattern);
  const progress = Math.max(0, Math.min(1, video.currentTime / video.duration));
  if (match) {
    const season = Number(match[1]);
    const episode = Number(match[2]);
    const showTitle = title.split(episodePattern)[0].replace(/[\s:|·–—-]+$/, "").trim();
    if (!showTitle || !Number.isSafeInteger(season) || !Number.isSafeInteger(episode) || episode < 1) return null;
    return { kind: "episode", title: showTitle, season, episode, progress };
  }
  if (incompleteEpisodePattern.test(`${title} ${details} ${doc.title}`)) return null;
  return { kind: "movie", title, progress };
}

/** @param {Document} doc @param {Playback | null} video @returns {Scrobble | null} */
export function detectNetflix(doc, video) {
  return detect(doc, video,
    ["[data-uia=video-title] h4", "[data-uia=video-title]"],
    ["[data-uia=video-title]", "[data-uia=episode-title]"]);
}

/** @param {Document} doc @param {Playback | null} video @returns {Scrobble | null} */
export function detectHulu(doc, video) {
  return detect(doc, video,
    ["[data-testid=player-title]", ".PlayerMetadata__title", ".player-title", "meta[property='og:title']"],
    ["[data-testid=player-subtitle]", ".PlayerMetadata__subtitle", ".player-subtitle"]);
}

/** @param {Document} doc @param {Playback | null} video @returns {Scrobble | null} */
export function detectMax(doc, video) {
  return detect(doc, video,
    ["[data-testid=player-title]", "[data-testid=video-title]", "[data-testid=title]", "meta[property='og:title']"],
    ["[data-testid=player-subtitle]", "[data-testid=episode-title]", "[data-testid=subtitle]"]);
}
