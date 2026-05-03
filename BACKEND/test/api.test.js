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

  test('POST /api/biz-agent/news validates required business profile fields', async () => {
    const response = await request(app).post('/api/biz-agent/news').send({}).expect(400);

    expect(response.body).toHaveProperty('ok', false);
    expect(Array.isArray(response.body.errors)).toBe(true);
  });

  test('GET unknown API route returns JSON 404', async () => {
    const response = await request(app).get('/api/not-found').expect(404);

    expect(response.body).toEqual({ ok: false, error: 'Not found' });
  });
});
