// SMTP test script - run from server directory
const nodemailer = require('nodemailer');
require('dotenv').config();

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

console.log('Testing SMTP configuration...');
console.log('EMAIL_USER:', EMAIL_USER);
console.log('EMAIL_PASS:', EMAIL_PASS ? `${EMAIL_PASS.substring(0, 4)}***` : 'NOT SET');

if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ ERROR: EMAIL_USER or EMAIL_PASS not set');
    process.exit(1);
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    }
});

async function testEmail() {
    try {
        console.log('\n1️⃣ Verifying SMTP connection...');
        await transporter.verify();
        console.log('✅ SMTP connection verified!');

        console.log('\n2️⃣ Sending test email to', EMAIL_USER);
        const info = await transporter.sendMail({
            from: `Fasting Tracker Test <${EMAIL_USER}>`,
            to: EMAIL_USER,
            subject: 'SMTP Test - Fasting Tracker',
            html: `
                <h2>✅ SMTP Working!</h2>
                <p>Test email sent at ${new Date().toLocaleString()}</p>
            `
        });

        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('\n🎉 SMTP is configured correctly!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ SMTP Test Failed:');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        
        if (error.code === 'EAUTH') {
            console.error('\n🔑 Authentication Failed!');
            console.error('The app password is incorrect or expired.');
            console.error('\nTo fix:');
            console.error('1. Go to: https://myaccount.google.com/apppasswords');
            console.error('2. Generate a NEW App Password');
            console.error('3. Update EMAIL_PASS in .env (remove quotes if present)');
        }
        
        process.exit(1);
    }
}

testEmail();
