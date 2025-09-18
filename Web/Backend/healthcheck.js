const http = require('http');
const config = require('./src/config/environment');

const options = {
    hostname: 'localhost',
    port: config.PORT,
    path: '/api/health',
    method: 'GET',
    timeout: 3000
};

const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
        console.log('Health check passed');
        process.exit(0);
    } else {
        console.log(`Health check failed with status code: ${res.statusCode}`);
        process.exit(1);
    }
});

req.on('error', (error) => {
    console.log(`Health check failed: ${error.message}`);
    process.exit(1);
});

req.on('timeout', () => {
    console.log('Health check timed out');
    req.destroy();
    process.exit(1);
});

req.end();
