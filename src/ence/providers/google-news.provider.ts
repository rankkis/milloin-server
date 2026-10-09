import { Injectable } from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { INewsProvider, NewsItem } from '../interfaces/team-data.interface';

/**
 * News search for ENCE's Counter-Strike team. "ENCE" alone also finds the
 * Spanish pulp company, so the search asks for CS too.
 */
const QUERY = 'ENCE (CS2 OR "Counter-Strike") when:30d';
const FEED_URL = `https://news.google.com/rss/search?${new URLSearchParams({
  q: QUERY,
  hl: 'en-US',
  gl: 'US',
  ceid: 'US:en',
})}`;
const TIMEOUT_MS = 10_000;

interface RssItem {
  title?: string[];
  link?: string[];
  pubDate?: string[];
  source?: (string | { _: string })[];
}

/** ENCE news from the Google News RSS search feed, latest first */
@Injectable()
export class GoogleNewsProvider implements INewsProvider {
  readonly name = 'Google News';

  async fetchNews(): Promise<NewsItem[]> {
    const response = await fetch(FEED_URL, {
      headers: { Accept: 'application/rss+xml, application/xml' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Google News answered ${response.status}`);
    }
    return parseNewsFeed(await response.text());
  }
}

export async function parseNewsFeed(xml: string): Promise<NewsItem[]> {
  const feed = await parseStringPromise(xml);
  const items: RssItem[] = feed?.rss?.channel?.[0]?.item ?? [];
  return items
    .map((item): NewsItem | undefined => {
      const rawTitle = item.title?.[0]?.trim();
      const url = item.link?.[0]?.trim();
      const published = Date.parse(item.pubDate?.[0] ?? '');
      if (!rawTitle || !url || Number.isNaN(published)) return undefined;
      const sourceEntry = item.source?.[0];
      const source =
        typeof sourceEntry === 'string' ? sourceEntry : sourceEntry?._;
      // Google appends " - Publisher" to every title
      const suffix = source ? ` - ${source}` : '';
      const title =
        suffix && rawTitle.endsWith(suffix)
          ? rawTitle.slice(0, -suffix.length)
          : rawTitle;
      return {
        title,
        source: source?.trim() || undefined,
        url,
        publishedAt: new Date(published).toISOString(),
      };
    })
    .filter((item): item is NewsItem => !!item)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
