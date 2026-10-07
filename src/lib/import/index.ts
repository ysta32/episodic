import type { ImportSource } from "../types";
import type { Importer } from "./types";

export interface ImporterInfo {
  label: string;
  accept: string;
  help: string;
  load: () => Promise<Importer>;
}

export const IMPORTERS: Record<ImportSource, ImporterInfo> = {
  tvtime: {
    label: "TV Time",
    accept: ".csv,.zip,.json",
    help: "Request your data export from TV Time (Settings > Privacy > Export my data) and upload the files or zip you receive by email.",
    load: async () => (await import("./tvtime")).importTvTime,
  },
  trakt: {
    label: "Trakt",
    accept: ".json,.zip,.csv",
    help: "On trakt.tv open Settings > Data and export your data, then upload the downloaded file(s).",
    load: async () => (await import("./trakt")).importTrakt,
  },
  simkl: {
    label: "Simkl",
    accept: ".json,.csv,.zip",
    help: "In Simkl open Settings > Data Export and download your list as JSON or CSV, then upload it here.",
    load: async () => (await import("./simkl")).importSimkl,
  },
  letterboxd: {
    label: "Letterboxd",
    accept: ".csv,.zip",
    help: "On letterboxd.com go to Settings > Data > Export your data and upload the zip, or the watched, diary, ratings and watchlist CSVs.",
    load: async () => (await import("./letterboxd")).importLetterboxd,
  },
  imdb: {
    label: "IMDb",
    accept: ".csv",
    help: "On IMDb open your Ratings or Watchlist page, choose Export from the three-dot menu, and upload the CSV.",
    load: async () => (await import("./imdb")).importImdb,
  },
  csv: {
    label: "Generic CSV",
    accept: ".csv",
    help: "Upload any CSV with a title or name column. Optional columns: type, year, imdb, tmdb, tvdb, season, episode, watched_at, rating, status.",
    load: async () => (await import("./csv")).importCsv,
  },
  episodic: {
    label: "Episodic backup",
    accept: ".json,.zip",
    help: "Upload a backup file previously exported from Episodic (Settings > Export).",
    load: async () => (await import("./episodic-backup")).importEpisodicBackup,
  },
};
