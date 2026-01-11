/**
 * Email Service Module
 * خدمة البريد الإلكتروني
 * 
 * Note: This is a template. Configure with your SMTP provider.
 * For production, use services like SendGrid, Mailgun, AWS SES, etc.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Email configuration from environment
const EMAIL_CONFIG = {
  enabled: process.env.EMAIL_ENABLED === 'true',
  from: process.env.EMAIL_FROM || 'noreply@cloudstorage.local',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  appName: process.env.APP_NAME || 'التخزين السحابي',
  appUrl: process.env.APP_URL || 'http://localhost:5173'
};

// Verification tokens store
const TOKENS_FILE = path.join(__dirname, '.email-tokens.json');
let tokensData = { verificationTokens: [], resetTokens: [] };

// ============ TOKEN MANAGEMENT ============
function loadTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      tokensData = JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading email tokens:', e);
  }
  return tokensData;
}

function saveTokens() {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokensData, null, 2));
  } catch (e) {
    console.error('Error saving email tokens:', e);
  }
}

loadTokens();

// ============ EMAIL TEMPLATES ============
const templates = {
  verification: (data) => ({
    subject: `تأكيد البريد الإلكتروني - ${EMAIL_CONFIG.appName}`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; }
          .logo { text-align: center; font-size: 32px; color: #1a73e8; margin-bottom: 20px; }
          h1 { color: #333; font-size: 24px; margin-bottom: 20px; }
          p { color: #666; line-height: 1.8; }
          .code { background: #f0f7ff; border: 2px dashed #1a73e8; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #1a73e8; letter-spacing: 8px; margin: 30px 0; border-radius: 8px; }
          .button { display: inline-block; background: #1a73e8; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">☁️</div>
          <h1>مرحباً ${data.displayName}!</h1>
          <p>شكراً لتسجيلك في ${EMAIL_CONFIG.appName}. لتأكيد بريدك الإلكتروني، استخدم الرمز التالي:</p>
          <div class="code">${data.code}</div>
          <p>أو اضغط على الزر التالي:</p>
          <a href="${data.verifyUrl}" class="button">تأكيد البريد الإلكتروني</a>
          <p>هذا الرمز صالح لمدة 24 ساعة.</p>
          <div class="footer">
            <p>إذا لم تقم بإنشاء هذا الحساب، يمكنك تجاهل هذا البريد.</p>
            <p>${EMAIL_CONFIG.appName} © ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `مرحباً ${data.displayName}!\n\nرمز التحقق: ${data.code}\n\nأو استخدم الرابط: ${data.verifyUrl}\n\nصالح لمدة 24 ساعة.`
  }),
  
  passwordReset: (data) => ({
    subject: `إعادة تعيين كلمة المرور - ${EMAIL_CONFIG.appName}`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; }
          .logo { text-align: center; font-size: 32px; color: #1a73e8; margin-bottom: 20px; }
          h1 { color: #333; font-size: 24px; margin-bottom: 20px; }
          p { color: #666; line-height: 1.8; }
          .code { background: #fff3e0; border: 2px dashed #ff9800; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #ff9800; letter-spacing: 8px; margin: 30px 0; border-radius: 8px; }
          .button { display: inline-block; background: #ff9800; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; }
          .warning { background: #fff3e0; padding: 15px; border-radius: 8px; color: #e65100; margin: 20px 0; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🔐</div>
          <h1>إعادة تعيين كلمة المرور</h1>
          <p>مرحباً ${data.displayName}،</p>
          <p>تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابك. استخدم الرمز التالي:</p>
          <div class="code">${data.code}</div>
          <p>أو اضغط على الزر التالي:</p>
          <a href="${data.resetUrl}" class="button">إعادة تعيين كلمة المرور</a>
          <div class="warning">
            ⚠️ هذا الرمز صالح لمدة ساعة واحدة فقط. إذا لم تطلب إعادة تعيين كلمة المرور، يرجى تجاهل هذا البريد.
          </div>
          <div class="footer">
            <p>${EMAIL_CONFIG.appName} © ${new Date().getFullYear()}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `إعادة تعيين كلمة المرور\n\nرمز إعادة التعيين: ${data.code}\n\nأو استخدم الرابط: ${data.resetUrl}\n\nصالح لمدة ساعة واحدة.`
  }),
  
  securityAlert: (data) => ({
    subject: `تنبيه أمني - ${EMAIL_CONFIG.appName}`,
    html: `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; }
          .alert { background: #ffebee; border-right: 4px solid #f44336; padding: 20px; margin: 20px 0; border-radius: 4px; }
          h1 { color: #c62828; }
          .details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
          .details p { margin: 5px 0; color: #333; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚨 تنبيه أمني</h1>
          <div class="alert">
            <p><strong>${data.alertType}</strong></p>
            <p>${data.message}</p>
          </div>
          <div class="details">
            <p><strong>الوقت:</strong> ${data.time}</p>
            <p><strong>الجهاز:</strong> ${data.device || 'غير معروف'}</p>
            <p><strong>الموقع:</strong> ${data.location || 'غير معروف'}</p>
          </div>
          <p>إذا لم تكن أنت من قام بهذا النشاط، يرجى تغيير كلمة المرور فوراً.</p>
        </div>
      </body>
      </html>
    `,
    text: `تنبيه أمني\n\n${data.alertType}\n${data.message}\n\nالوقت: ${data.time}`
  })
};

// ============ EMAIL SENDING ============

/**
 * Send email (mock implementation - replace with actual SMTP)
 * @param {string} to 
 * @param {object} template 
 * @returns {Promise<boolean>}
 */
