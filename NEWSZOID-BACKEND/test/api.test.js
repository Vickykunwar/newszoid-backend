// test/api.test.js - Automated API Tests
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/user');
const Comment = require('../models/Comment');
const Bookmark = require('../models/Bookmark');

// Test configuration
const testUser = {
  name: 'Test User',
  email: 'test@example.com',
  password: 'Test123456'
};

let authToken;
let userId;

// ==================================
// Setup and Teardown
// ==================================

beforeAll(async () => {
  // Connect to test database
  const mongoUri = process.env.MONGO_TEST_URI || 'mongodb://localhost:27017/newszoid-test';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to test database');
});

afterAll(async () => {
  // Cleanup test data
  await User.deleteMany({ email: testUser.email });
  await Comment.deleteMany({});
  await Bookmark.deleteMany({});
  
  // Close connections
  await mongoose.connection.close();
  console.log('✅ Test database cleaned and closed');
});

// ==================================
// Health Check Tests
// ==================================

describe('Health Check', () => {
  test('GET /api/health should return 200', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('mongodb');
    expect(response.body).toHaveProperty('timestamp');
  });
});

// ==================================
// Authentication Tests
// ==================================

describe('Authentication', () => {
  
  test('POST /api/auth/register - Should register new user', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toHaveProperty('email', testUser.email);
    expect(response.body.user).not.toHaveProperty('passwordHash');
    
    userId = response.body.user.id;
  });

  test('POST /api/auth/register - Should fail with duplicate email', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send(testUser)
      .expect(400);

    expect(response.body).toHaveProperty('ok', false);
    expect(response.body.error).toContain('already registered');
  });

  test('POST /api/auth/register - Should fail with weak password', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User 2',
        email: 'test2@example.com',
        password: '12345'
      })
      .expect(400);

    expect(response.body).toHaveProperty('ok', false);
    expect(response.body.error).toContain('6 characters');
  });

  test('POST /api/auth/register - Should fail without uppercase/lowercase/numbers', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Test User 3',
        email: 'test3@example.com',
        password: 'password'
      })
      .expect(400);

    expect(response.body).toHaveProperty('ok', false);
    expect(response.body.error).toContain('uppercase');
  });

  test('POST /api/auth/login - Should login with correct credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      })
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('user');
    
    // Extract token from cookie
    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    
    const tokenCookie = cookies.find(cookie => cookie.startsWith('newszoid_token='));
    expect(tokenCookie).toBeDefined();
    
    authToken = tokenCookie.split(';')[0].split('=')[1];
  });

  test('POST /api/auth/login - Should fail with wrong password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123'
      })
      .expect(401);

    expect(response.body).toHaveProperty('ok', false);
    expect(response.body.error).toContain('Invalid credentials');
  });

  test('GET /api/auth/me - Should get current user', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `newszoid_token=${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body.user).toHaveProperty('email', testUser.email);
  });

  test('GET /api/auth/me - Should fail without token', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });
});

// ==================================
// News API Tests
// ==================================

describe('News API', () => {
  
  test('GET /api/news - Should get general news', async () => {
    const response = await request(app)
      .get('/api/news')
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/news?category=technology - Should get tech news', async () => {
    const response = await request(app)
      .get('/api/news?category=technology')
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('category', 'technology');
  });

  test('GET /api/news?category=invalid - Should fail with invalid category', async () => {
    const response = await request(app)
      .get('/api/news?category=invalid')
      .expect(400);

    expect(response.body).toHaveProperty('ok', false);
  });

  test('GET /api/news/local - Should get local news', async () => {
    const response = await request(app)
      .get('/api/news/local?location=Delhi')
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('data');
  });
});

// ==================================
// Comment Tests
// ==================================

describe('Comments', () => {
  const testArticleId = 'test-article-123';

  test('POST /api/comments/:articleId - Should create comment', async () => {
    const response = await request(app)
      .post(`/api/comments/${testArticleId}`)
      .set('Cookie', `newszoid_token=${authToken}`)
      .send({ text: 'This is a test comment' })
      .expect(201);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body.comment).toHaveProperty('text', 'This is a test comment');
  });

  test('POST /api/comments/:articleId - Should fail without authentication', async () => {
    const response = await request(app)
      .post(`/api/comments/${testArticleId}`)
      .send({ text: 'This should fail' })
      .expect(401);

    expect(response.body).toHaveProperty('error');
  });

  test('POST /api/comments/:articleId - Should fail with empty comment', async () => {
    const response = await request(app)
      .post(`/api/comments/${testArticleId}`)
      .set('Cookie', `newszoid_token=${authToken}`)
      .send({ text: '' })
      .expect(400);

    expect(response.body).toHaveProperty('ok', false);
  });

  test('POST /api/comments/:articleId - Should sanitize HTML', async () => {
    const response = await request(app)
      .post(`/api/comments/${testArticleId}`)
      .set('Cookie', `newszoid_token=${authToken}`)
      .send({ text: '<script>alert("XSS")</script>Test comment' })
      .expect(201);

    expect(response.body.comment.text).not.toContain('<script>');
    expect(response.body.comment.text).toContain('Test comment');
  });

  test('GET /api/comments/:articleId - Should get comments', async () => {
    const response = await request(app)
      .get(`/api/comments/${testArticleId}`)
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('items');
    expect(Array.isArray(response.body.items)).toBe(true);
  });
});

// ==================================
// Bookmark Tests
// ==================================

describe('Bookmarks', () => {
  const testBookmark = {
    articleId: 'test-article-456',
    title: 'Test Article',
    url: 'https://example.com/article',
    snippet: 'This is a test article',
    image: 'https://example.com/image.jpg'
  };

  test('POST /api/bookmarks - Should create bookmark', async () => {
    const response = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', `newszoid_token=${authToken}`)
      .send(testBookmark)
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body.bookmark).toHaveProperty('articleId', testBookmark.articleId);
  });

  test('POST /api/bookmarks - Should fail with duplicate', async () => {
    const response = await request(app)
      .post('/api/bookmarks')
      .set('Cookie', `newszoid_token=${authToken}`)
      .send(testBookmark)
      .expect(400);

    expect(response.body.error).toContain('Already bookmarked');
  });

  test('GET /api/bookmarks - Should get user bookmarks', async () => {
    const response = await request(app)
      .get('/api/bookmarks')
      .set('Cookie', `newszoid_token=${authToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('ok', true);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
  });
});

