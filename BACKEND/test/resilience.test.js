jest.mock(
  '@upstash/redis',
  () => ({
    Redis: { fromEnv: jest.fn() },
  }),
  { virtual: true }
);

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  jest.resetModules();
});

describe('AI resilience router', () => {
  test('uses the rule engine with no AI or Redis credentials and accepts backend-shaped rates', async () => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { getAIResponse } = require('../../lib/ai-router');
    const result = await getAIResponse('ignored', {
      businessName: 'Example Metals',
      rates: [
        { item: 'HR Coil', deltaPercent: 4.5 },
        { item: 'Copper Wire', deltaPercent: -3.2 },
      ],
      news: [
        { headline: 'Government subsidy scheme opens for MSME manufacturers' },
        { title: 'Import duty on steel raised' },
      ],
    });

    expect(result).toMatchObject({ provider: 'rule-engine', bothAiFailed: true });
    expect(result.text).toContain('HR Coil is up 4.5%');
    expect(result.text).toContain('Copper Wire dropped 3.2%');
    expect(result.text).toContain('Government subsidy scheme');
    expect(result.text).toContain('Import duty on steel raised');
  });
});

describe('brief endpoint', () => {
  test('passes rate/news context to the router and returns sanitized brief HTML', async () => {
    const getAIResponse = jest.fn().mockResolvedValue({
      text: '<h2>Update</h2><p>Safe</p><script>alert(1)</script>',
      provider: 'rule-engine',
      bothAiFailed: true,
    });
    jest.doMock('../../lib/ai-router', () => ({ getAIResponse }));
    const handler = require('../../api/brief');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await handler(
      {
        method: 'POST',
        body: {
          businessType: 'Steel',
          city: 'Delhi',
          name: 'Example Metals',
          currentRates: [{ item: 'HR Coil', deltaPercent: 4.5 }],
          recentNews: [{ headline: 'Import duty on steel raised' }],
        },
      },
      res
    );

    expect(getAIResponse.mock.calls[0][1]).toMatchObject({
      rates: [{ item: 'HR Coil', deltaPercent: 4.5 }],
      news: [{ headline: 'Import duty on steel raised' }],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        bothAiFailed: true,
        suggestRssFallback: true,
        brief: '<h2>Update</h2><p>Safe</p>',
      })
    );
  });
});
