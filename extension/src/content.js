(async () => {
  const { detectNetflix, detectHulu, detectMax } = await import(chrome.runtime.getURL("src/detectors.js"));
  const host = location.hostname;
  const detector = /(^|\.)netflix\.com$/.test(host) ? detectNetflix :
    /(^|\.)hulu\.com$/.test(host) ? detectHulu : detectMax;
  let enabled = (await chrome.storage.local.get({ enabled: true })).enabled;
  let sending = false;
  let lastKey = "";
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      lastKey = "";
    }
  });
  async function sample() {
    if (!enabled || sending) return;
    const video = [...document.querySelectorAll("video")].find((item) => !item.paused && item.readyState >= 2);
    if (!video) return;
    if (document.querySelector(".ad-showing, [data-testid=ad-player], [data-uia=ads-advertisement]")) return;
    const scrobble = detector(document, video);
    if (!scrobble || scrobble.progress < 0.9) return;
    const key = JSON.stringify([scrobble.kind, scrobble.title, scrobble.season, scrobble.episode]);
    if (key === lastKey) return;
    sending = true;
    try {
      const response = await chrome.runtime.sendMessage({ type: "scrobble", scrobble });
      if (response?.ok) lastKey = key;
    } catch (error) {
      console.warn("Episodic could not queue playback", error);
    } finally {
      sending = false;
    }
  }
  document.addEventListener("timeupdate", sample, true);
  setInterval(sample, 5000);
})().catch((error) => console.warn("Episodic could not initialize", error));
