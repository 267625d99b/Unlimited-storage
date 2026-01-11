/**
 * AI Providers - مزودي الذكاء الاصطناعي المجانيين
 * دعم: Google Gemini, Groq, Cohere, OpenAI
 */

const axios = require('axios');

// ==================== Provider Configuration ====================

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: {
      chat: 'gemini-2.5-flash-lite',
      vision: 'gemini-2.5-flash',
      fallback: ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-flash-lite-latest']
    },
    free: true,
    rateLimit: '15 requests/minute'
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: {
      chat: 'llama-3.3-70b-versatile',
      fast: 'llama-3.1-8b-instant'
    },
    free: true,
    rateLimit: '30 requests/minute'
  },
  cohere: {
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    models: {
      chat: 'command-r-plus',
      light: 'command-r'
    },
    free: true,
    rateLimit: '20 requests/minute'
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: {
      chat: 'gpt-4o-mini',
      vision: 'gpt-4o-mini'
    },
    free: false
  }
};

// ==================== Active Provider ====================

let activeProvider = null;
let apiKey = null;

/**
 * تهيئة المزود النشط
 */
function initProvider() {
  // ترتيب الأولوية: Gemini > Groq > Cohere > OpenAI
  if (process.env.GEMINI_API_KEY) {
    activeProvider = 'gemini';
    apiKey = process.env.GEMINI_API_KEY;
    console.log('✅ AI Provider: Google Gemini (مجاني)');
  } else if (process.env.GROQ_API_KEY) {
    activeProvider = 'groq';
    apiKey = process.env.GROQ_API_KEY;
    console.log('✅ AI Provider: Groq (مجاني)');
  } else if (process.env.COHERE_API_KEY) {
    activeProvider = 'cohere';
    apiKey = process.env.COHERE_API_KEY;
    console.log('✅ AI Provider: Cohere (مجاني)');
  } else if (process.env.OPENAI_API_KEY) {
    activeProvider = 'openai';
    apiKey = process.env.OPENAI_API_KEY;
    console.log('✅ AI Provider: OpenAI');
  } else {
    console.log('⚠️  No AI API key found. Using local mode.');
    console.log('💡 للحصول على AI مجاني، أضف أحد المفاتيح التالية في .env:');
    console.log('   - GEMINI_API_KEY (مجاني من Google)');
    console.log('   - GROQ_API_KEY (مجاني وسريع)');
    console.log('   - COHERE_API_KEY (مجاني)');
  }
  
  return { provider: activeProvider, isAvailable: !!activeProvider };
}

// ==================== Chat Completion ====================

/**
 * إرسال رسالة للـ AI
 */
async function chat(messages, options = {}) {
  if (!activeProvider) {
    return { success: false, error: 'No AI provider configured' };
  }

  try {
    switch (activeProvider) {
      case 'gemini':
        return await chatGemini(messages, options);
      case 'groq':
        return await chatGroq(messages, options);
      case 'cohere':
        return await chatCohere(messages, options);
      case 'openai':
        return await chatOpenAI(messages, options);
      default:
        return { success: false, error: 'Unknown provider' };
    }
  } catch (error) {
    console.error(`AI Error (${activeProvider}):`, error.message);
    return { success: false, error: error.message };
  }
}

// ==================== Google Gemini ====================

