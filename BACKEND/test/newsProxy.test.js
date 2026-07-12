const { fetchGoogleNewsRss, _internal } = require('../controllers/newsProxyController');

describe('Google News RSS query fallback', () => {
  test('uses a broader industry market query after the exact profile query', () => {
    expect(
      _internal.buildSearchQueries({
        industry: 'Iron & Sheet Metal',
        city: 'Haridwar',
        materials: ['MS Sheet', 'HR Coil', 'Copper Wire'],
      })
    ).toEqual([
      'Iron & Sheet Metal MS Sheet HR Coil business India Haridwar',
      'Iron & Sheet Metal market India',
      'MS Sheet market India',
    ]);
  });

  test('returns stories from the broader query when the exact query is empty', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '<rss><channel></channel></rss>',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <rss><channel><item>
            <title>Steel market update</title>
            <link>https://example.com/steel</link>
            <pubDate>Sun, 12 Jul 2026 00:00:00 GMT</pubDate>
            <source>Example News</source>
          </item></channel></rss>`,
      });

    try {
      const result = await fetchGoogleNewsRss({
        industry: 'Fallback Test Steel',
        city: 'Haridwar',
        materials: ['Test Coil'],
      });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch.mock.calls[1][0]).toContain('Fallback%20Test%20Steel%20market%20India');
      expect(result).toMatchObject({
        provider: 'rss-proxy',
        news: [expect.objectContaining({ headline: 'Steel market update' })],
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
