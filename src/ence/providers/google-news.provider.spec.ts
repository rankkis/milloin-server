import { parseNewsFeed } from './google-news.provider';

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>ENCE</title>
<item>
  <title>ENCE beat Sashi to reach playoffs - Dust2.us</title>
  <link>https://news.google.com/rss/articles/abc</link>
  <pubDate>Wed, 07 Oct 2026 18:20:00 GMT</pubDate>
  <source url="https://www.dust2.us">Dust2.us</source>
</item>
<item>
  <title>ENCE sign a new coach - HLTV.org</title>
  <link>https://news.google.com/rss/articles/def</link>
  <pubDate>Thu, 08 Oct 2026 09:12:00 GMT</pubDate>
  <source url="https://www.hltv.org">HLTV.org</source>
</item>
<item><title>No date</title><link>https://example.com</link></item>
</channel></rss>`;

describe('parseNewsFeed', () => {
  it('reads items latest first, without the publisher in the title', async () => {
    expect(await parseNewsFeed(feed)).toEqual([
      {
        title: 'ENCE sign a new coach',
        source: 'HLTV.org',
        url: 'https://news.google.com/rss/articles/def',
        publishedAt: '2026-10-08T09:12:00.000Z',
      },
      {
        title: 'ENCE beat Sashi to reach playoffs',
        source: 'Dust2.us',
        url: 'https://news.google.com/rss/articles/abc',
        publishedAt: '2026-10-07T18:20:00.000Z',
      },
    ]);
  });
});
