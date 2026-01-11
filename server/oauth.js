/**
 * OAuth2 Authentication Module
 * نظام المصادقة عبر OAuth2 (Google, GitHub, Microsoft)
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// ============ CONFIGURATION ============
const OAUTH_PROVIDERS = {
  google: {
    name: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  },
  github: {
    name: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    emailUrl: 'https://api.github.com/user/emails',
    scopes: ['read:user', 'user:email'],
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET
  },
  microsoft: {
    name: 'Microsoft',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET
  }
};

const CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || 'http://localhost:3000/api/auth/oauth/callback';

// State storage (in production, use Redis)
const pendingStates = new Map();
const STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

// ============ HELPERS ============

/**
 * Make HTTP request
 */
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CloudStorage/1.0',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Generate secure state parameter
 */
function generateState() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Clean expired states
 */
function cleanExpiredStates() {
  const now = Date.now();
  for (const [state, data] of pendingStates) {
    if (now > data.expiresAt) {
      pendingStates.delete(state);
    }
  }
}

// Clean states every 5 minutes
setInterval(cleanExpiredStates, 5 * 60 * 1000);

// ============ OAUTH FLOW ============

/**
 * Check if provider is configured
 */
function isProviderConfigured(provider) {
  const config = OAUTH_PROVIDERS[provider];
  return config && config.clientId && config.clientSecret;
}

/**
 * Get available OAuth providers
 */
function getAvailableProviders() {
  const available = [];
  for (const [key, config] of Object.entries(OAUTH_PROVIDERS)) {
    if (isProviderConfigured(key)) {
      available.push({
        id: key,
        name: config.name
      });
    }
  }
  return available;
}

/**
 * Generate OAuth authorization URL
 */
function getAuthorizationUrl(provider, redirectUri = null) {
  const config = OAUTH_PROVIDERS[provider];
  
  if (!config) {
    throw new Error(`مزود غير معروف: ${provider}`);
  }
  
  if (!isProviderConfigured(provider)) {
    throw new Error(`مزود ${config.name} غير مهيأ`);
  }
  
  // Generate state
  const state = generateState();
  pendingStates.set(state, {
    provider,
    redirectUri,
    createdAt: Date.now(),
    expiresAt: Date.now() + STATE_EXPIRY
  });
  
  // Build URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri || `${CALLBACK_URL}/${provider}`,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
    access_type: 'offline', // For refresh token (Google)
    prompt: 'consent' // Force consent screen
  });
  
  return {
    url: `${config.authUrl}?${params.toString()}`,
    state
  };
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCode(provider, code, state) {
  const config = OAUTH_PROVIDERS[provider];
  
  if (!config) {
    throw new Error(`مزود غير معروف: ${provider}`);
  }
  
  // Verify state
  const stateData = pendingStates.get(state);
  if (!stateData || stateData.provider !== provider) {
    throw new Error('حالة غير صالحة أو منتهية');
  }
  
  // Remove used state
  pendingStates.delete(state);
  
  // Check expiry
  if (Date.now() > stateData.expiresAt) {
    throw new Error('انتهت صلاحية طلب المصادقة');
  }
  
  // Exchange code for token
  const tokenParams = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: stateData.redirectUri || `${CALLBACK_URL}/${provider}`
  });
  
  const tokenResponse = await httpRequest(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: tokenParams.toString()
  });
  
  if (tokenResponse.status !== 200 || tokenResponse.data.error) {
    console.error('Token exchange error:', tokenResponse.data);
    throw new Error('فشل في الحصول على رمز الوصول');
  }
  
  return tokenResponse.data;
}

/**
 * Get user info from provider
 */
async function getUserInfo(provider, accessToken) {
  const config = OAUTH_PROVIDERS[provider];
  
  if (!config) {
    throw new Error(`مزود غير معروف: ${provider}`);
  }
  
  // Get user info
  const userResponse = await httpRequest(config.userInfoUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  if (userResponse.status !== 200) {
    throw new Error('فشل في جلب معلومات المستخدم');
  }
  
  const userData = userResponse.data;
  
  // Normalize user data based on provider
  let normalizedUser;
  
  switch (provider) {
    case 'google':
      normalizedUser = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        picture: userData.picture,
        emailVerified: userData.verified_email
      };
      break;
      
    case 'github':
      // GitHub might not return email in user info, need separate call
      let email = userData.email;
      if (!email) {
        const emailResponse = await httpRequest(config.emailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        if (emailResponse.status === 200 && Array.isArray(emailResponse.data)) {
          const primaryEmail = emailResponse.data.find(e => e.primary);
          email = primaryEmail?.email || emailResponse.data[0]?.email;
        }
      }
      
      normalizedUser = {
        id: userData.id.toString(),
        email: email,
        name: userData.name || userData.login,
        picture: userData.avatar_url,
        username: userData.login,
        emailVerified: true // GitHub emails are verified
      };
      break;
      
    case 'microsoft':
      normalizedUser = {
        id: userData.id,
        email: userData.mail || userData.userPrincipalName,
        name: userData.displayName,
        picture: null, // Microsoft Graph requires separate call for photo
        emailVerified: true
      };
      break;
      
    default:
      normalizedUser = {
        id: userData.id || userData.sub,
        email: userData.email,
        name: userData.name,
        picture: userData.picture || userData.avatar_url
      };
  }
  
  return {
    provider,
    providerId: normalizedUser.id,
    ...normalizedUser
  };
}

/**
 * Complete OAuth flow - exchange code and get user info
 */
async function completeOAuth(provider, code, state) {
  // Exchange code for tokens
  const tokens = await exchangeCode(provider, code, state);
  
  // Get user info
  const userInfo = await getUserInfo(provider, tokens.access_token);
  
  return {
    tokens: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in
    },
    user: userInfo
  };
}

// ============ LINKED ACCOUNTS ============

/**
 * Link OAuth account to existing user
 */
function linkAccount(userId, provider, providerData) {
  return {
    userId,
    provider,
    providerId: providerData.providerId,
    email: providerData.email,
    name: providerData.name,
    picture: providerData.picture,
    linkedAt: new Date().toISOString()
  };
}

// ============ EXPORTS ============
module.exports = {
  OAUTH_PROVIDERS,
  isProviderConfigured,
  getAvailableProviders,
  getAuthorizationUrl,
  exchangeCode,
  getUserInfo,
  completeOAuth,
  linkAccount
};
