/**
 * HTTPS Setup Module
 * إعداد HTTPS للسيرفر
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CERT_DIR = path.join(__dirname, 'certs');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

/**
 * Check if SSL certificates exist
 * @returns {boolean}
 */
function hasSSLCertificates() {
  return fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);
}

/**
 * Load SSL certificates
 * @returns {{ key: Buffer, cert: Buffer } | null}
 */
function loadSSLCertificates() {
  try {
    if (!hasSSLCertificates()) {
      return null;
    }
    
    return {
      key: fs.readFileSync(KEY_PATH),
      cert: fs.readFileSync(CERT_PATH)
    };
  } catch (e) {
    console.error('Error loading SSL certificates:', e.message);
    return null;
  }
}

/**
 * Create HTTPS server if certificates exist, otherwise HTTP
 * @param {Express.Application} app 
 * @param {number} port 
 * @param {Function} callback 
 * @returns {{ server: http.Server | https.Server, isHttps: boolean }}
 */
function createServer(app, port, callback) {
  const sslOptions = loadSSLCertificates();
  
  if (sslOptions) {
    const server = https.createServer(sslOptions, app);
    console.log('🔒 HTTPS enabled with SSL certificates');
    return { server, isHttps: true };
  } else {
    const server = http.createServer(app);
    console.log('⚠️  Running in HTTP mode (no SSL certificates found)');
    console.log(`   To enable HTTPS, add certificates to: ${CERT_DIR}`);
    return { server, isHttps: false };
  }
}

/**
 * Create HTTP to HTTPS redirect middleware
 * @returns {Function}
 */
function httpsRedirect() {
  return (req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }
    
    // Redirect to HTTPS
    const httpsUrl = `https://${req.hostname}${req.url}`;
    res.redirect(301, httpsUrl);
  };
}

/**
 * Generate self-signed certificate instructions
 */
function printCertificateInstructions() {
  console.log('');
  console.log('📜 To generate self-signed certificates for development:');
  console.log('');
  console.log('   Windows (PowerShell):');
  console.log(`   mkdir ${CERT_DIR}`);
  console.log(`   openssl req -x509 -newkey rsa:4096 -keyout ${KEY_PATH} -out ${CERT_PATH} -days 365 -nodes -subj "/CN=localhost"`);
  console.log('');
  console.log('   Or use mkcert for trusted local certificates:');
  console.log('   https://github.com/FiloSottile/mkcert');
  console.log('');
}

/**
 * Ensure certs directory exists
 */
function ensureCertsDir() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true });
    console.log(`📁 Created certificates directory: ${CERT_DIR}`);
  }
}

module.exports = {
  hasSSLCertificates,
  loadSSLCertificates,
  createServer,
  httpsRedirect,
  printCertificateInstructions,
  ensureCertsDir,
  CERT_DIR,
  KEY_PATH,
  CERT_PATH
};
