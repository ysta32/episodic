# Episodic Scrobbler (MV3)

In Chrome/Chromium, open `chrome://extensions`, enable Developer mode, choose
**Load unpacked**, and select this `extension` directory. Reload existing streaming
tabs after installation. No build or dependencies are needed.

Playback on Netflix, Hulu, and Max is sampled while a video is playing. At 90%
progress, the extension stores the title and episode metadata in local extension
storage and opens an inactive tab at:

`https://episodic-app.vercel.app/app/scrobble?title=…&season=…&episode=…&kind=episode&progress=…`

Movies omit season and episode. The app must implement this receiver before watch
recording works. Opening a tab is not an acknowledgement: failed page loads or an
unavailable receiver are not detected. Receiver tabs stay open so failures can be
inspected and reloaded. The extension does not read or write the app's database.

The popup saves the auto-scrobble toggle and app origin (HTTPS, or local HTTP on
ports 4700–4799). Turning it off prevents collection and dispatch. **Sync now**
retries queued items; it does not mark partially watched videos complete. Tab
creation failures retain pending items, including across browser restarts. A new
qualifying item also triggers a retry. Up to 500 pending items are retained; a full
queue rejects new items. The latest 100 dispatched titles/episodes are retained
for duplicate suppression, and the popup displays the latest 20 pending/recent
entries. Rewatches within that history are suppressed.

Detectors use player title/subtitle elements, Open Graph metadata where available,
and document titles such as `Show: S1 E3`. Live/unknown durations and incomplete
episode identifiers are ignored. Streaming DOMs vary by locale and change over
time; these best-effort detectors need checking against real players. Known ad
markers are ignored; embedded ads and seeking can affect progress. No remote code,
analytics, account credentials, app host permission, or `tabs` permission is used.
Only `storage` and the four streaming host families in the manifest are allowed.

Run the focused tests from the repository root:

```sh
npx vitest run extension/test/detectors.test.ts --config /dev/null
```
