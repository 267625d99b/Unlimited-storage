/**
 * AI Response Cache
 * تخزين مؤقت لردود المساعد الذكي لتسريع الاستجابة
 */

// كاش الردود
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق
const MAX_CACHE_SIZE = 100;

/**
 * توليد مفتاح الكاش
 */
function generateCacheKey(message, context = {}) {
  const normalizedMsg = message.toLowerCase().trim();
  const contextHash = context.files?.length || 0;
  return `${normalizedMsg}_${contextHash}`;
}

/**
 * الحصول على رد من الكاش
 */
function getCachedResponse(message, context) {
  const key = generateCacheKey(message, context);
  const cached = responseCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      ...cached.response,
      cached: true
    };
  }
  
  // حذف إذا منتهي الصلاحية
  if (cached) {
    responseCache.delete(key);
  }
  
  return null;
}

/**
 * حفظ رد في الكاش
 */
function cacheResponse(message, context, response) {
  // لا نخزن الردود الفاشلة
  if (!response.success) return;
  
  const key = generateCacheKey(message, context);
  
  // تنظيف الكاش إذا امتلأ
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
  }
  
  responseCache.set(key, {
    response,
    timestamp: Date.now()
  });
}

/**
 * مسح الكاش
 */
function clearCache() {
  responseCache.clear();
}

/**
 * إحصائيات الكاش
 */
function getCacheStats() {
  return {
    size: responseCache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL
  };
}

// ==================== ردود سريعة محفوظة ====================

const QUICK_RESPONSES = {
  // تحيات
  greetings: {
    patterns: ['مرحبا', 'هلا', 'السلام', 'أهلا', 'هاي', 'hello', 'hi'],
    response: `👋 أهلاً وسهلاً! أنا مساعدك الذكي لإدارة الملفات.

🎯 **كيف أساعدك؟**
• اسألني عن مساحة التخزين
• ابحث عن ملفاتك
• احصل على نصائح للتنظيم
• تعرف على ملفاتك الكبيرة

💬 فقط اكتب سؤالك وسأساعدك!`
  },
  
  // المساعدة
  help: {
    patterns: ['مساعدة', 'ساعدني', 'help', 'كيف', 'ماذا تفعل', 'شو تقدر'],
    response: `🤖 **أنا مساعدك الذكي للملفات!**

📋 **أستطيع مساعدتك في:**

1️⃣ **التخزين والمساحة**
   • "كم المساحة المستخدمة؟"
   • "تحليل التخزين"

2️⃣ **البحث عن الملفات**
   • "أين ملف [الاسم]؟"
   • "ابحث عن صور"

3️⃣ **تحليل الملفات**
   • "كم عدد ملفاتي؟"
   • "أكبر الملفات"
   • "الملفات المكررة"

4️⃣ **التنظيم**
   • "كيف أنظم ملفاتي؟"
   • "اقترح مجلدات"

💡 جرب أي سؤال وسأساعدك!`
  },
  
  // الشكر
  thanks: {
    patterns: ['شكرا', 'شكراً', 'thanks', 'thank you', 'مشكور'],
    response: `😊 العفو! سعيد بمساعدتك.

💡 هل تحتاج مساعدة في شيء آخر؟`
  },
  
  // الوداع
  bye: {
    patterns: ['باي', 'مع السلامة', 'bye', 'goodbye', 'وداعا'],
    response: `👋 إلى اللقاء! 

🌟 أتمنى لك يوماً سعيداً!
💾 ملفاتك في أمان معنا.`
  }
};

/**
 * الحصول على رد سريع
 */
function getQuickResponse(message) {
  const msg = message.toLowerCase().trim();
  
  for (const [, data] of Object.entries(QUICK_RESPONSES)) {
    if (data.patterns.some(p => msg.includes(p) || msg === p)) {
      return {
        success: true,
        response: data.response,
        method: 'quick',
        cached: true
      };
    }
  }
  
  return null;
}

// ==================== تحليل نوع السؤال ====================

const QUESTION_TYPES = {
  STORAGE: ['مساحة', 'تخزين', 'storage', 'حجم', 'كم باقي', 'المتبقي'],
  COUNT: ['كم ملف', 'عدد', 'كم عندي', 'إحصائيات', 'count'],
  SEARCH: ['أين', 'وين', 'ابحث', 'find', 'where'],
  LARGEST: ['أكبر', 'largest', 'كبير', 'ضخم'],
  ORGANIZE: ['نظم', 'رتب', 'تنظيم', 'organize', 'ترتيب'],
  DUPLICATES: ['مكرر', 'duplicate', 'نسخ', 'متشابه'],
  RECENT: ['أحدث', 'جديد', 'recent', 'آخر'],
  OLD: ['قديم', 'old', 'أقدم'],
  DELETE: ['حذف', 'امسح', 'delete', 'نظف', 'clean']
};

/**
 * تحديد نوع السؤال
 */
function detectQuestionType(message) {
  const msg = message.toLowerCase();
  
  for (const [type, keywords] of Object.entries(QUESTION_TYPES)) {
    if (keywords.some(k => msg.includes(k))) {
      return type;
    }
  }
  
  return 'GENERAL';
}

/**
 * تحسين السؤال بناءً على نوعه
 */
function enhanceQuestion(message, type) {
  const enhancements = {
    STORAGE: 'قدم تحليلاً مفصلاً للتخزين مع نصائح',
    COUNT: 'اعرض إحصائيات شاملة عن الملفات',
    SEARCH: 'ساعد في إيجاد الملف المطلوب',
    LARGEST: 'اعرض أكبر الملفات مع اقتراحات للتنظيف',
    ORGANIZE: 'اقترح هيكل مجلدات منظم',
    DUPLICATES: 'ابحث عن الملفات المكررة',
    RECENT: 'اعرض أحدث الملفات',
    OLD: 'اعرض أقدم الملفات',
    DELETE: 'اقترح ملفات يمكن حذفها بأمان'
  };
  
  return enhancements[type] || '';
}

module.exports = {
  getCachedResponse,
  cacheResponse,
  clearCache,
  getCacheStats,
  getQuickResponse,
  detectQuestionType,
  enhanceQuestion,
  QUESTION_TYPES
};
