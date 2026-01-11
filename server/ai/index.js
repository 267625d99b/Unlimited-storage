/**
 * AI Module - نظام الذكاء الاصطناعي
 * يشمل: OCR، التصنيف التلقائي، الملخصات، الترجمة
 */

const { OpenAI } = require('openai');
const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs');

// تهيئة OpenAI (اختياري - يمكن استخدام بدائل مجانية)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ==================== OCR - استخراج النص من الصور ====================

/**
 * استخراج النص من صورة باستخدام Tesseract.js (مجاني)
 */
async function extractTextFromImage(imagePath, language = 'ara+eng') {
  try {
    console.log(`🔍 OCR: Processing ${imagePath}`);
    
    const result = await Tesseract.recognize(imagePath, language, {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`   Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    return {
      success: true,
      text: result.data.text.trim(),
      confidence: result.data.confidence,
      words: result.data.words?.length || 0
    };
  } catch (error) {
    console.error('❌ OCR Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * استخراج النص من PDF (يحتاج تحويل لصور أولاً)
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    // استخدام pdf-parse للـ PDFs النصية
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(pdfBuffer);
    
    return {
      success: true,
      text: data.text.trim(),
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== التصنيف التلقائي ====================

// قواعد التصنيف المحلية (بدون AI)
const classificationRules = {
  // حسب الامتداد
  extensions: {
    images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'],
    videos: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv'],
    audio: ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'],
    documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt'],
    code: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.html', '.css', '.json', '.xml'],
    archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    text: ['.txt', '.md', '.rtf', '.csv']
  },
  
  // حسب الكلمات المفتاحية في الاسم
  keywords: {
    'فاتورة': ['invoice', 'فاتورة', 'bill', 'receipt'],
    'عقد': ['contract', 'عقد', 'agreement', 'اتفاقية'],
    'تقرير': ['report', 'تقرير', 'analysis', 'تحليل'],
    'صورة شخصية': ['selfie', 'portrait', 'profile', 'صورة شخصية'],
    'سيرة ذاتية': ['cv', 'resume', 'سيرة', 'ذاتية'],
    'مشروع': ['project', 'مشروع', 'work', 'عمل'],
    'دراسة': ['study', 'دراسة', 'research', 'بحث', 'homework'],
    'اجتماع': ['meeting', 'اجتماع', 'notes', 'ملاحظات']
  }
};

/**
 * تصنيف ملف تلقائياً بناءً على الاسم والامتداد
 */
function classifyFileLocal(filename, mimeType) {
  const ext = path.extname(filename).toLowerCase();
  const name = filename.toLowerCase();
  const tags = [];
  
  // تصنيف حسب الامتداد
  for (const [category, extensions] of Object.entries(classificationRules.extensions)) {
    if (extensions.includes(ext)) {
      tags.push(category);
      break;
    }
  }
  
  // تصنيف حسب الكلمات المفتاحية
  for (const [tag, keywords] of Object.entries(classificationRules.keywords)) {
    if (keywords.some(kw => name.includes(kw.toLowerCase()))) {
      tags.push(tag);
    }
  }
  
  // تصنيف حسب MIME type
  if (mimeType) {
    if (mimeType.startsWith('image/')) tags.push('صورة');
    else if (mimeType.startsWith('video/')) tags.push('فيديو');
    else if (mimeType.startsWith('audio/')) tags.push('صوت');
    else if (mimeType.includes('pdf')) tags.push('PDF');
  }
  
  return [...new Set(tags)]; // إزالة التكرار
}

/**
 * تصنيف ذكي باستخدام AI (يحتاج OpenAI API)
 */
async function classifyFileAI(filename, content = null) {
  if (!openai) {
    return classifyFileLocal(filename);
  }
  
  try {
    const prompt = content 
      ? `صنف هذا الملف "${filename}" بناءً على محتواه:\n${content.substring(0, 1000)}\n\nأعطني 3-5 وسوم مناسبة بالعربية، مفصولة بفواصل.`
      : `صنف هذا الملف "${filename}" وأعطني 3-5 وسوم مناسبة بالعربية، مفصولة بفواصل.`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.3
    });
    
    const tags = response.choices[0].message.content
      .split(/[,،]/)
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    return tags;
  } catch (error) {
    console.error('❌ AI Classification Error:', error.message);
    return classifyFileLocal(filename);
  }
}

// ==================== الملخصات الذكية ====================

/**
 * تلخيص نص طويل (محلي - بدون AI)
 */
function summarizeTextLocal(text, maxSentences = 3) {
  if (!text || text.length < 100) return text;
  
  // تقسيم لجمل
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/[.!?؟。]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);
  
  if (sentences.length <= maxSentences) {
    return sentences.join('. ') + '.';
  }
  
  // اختيار الجمل الأولى والأخيرة والأطول
  const selected = [
    sentences[0],
    sentences[Math.floor(sentences.length / 2)],
    sentences[sentences.length - 1]
  ];
  
  return [...new Set(selected)].join('. ') + '.';
}

/**
 * تلخيص ذكي باستخدام AI
 */
async function summarizeTextAI(text, language = 'ar') {
  if (!openai) {
    return { success: true, summary: summarizeTextLocal(text), method: 'local' };
  }
  
  try {
    const langPrompt = language === 'ar' 
      ? 'لخص النص التالي في 3-5 جمل بالعربية:'
      : 'Summarize the following text in 3-5 sentences:';
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ 
        role: 'user', 
        content: `${langPrompt}\n\n${text.substring(0, 4000)}`
      }],
      max_tokens: 500,
      temperature: 0.5
    });
    
    return {
      success: true,
      summary: response.choices[0].message.content,
      method: 'ai'
    };
  } catch (error) {
    console.error('❌ AI Summary Error:', error.message);
    return { 
      success: true, 
      summary: summarizeTextLocal(text), 
      method: 'local',
      error: error.message 
    };
  }
}

// ==================== الترجمة ====================

// قاموس بسيط للترجمة المحلية
const basicTranslations = {
  'file': 'ملف',
  'folder': 'مجلد',
  'image': 'صورة',
  'video': 'فيديو',
  'document': 'مستند',
  'download': 'تحميل',
  'upload': 'رفع',
  'delete': 'حذف',
  'share': 'مشاركة'
};

/**
 * ترجمة نص باستخدام AI
 */
async function translateText(text, fromLang = 'auto', toLang = 'ar') {
  if (!openai) {
    return { 
      success: false, 
      error: 'الترجمة تحتاج OpenAI API Key',
      suggestion: 'أضف OPENAI_API_KEY في ملف .env'
    };
  }
  
  try {
    const prompt = fromLang === 'auto'
      ? `ترجم النص التالي إلى ${toLang === 'ar' ? 'العربية' : 'الإنجليزية'}:\n\n${text}`
      : `ترجم من ${fromLang} إلى ${toLang}:\n\n${text}`;
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3
    });
    
    return {
      success: true,
      translation: response.choices[0].message.content,
      fromLang,
      toLang
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== البحث الذكي ====================

/**
 * البحث في النصوص المستخرجة (OCR)
 */
function searchInExtractedText(query, extractedTexts) {
  const results = [];
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/);
  
  for (const item of extractedTexts) {
    const textLower = item.text.toLowerCase();
    
    // حساب درجة التطابق
    let score = 0;
    let matchedWords = 0;
    
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        matchedWords++;
        // عدد مرات الظهور
        const regex = new RegExp(word, 'gi');
        const matches = textLower.match(regex);
        score += matches ? matches.length : 0;
      }
    }
    
    if (matchedWords > 0) {
      // استخراج السياق
      const index = textLower.indexOf(queryWords[0]);
      const start = Math.max(0, index - 50);
      const end = Math.min(item.text.length, index + query.length + 50);
      const context = item.text.substring(start, end);
      
      results.push({
        fileId: item.fileId,
        filename: item.filename,
        score: score * (matchedWords / queryWords.length),
        matchedWords,
        context: `...${context}...`,
        confidence: item.confidence
      });
    }
  }
  
  // ترتيب حسب الدرجة
  return results.sort((a, b) => b.score - a.score);
}

// ==================== تصدير الوحدة ====================

module.exports = {
  // OCR
  extractTextFromImage,
  extractTextFromPDF,
  
  // التصنيف
  classifyFileLocal,
  classifyFileAI,
  
  // الملخصات
  summarizeTextLocal,
  summarizeTextAI,
  
  // الترجمة
  translateText,
  
  // البحث
  searchInExtractedText,
  
  // التحقق من توفر AI
  isAIAvailable: () => !!openai
};
