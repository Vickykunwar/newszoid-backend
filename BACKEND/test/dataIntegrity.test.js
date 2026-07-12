jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {},
}));

const { _internal: rateInternal } = require('../controllers/bizAgentController');
const { _internal: newsInternal } = require('../controllers/newsProxyController');
const { _internal: whatsappInternal } = require('../controllers/whatsappAlertController');

describe('publisher and rate integrity guards', () => {
  test('RSS text and links are sanitised before the browser receives them', () => {
    expect(newsInternal.sanitizeText('<img src=x onerror=alert(1)>Steel update'))
      .toContain('&lt;img');
    expect(newsInternal.sanitizeExternalUrl('javascript:alert(1)')).toBe('');
    expect(newsInternal.sanitizeExternalUrl('https://example.com/story')).toBe('https://example.com/story');
  });

  test('a rate source must contain both the requested item and quoted price', () => {
    expect(rateInternal.sourcePageMentionsRate('MS Sheet price is Rs 70,000 per tonne', 'MS Sheet', 70000))
      .toBe(true);
    expect(rateInternal.sourcePageMentionsRate('MS Sheet price is Rs 68,000 per tonne', 'MS Sheet', 70000))
      .toBe(false);
    expect(rateInternal.sourcePageMentionsRate('Copper wire price is Rs 70,000', 'MS Sheet', 70000))
      .toBe(false);
  });

  test('internal WhatsApp delivery accepts only valid E.164-style digits', () => {
    expect(whatsappInternal.normalizeWhatsAppNumber('98765 43210')).toBe('919876543210');
    expect(whatsappInternal.normalizeWhatsAppNumber('123')).toBe('');
  });
});
