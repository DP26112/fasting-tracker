// Quick SMTP test script to diagnose email issues
const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../server/.env') });

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

console.log('Testing SMTP configuration...');
console.log('EMAIL_USER:', EMAIL_USER ? `${EMAIL_USER.substring(0, 3)}***` : 'NOT SET');
console.log('EMAIL_PASS:', EMAIL_PASS ? `${EMAIL_PASS.substring(0, 4)}***` : 'NOT SET');

if (!EMAIL_USER || !EMAIL_PASS) {
    console.error('❌ ERROR: EMAIL_USER or EMAIL_PASS not set in environment');
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
        console.log('✅ SMTP connection verified successfully!');

        console.log('\n2️⃣ Sending test email...');
        const info = await transporter.sendMail({
            from: `Fasting Tracker Test <${EMAIL_USER}>`,
            to: EMAIL_USER, // Send to yourself
            subject: 'SMTP Test - Fasting Tracker',
            html: `
                <h2>✅ SMTP Configuration Working!</h2>
                <p>This test email was sent successfully from your fasting tracker server.</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            `
        });

        console.log('✅ Test email sent successfully!');
        console.log('Message ID:', info.messageId);
        console.log('\n🎉 SMTP is configured correctly!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ SMTP Test Failed:');
        console.error('Error:', error.message);
        
        if (error.code === 'EAUTH') {
            console.error('\n🔑 Authentication Error - Possible Issues:');
            console.error('1. App Password is incorrect');
            console.error('2. 2-Step Verification not enabled on Google account');
            console.error('3. App Password was revoked');
            console.error('\n📝 To fix:');
            console.error('   - Go to: https://myaccount.google.com/apppasswords');
            console.error('   - Generate a new App Password');
            console.error('   - Update EMAIL_PASS in your .env file');
        } else if (error.code === 'ESOCKET') {
            console.error('\n🌐 Network/Firewall Issue:');
            console.error('   - Check if port 587 or 465 is blocked');
            console.error('   - VPS firewall may be blocking SMTP');
        }
        
        process.exit(1);
    }
}

testEmail();
