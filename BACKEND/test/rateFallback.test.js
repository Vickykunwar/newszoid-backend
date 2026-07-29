const { _internal } = require('../controllers/bizAgentController');

describe('rate fallback without MongoDB history', () => {
  test('keeps a source-verified quote visible without inventing a trend', () => {
    const [rate] = _internal.buildUntrackedRates([
      {
        item: 'MS Sheet',
        itemKey: 'ms-sheet',
        unit: 'Rs/kg',
        currentPrice: 64.2,
        market: 'Haridwar',
        note: 'Source page checked.',
        confidence: 'MEDIUM',
        sourceName: 'Example Source',
        sourceUrl: 'https://example.com/ms-sheet',
        sourceDate: '',
        sourceVerified: true,
      },
    ]);

    expect(rate).toMatchObject({
      item: 'MS Sheet',
      currentPrice: 64.2,
      prevPrice: 64.2,
      delta: 0,
      deltaPercent: 0,
      trend: 'FLAT',
      sourceVerified: true,
      verified: true,
    });
    expect(rate.history).toHaveLength(1);
    expect(rate.comparisonLabel).toMatch(/history temporarily unavailable/i);
  });

  test('rejects a hostname that resolves to loopback before it can be fetched', async () => {
    const safe = await _internal.isSafeHost('attacker.example', async () => [
      { address: '127.0.0.1', family: 4 },
    ]);
    expect(safe).toBe(false);
  });
});
