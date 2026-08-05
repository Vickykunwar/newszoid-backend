jest.mock('../controllers/bizAgentController', () => ({
  callAIWithFallback: jest.fn(),
}));

const { callAIWithFallback } = require('../controllers/bizAgentController');
const handler = require('../controllers/briefController');

describe('brief includes rate history for today/yesterday/day-before', () => {
  test('passes the 3-day price history through to the AI prompt', async () => {
    callAIWithFallback.mockResolvedValue({
      text: '<h2>Today\'s Rates</h2><p>ok</p>',
      provider: 'ai',
      bothAiFailed: false,
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await handler(
      {
        method: 'POST',
        body: {
          businessType: 'Steel',
          city: 'Delhi',
          name: 'Example Metals',
          currentRates: [
            {
              item: 'MS Sheet',
              currentPrice: 64.2,
              deltaPercent: 1.1,
              history: [
                { date: '2026-07-31', rate: 63.5, source: 'Example Source' },
                { date: '2026-08-01', rate: 63.9, source: 'Example Source' },
                { date: '2026-08-02', rate: 64.2, source: 'Example Source' },
              ],
            },
          ],
          recentNews: [{ headline: 'Import duty on steel raised' }],
        },
      },
      res
    );

    const [, , options] = callAIWithFallback.mock.calls[0];
    expect(options.context.rates[0].history).toHaveLength(3);
    expect(options.context.rates[0].history[0]).toMatchObject({ price: 63.5 });
    expect(options.context.rates[0].history[2]).toMatchObject({ price: 64.2 });
  });
});
