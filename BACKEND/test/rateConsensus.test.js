const { _internal } = require('../controllers/rateConsensusController');

describe('rate consensus helpers', () => {
  test('clusters a clear copper-price majority and leaves outliers separate', () => {
    const candidates = [
      { source: 'a', price: 848 },
      { source: 'b', price: 850 },
      { source: 'c', price: 855 },
      { source: 'd', price: 852 },
      { source: 'outlier-a', price: 720 },
      { source: 'outlier-b', price: 1100 },
    ];

    const clusters = _internal.clusterPrices(candidates);
    expect(clusters[0]).toHaveLength(4);
    expect(clusters[0].map(candidate => candidate.price)).toEqual([848, 850, 852, 855]);
  });

  test('sets HIGH, MEDIUM, and LOW confidence from source agreement', () => {
    const candidates = [
      { source: 'a', price: 850 },
      { source: 'b', price: 851 },
      { source: 'c', price: 849 },
      { source: 'd', price: 900 },
    ];

    expect(_internal.resolveConsensusRate(candidates, 5).confidence).toBe('HIGH');
    expect(_internal.resolveConsensusRate(candidates.slice(0, 2), 5).confidence).toBe('MEDIUM');
    expect(_internal.resolveConsensusRate(candidates.slice(0, 1), 5).confidence).toBe('LOW');
  });

  test('extracts INR price formats only when the requested material is mentioned', () => {
    const text = '<p>Copper wire is available at Rs. 850 per kg and ₹855/kg.</p>';
    expect(_internal.extractCandidatePrices(text, 'Copper wire')).toEqual([850, 855]);
    expect(_internal.extractCandidatePrices('MS Sheet: INR 70,000 per tonne', 'MS Sheet')).toEqual([70000]);
    expect(_internal.extractCandidatePrices('Copper wire is Rs 850 per kg', 'Cement')).toEqual([]);
  });
});
