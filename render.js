// t.js - Simple Call Forwarding Script with Allowed Numbers
const express = require('express');
const twilio = require('twilio');
const fs = require('fs').promises;

const app = express();

// === SECURITY WARNING: THESE ARE EXPOSED! ===
const accountSid = 'AC2b594c6ecce1c9c6d6bba1f9d7089da3';
const authToken = '9a388ba84c579a97d00d97a3de4c5fe8';

// Initialize Twilio client (correct modern way)
const client = require('twilio')(accountSid, authToken);

// Configuration
const YOUR_NUMBER = '+447502059718'; // Replace with your personal number
const TWILIO_NUMBER = '+12513151993'; // Your Twilio number
const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'T3chs0ft';

// Load allowed numbers from file
async function loadAllowedNumbers() {
    try {
        const data = await fs.readFile('numbers.txt', 'utf8');
        return data.split('\n')
            .map(num => num.trim())
            .filter(num => num.length > 0);
    } catch (err) {
        console.error("Error reading numbers.txt:", err.message);
        return [];
    }
}

// Basic Authentication Middleware
function basicAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="Restricted Area"');
        return res.status(401).send('Authentication required');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="Restricted Area"');
    return res.status(401).send('Invalid credentials');
}

// Make call endpoint
app.get('/call', basicAuth, async (req, res) => {
    const targetNumber = req.query.number;

    if (!targetNumber) {
        return res.status(400).send('Missing number parameter');
    }

    let formattedNumber = targetNumber;
    if (targetNumber.startsWith('0')) {
        formattedNumber = '+44' + targetNumber.substring(1);
    }

    const allowedNumbers = await loadAllowedNumbers();
    if (!allowedNumbers.includes(formattedNumber)) {
        return res.status(403).send('Number not allowed');
    }

    try {
        const call = await client.calls.create({
            url: `${req.protocol}://${req.get('host')}/voice`,
            to: formattedNumber,
            from: TWILIO_NUMBER
        });
        res.send(`Call initiated to ${formattedNumber}, SID: ${call.sid}`);
    } catch (err) {
        console.error('Call error:', err.message);
        res.status(500).send('Failed to initiate call: ' + err.message);
    }
});

// Voice instructions
app.post('/voice', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const gather = twiml.gather({
        numDigits: 1,
        action: '/gather',
        method: 'POST'
    });
    gather.say('Press 1 to connect to the recipient. Press any other key to hang up.');

    res.type('text/xml');
    res.send(twiml.toString());
});

// Handle digit input
app.post('/gather', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const digits = req.body.Digits;

    if (digits === '1') {
        twiml.dial(YOUR_NUMBER);
    } else {
        twiml.say('Goodbye');
        twiml.hangup();
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// Parse form data
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
    console.log('SECURITY WARNING: Exposed credentials! Change them immediately!');
    console.log(`Make calls at: http://YOUR-RENDER-URL/call?number=TARGET_NUMBER`);
    console.log('Auth: admin / T3chs0ft');

    const allowed = await loadAllowedNumbers();
    console.log('Allowed Numbers:', allowed);
});
