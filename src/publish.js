import fs from 'node:fs';
import crypto from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';

const config = JSON.parse(fs.readFileSync('config/feeds.json', 'utf8'));
const stateFile = '.state/published.json';
fs.mkdirSync('.state', { recursive: true });
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const parser = new XMLParser({ ignoreAttributes: false });
const live = process.env.PUBLISH_ENABLED === 'true';
const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const plain = value => typeof value === 'string' ? value : value?.['#text'] || '';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

for (const feed of config.feeds || []) {
  if (!feed.enabled || !feed.page_id || !feed.url) continue;
  try {
    const url = new URL(feed.url);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Invalid feed protocol');
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'NELVIS-SOCIAL-RSS/0.1' } });
    if (!response.ok) throw new Error('RSS HTTP ' + response.status);
    const xml = parser.parse(await response.text());
    const entries = list(xml.rss?.channel?.item || xml.feed?.entry);
    for (const entry of entries.slice(0, 10)) {
      const title = plain(entry.title).trim();
      const link = plain(entry.link?.['@_href'] || entry.link || entry.guid).trim();
      if (!title || !/^https?:\/\//.test(link)) continue;
      const id = digest(feed.page_id + ':' + link);
      if (state[id]) continue;
      const description = plain(entry.description || entry.summary).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 250);
      const message = [title, description, link].filter(Boolean).join('\n\n');
      if (!live) { console.log('[DRY RUN]', feed.name, message); break; }
      if (!token) throw new Error('Missing FACEBOOK_PAGE_ACCESS_TOKEN');
      const body = new URLSearchParams({ message, access_token: token });
      const posted = await fetch('https://graph.facebook.com/v24.0/' + encodeURIComponent(feed.page_id) + '/feed', { method: 'POST', body, signal: AbortSignal.timeout(20000) });
      const result = await posted.json();
      if (!posted.ok || result.error) throw new Error('Meta API: ' + JSON.stringify(result.error || result));
      state[id] = { at: new Date().toISOString(), post_id: result.id, source: feed.name };
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
      console.log('Published', feed.name, result.id);
      break;
    }
  } catch (error) { console.error(feed.name, error.message); process.exitCode = 1; }
}
