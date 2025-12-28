const http = require('http');

const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/news?category=environment',
    method: 'GET',
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('BODY:');
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2).substring(0, 500) + '...');
        } catch {
            console.log(data);
        }
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.end();
