jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: async () => ({
          response: {
            text: () =>
              JSON.stringify({
                summary: 'Example Metals makes fabricated steel products.',
                industry: 'Steel',
                resolvedLocation: 'Delhi, Delhi',
                localContext: 'Delhi NCR steel and freight prices affect local input costs.',
                suggestedItems: ['HR Coil', 'MS Sheet', 'HR Coil'],
                confidence: 'HIGH',
                sources: [
                  { title: 'Example directory', url: 'https://example.com/business' },
                  { title: 'Unsafe source', url: 'javascript:alert(1)' },
                ],
              }),
          },
        }),
      };
    }
  },
}));

const request = require('supertest');
const app = require('../server');

describe('Current API surface', () => {
  test('GET /api/health returns server status without opening a listener', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      status: 'online',
    });
    expect(response.body).toHaveProperty('database');
    expect(response.body).toHaveProperty('timestamp');
  });

  test('POST /api/biz-agent/profile validates required name', async () => {
    const response = await request(app)
      .post('/api/biz-agent/profile')
      .send({
        businessType: 'Iron & Sheet Metal',
        city: 'Delhi',
        items: ['MS Sheet'],
      })
      .expect(400);

    expect(response.body).toHaveProperty('ok', false);
  });

  test('POST /api/biz-agent/profile/enrich validates research identity and location', async () => {
    const response = await request(app)
      .post('/api/biz-agent/profile/enrich')
      .send({
        name: 'A',
        city: '',
        businessType: 'Steel',
      })
      .expect(400);

    expect(response.body).toHaveProperty('ok', false);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'city' }),
      ])
    );
  });

  test('POST /api/biz-agent/profile/enrich returns sanitized, deduplicated suggestions', async () => {
    const response = await request(app)
      .post('/api/biz-agent/profile/enrich')
      .send({
        name: 'Example Metals',
        city: 'Delhi',
        companyRole: 'Manufacturer',
        businessType: 'Steel',
        items: ['Diesel'],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      cached: false,
      enrichment: {
        industry: 'Steel',
        resolvedLocation: 'Delhi, Delhi',
        confidence: 'HIGH',
        suggestedItems: ['HR Coil', 'MS Sheet'],
        sources: [{ title: 'Example directory', url: 'https://example.com/business' }],
      },
    });
  });

  test('POST /api/biz-agent/news validates required business profile fields', async () => {
    const response = await request(app).post('/api/biz-agent/news').send({}).expect(400);

    expect(response.body).toHaveProperty('ok', false);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test('GET unknown API route returns JSON 404', async () => {
    const response = await request(app).get('/api/not-found').expect(404);

    expect(response.body).toEqual({ ok: false, error: 'Not found' });
  });

  test('WhatsApp route is mounted but never simulates a delivery', async () => {
    const response = await request(app).get('/api/whatsapp-alert').expect(405);

    expect(response.body).toEqual({ error: 'Method Not Allowed' });
  });
});