async function sendEmail(to, template) {
  if (!EMAIL_CONFIG.enabled) {
    console.log('📧 Email disabled. Would send to:', to);
    console.log('   Subject:', template.subject);
    return true;
  }
  
  try {
    // In production, use nodemailer or similar:
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({
    //   host: EMAIL_CONFIG.smtpHost,
    //   port: EMAIL_CONFIG.smtpPort,
    //   secure: EMAIL_CONFIG.smtpPort === 465,
    //   auth: {
    //     user: EMAIL_CONFIG.smtpUser,
    //     pass: EMAIL_CONFIG.smtpPass
    //   }
    // });
    // await transporter.sendMail({
    //   from: EMAIL_CONFIG.from,
    //   to,
    //   subject: template.subject,
    //   html: template.html,
    //   text: template.text
    // });
    
    console.log('📧 Email sent to:', to);
    return true;
  } catch (e) {
    console.error('Email send error:', e);
    return false;
  }
}

// ============ VERIFICATION ============

/**
 * Generate verification code
 * @returns {string} 6-digit code
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate verification token
 * @returns {string}
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create email verification
 * @param {string} userId 
 * @param {string} email 
 * @param {string} displayName 
 * @returns {Promise<object>}
 */
async function createEmailVerification(userId, email, displayName) {
  loadTokens();
  
  // Remove existing tokens for this user
  tokensData.verificationTokens = tokensData.verificationTokens
    .filter(t => t.userId !== userId);
  
  const code = generateCode();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
  
  tokensData.verificationTokens.push({
    userId,
    email,
    code,
    token,
    expiresAt,
    createdAt: new Date().toISOString()
  });
  
  saveTokens();
  
  const verifyUrl = `${EMAIL_CONFIG.appUrl}/verify-email?token=${token}`;
  
  // Send email
  await sendEmail(email, templates.verification({
    displayName,
    code,
    verifyUrl
  }));
  
  return { code, token, expiresAt };
}

/**
 * Verify email with code or token
 * @param {string} userId 
 * @param {string} codeOrToken 
 * @returns {boolean}
 */
function verifyEmail(userId, codeOrToken) {
  loadTokens();
  
  const index = tokensData.verificationTokens.findIndex(t => 
    t.userId === userId && 
    (t.code === codeOrToken || t.token === codeOrToken) &&
    new Date(t.expiresAt) > new Date()
  );
  
  if (index !== -1) {
    tokensData.verificationTokens.splice(index, 1);
    saveTokens();
    return true;
  }
  
  return false;
}

/**
 * Verify email by token only (for URL verification)
 * @param {string} token 
 * @returns {object|null} { userId, email }
 */
function verifyEmailByToken(token) {
  loadTokens();
  
  const record = tokensData.verificationTokens.find(t => 
    t.token === token && new Date(t.expiresAt) > new Date()
  );
  
  if (record) {
    const index = tokensData.verificationTokens.indexOf(record);
    tokensData.verificationTokens.splice(index, 1);
    saveTokens();
    return { userId: record.userId, email: record.email };
  }
  
  return null;
}

// ============ PASSWORD RESET ============

/**
 * Create password reset request
 * @param {string} userId 
 * @param {string} email 
 * @param {string} displayName 
 * @returns {Promise<object>}
 */
async function createPasswordReset(userId, email, displayName) {
  loadTokens();
  
  // Remove existing tokens for this user
  tokensData.resetTokens = tokensData.resetTokens
    .filter(t => t.userId !== userId);
  
  const code = generateCode();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  
  tokensData.resetTokens.push({
    userId,
    email,
    code,
    token,
    expiresAt,
    createdAt: new Date().toISOString()
  });
  
  saveTokens();
  
  const resetUrl = `${EMAIL_CONFIG.appUrl}/reset-password?token=${token}`;
  
  // Send email
  await sendEmail(email, templates.passwordReset({
    displayName,
    code,
    resetUrl
  }));
  
  return { code, token, expiresAt };
}

/**
 * Verify password reset code/token
 * @param {string} codeOrToken 
 * @returns {object|null} { userId, email }
 */
function verifyPasswordReset(codeOrToken) {
  loadTokens();
  
  const record = tokensData.resetTokens.find(t => 
    (t.code === codeOrToken || t.token === codeOrToken) &&
    new Date(t.expiresAt) > new Date()
  );
  
  if (record) {
    return { userId: record.userId, email: record.email };
  }
  
  return null;
}

/**
 * Complete password reset (remove token)
 * @param {string} codeOrToken 
 */
function completePasswordReset(codeOrToken) {
  loadTokens();
  
  const index = tokensData.resetTokens.findIndex(t => 
    t.code === codeOrToken || t.token === codeOrToken
  );
  
  if (index !== -1) {
    tokensData.resetTokens.splice(index, 1);
    saveTokens();
  }
}

/**
 * Send security alert email
 * @param {string} email 
 * @param {string} displayName 
 * @param {object} alertData 
 */
async function sendSecurityAlert(email, displayName, alertData) {
  await sendEmail(email, templates.securityAlert({
    displayName,
    ...alertData,
    time: new Date().toLocaleString('ar-SA')
  }));
}

// Clean expired tokens periodically
setInterval(() => {
  loadTokens();
  const now = new Date();
  let cleaned = 0;
  
  tokensData.verificationTokens = tokensData.verificationTokens.filter(t => {
    if (new Date(t.expiresAt) < now) {
      cleaned++;
      return false;
    }
    return true;
  });
  
  tokensData.resetTokens = tokensData.resetTokens.filter(t => {
    if (new Date(t.expiresAt) < now) {
      cleaned++;
      return false;
    }
    return true;
  });
  
  if (cleaned > 0) {
    saveTokens();
    console.log(`🗑️ Cleaned ${cleaned} expired email tokens`);
  }
}, 60 * 60 * 1000); // Hourly

// ============ EXPORTS ============
module.exports = {
  EMAIL_CONFIG,
  
  // Email
  sendEmail,
  
  // Verification
  createEmailVerification,
  verifyEmail,
  verifyEmailByToken,
  
  // Password Reset
  createPasswordReset,
  verifyPasswordReset,
  completePasswordReset,
  
  // Security
  sendSecurityAlert
};