// ==================================
// Rate Limiting Tests
// ==================================

describe('Rate Limiting', () => {
  
  test('Should enforce rate limits', async () => {
    const requests = [];
    
    // Make 60 requests (limit is 50)
    for (let i = 0; i < 60; i++) {
      requests.push(
        request(app)
          .get('/api/health')
      );
    }

    const responses = await Promise.all(requests);
    
    // Some requests should be rate limited
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout
});

// ==================================
// Security Tests
// ==================================

describe('Security', () => {
  
  test('Should have security headers', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers).toHaveProperty('x-frame-options');
  });

  test('Should reject SQL injection attempts', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: "admin'--",
        password: "anything"
      })
      .expect(401);

    expect(response.body).toHaveProperty('ok', false);
  });

  test('Should sanitize XSS attempts in comments', async () => {
    const response = await request(app)
      .post('/api/comments/test-article')
      .set('Cookie', `newszoid_token=${authToken}`)
      .send({
        text: '<img src=x onerror=alert("XSS")>Test'
      })
      .expect(201);

    expect(response.body.comment.text).not.toContain('<img');
    expect(response.body.comment.text).not.toContain('onerror');
  });
});

// ==================================
// Error Handling Tests
// ==================================

describe('Error Handling', () => {
  
  test('Should return 404 for non-existent routes', async () => {
    const response = await request(app)
      .get('/api/non-existent-route')
      .expect(404);

    expect(response.body).toHaveProperty('ok', false);
  });

  test('Should handle malformed JSON', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"invalid json')
      .expect(400);
  });
});

console.log('\n✅ All tests completed!');