async function chatGemini(messages, options = {}) {
  // قائمة الموديلات للتجربة
  const modelsToTry = [
    options.model,
    PROVIDERS.gemini.models.chat,
    ...(PROVIDERS.gemini.models.fallback || [])
  ].filter(Boolean);

  // تحويل الرسائل لصيغة Gemini (Gemini لا يدعم system role)
  let systemContent = '';
  const filteredMessages = [];
  
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemContent = msg.content + '\n\n';
    } else {
      filteredMessages.push(msg);
    }
  }
  
  // إضافة system content لأول رسالة user
  const contents = filteredMessages.map((msg, index) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: index === 0 && systemContent ? systemContent + msg.content : msg.content }]
  }));

  const requestBody = {
    contents,
    generationConfig: {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.maxTokens || 1000,
      topP: 0.95
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  // جرب كل موديل حتى ينجح واحد
  let lastError = null;
  for (const model of modelsToTry) {
    try {
      const url = `${PROVIDERS.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
      const response = await axios.post(url, requestBody, { timeout: 30000 });
      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        return {
          success: true,
          content: text,
          provider: 'gemini',
          model
        };
      }
    } catch (error) {
      lastError = error;
      console.log(`⚠️ Gemini model ${model} failed:`, error.response?.data?.error?.message || error.message);
      // استمر للموديل التالي
    }
  }

  // كل الموديلات فشلت
  throw lastError || new Error('All Gemini models failed');
}



/**
 * وصف صورة باستخدام Gemini Vision
 */
async function describeImageGemini(imageBase64, mimeType = 'image/jpeg') {
  const model = PROVIDERS.gemini.models.vision;
  const url = `${PROVIDERS.gemini.baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const response = await axios.post(url, {
    contents: [{
      parts: [
        { text: 'صف هذه الصورة بالعربية في 2-3 جمل. اذكر العناصر الرئيسية والألوان والمشهد.' },
        {
          inline_data: {
            mime_type: mimeType,
            data: imageBase64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 500
    }
  });

  const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  return {
    success: true,
    description: text || '',
    provider: 'gemini'
  };
}

// ==================== Groq ====================

async function chatGroq(messages, options = {}) {
  const model = options.model || PROVIDERS.groq.models.chat;
  
  const response = await axios.post(`${PROVIDERS.groq.baseUrl}/chat/completions`, {
    model,
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 1000
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    content: response.data.choices[0].message.content,
    provider: 'groq',
    model
  };
}

// ==================== Cohere ====================

async function chatCohere(messages, options = {}) {
  const model = options.model || PROVIDERS.cohere.models.chat;
  
  // تحويل الرسائل لصيغة Cohere
  const chatHistory = [];
  let lastUserMessage = '';
  
  for (const msg of messages) {
    if (msg.role === 'user') {
      lastUserMessage = msg.content;
    } else if (msg.role === 'assistant') {
      if (lastUserMessage) {
        chatHistory.push({ role: 'USER', message: lastUserMessage });
        chatHistory.push({ role: 'CHATBOT', message: msg.content });
        lastUserMessage = '';
      }
    }
  }

  const response = await axios.post(`${PROVIDERS.cohere.baseUrl}/chat`, {
    model,
    message: lastUserMessage || messages[messages.length - 1].content,
    chat_history: chatHistory,
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 1000
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    content: response.data.text,
    provider: 'cohere',
    model
  };
}

// ==================== OpenAI ====================

async function chatOpenAI(messages, options = {}) {
  const model = options.model || PROVIDERS.openai.models.chat;
  
  const response = await axios.post(`${PROVIDERS.openai.baseUrl}/chat/completions`, {
    model,
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })),
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 1000
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  return {
    success: true,
    content: response.data.choices[0].message.content,
    provider: 'openai',
    model
  };
}

// ==================== Vision (Image Description) ====================

async function describeImage(imageBase64, mimeType = 'image/jpeg') {
  if (!activeProvider) {
    return { success: false, error: 'No AI provider configured' };
  }

  // Gemini يدعم Vision مجاناً
  if (activeProvider === 'gemini') {
    return await describeImageGemini(imageBase64, mimeType);
  }

  // OpenAI يدعم Vision
  if (activeProvider === 'openai') {
    try {
      const response = await axios.post(`${PROVIDERS.openai.baseUrl}/chat/completions`, {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'صف هذه الصورة بالعربية في 2-3 جمل.' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } }
          ]
        }],
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        description: response.data.choices[0].message.content,
        provider: 'openai'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  return { 
    success: false, 
    error: 'Vision not supported by current provider',
    suggestion: 'استخدم GEMINI_API_KEY لدعم وصف الصور مجاناً'
  };
}

// ==================== Utility Functions ====================

/**
 * الحصول على معلومات المزود النشط
 */
function getProviderInfo() {
  if (!activeProvider) {
    return {
      available: false,
      provider: null,
      features: {
        chat: false,
        vision: false,
        translation: false
      }
    };
  }

  const provider = PROVIDERS[activeProvider];
  return {
    available: true,
    provider: activeProvider,
    name: provider.name,
    free: provider.free,
    rateLimit: provider.rateLimit,
    features: {
      chat: true,
      vision: activeProvider === 'gemini' || activeProvider === 'openai',
      translation: true,
      summarization: true
    }
  };
}

/**
 * قائمة المزودين المتاحين
 */
function getAvailableProviders() {
  return Object.entries(PROVIDERS).map(([key, value]) => ({
    id: key,
    name: value.name,
    free: value.free,
    configured: (key === 'gemini' && process.env.GEMINI_API_KEY) ||
                (key === 'groq' && process.env.GROQ_API_KEY) ||
                (key === 'cohere' && process.env.COHERE_API_KEY) ||
                (key === 'openai' && process.env.OPENAI_API_KEY)
  }));
}

// ==================== Initialize ====================

initProvider();

// ==================== Export ====================

module.exports = {
  chat,
  describeImage,
  getProviderInfo,
  getAvailableProviders,
  initProvider,
  isAvailable: () => !!activeProvider,
  getActiveProvider: () => activeProvider
};
