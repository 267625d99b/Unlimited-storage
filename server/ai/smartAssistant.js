/**
 * Smart AI Assistant - المساعد الذكي المتقدم
 * مساعد ذكي قوي يفهم ملفاتك ويساعدك في إدارتها
 */

const aiProvider = require('./providers');

// ==================== سياق النظام المتقدم ====================
const SYSTEM_CONTEXT = `أنت مساعد ذكي متخصص في إدارة الملفات والتخزين السحابي. اسمك "مساعد الملفات الذكي".

## قدراتك:
1. **إدارة الملفات**: تساعد في تنظيم، بحث، وإدارة الملفات
2. **تحليل التخزين**: تحلل استخدام المساحة وتقترح تحسينات
3. **البحث الذكي**: تبحث في الملفات بناءً على الاسم، النوع، أو المحتوى
4. **التنظيم**: تقترح هيكل مجلدات مناسب
5. **النصائح**: تقدم نصائح لتحسين إدارة الملفات

## أسلوبك:
- تجيب بالعربية دائماً
- تكون مختصراً ومفيداً
- تستخدم الإيموجي لجعل الردود أوضح
- تقدم معلومات دقيقة بناءً على البيانات المتاحة
- إذا لم تعرف شيئاً، تقول ذلك بوضوح

## تنسيق الردود:
- استخدم النقاط للقوائم
- استخدم الأرقام للخطوات
- اجعل الرد منظماً وسهل القراءة`;

// ==================== المحادثة مع المساعد ====================

/**
 * محادثة مع المساعد الذكي
 */
async function chat(message, context = {}) {
  // بناء سياق غني بالمعلومات
  const contextInfo = buildContextInfo(context);
  const enhancedPrompt = buildEnhancedPrompt(message, context);
  
  // محاولة استخدام AI
  if (aiProvider.isAvailable()) {
    try {
      const result = await aiProvider.chat([
        { role: 'system', content: SYSTEM_CONTEXT + contextInfo },
        { role: 'user', content: enhancedPrompt }
      ], { maxTokens: 800, temperature: 0.7 });

      if (result.success && result.content) {
        return {
          success: true,
          response: result.content,
          method: 'ai',
          provider: result.provider
        };
      }
    } catch (error) {
      console.error('AI Chat Error:', error.message);
    }
  }
  
  // الرد المحلي الذكي
  return getSmartLocalResponse(message, context);
}

/**
 * بناء معلومات السياق
 */
function buildContextInfo(context) {
  let info = '\n\n## معلومات المستخدم الحالية:\n';
  
  if (context.files && context.files.length > 0) {
    const analysis = analyzeFiles(context.files);
    info += `\n### الملفات (${analysis.total} ملف):\n`;
    info += `- الحجم الإجمالي: ${formatSize(analysis.totalSize)}\n`;
    info += `- صور: ${analysis.summary.images}\n`;
    info += `- فيديوهات: ${analysis.summary.videos}\n`;
    info += `- مستندات: ${analysis.summary.documents}\n`;
    info += `- ملفات صوتية: ${analysis.summary.audio}\n`;
    info += `- أخرى: ${analysis.summary.other}\n`;
    
    // أحدث 10 ملفات
    info += '\n### أحدث الملفات:\n';
    context.files.slice(0, 10).forEach(f => {
      info += `- ${f.original_name || f.name} (${formatSize(f.size)})\n`;
    });
  }
  
  if (context.folders && context.folders.length > 0) {
    info += `\n### المجلدات (${context.folders.length}):\n`;
    context.folders.slice(0, 10).forEach(f => {
      info += `- ${f.name}\n`;
    });
  }
  
  if (context.storageInfo) {
    const used = context.storageInfo.used || 0;
    const limit = context.storageInfo.limit || -1;
    info += `\n### التخزين:\n`;
    info += `- المستخدم: ${formatSize(used)}\n`;
    info += `- الحد الأقصى: ${limit > 0 ? formatSize(limit) : 'غير محدود'}\n`;
    if (limit > 0) {
      const percentage = Math.round((used / limit) * 100);
      info += `- النسبة المستخدمة: ${percentage}%\n`;
    }
  }
  
  return info;
}

/**
 * تحسين السؤال
 */
function buildEnhancedPrompt(message, context) {
  const msg = message.toLowerCase();
  
  // إضافة سياق إضافي حسب نوع السؤال
  if (msg.includes('مساحة') || msg.includes('تخزين') || msg.includes('حجم')) {
    return `${message}\n\n(المستخدم يسأل عن التخزين - قدم تحليلاً مفصلاً مع نصائح)`;
  }
  
  if (msg.includes('نظم') || msg.includes('رتب') || msg.includes('تنظيم')) {
    return `${message}\n\n(المستخدم يريد تنظيم ملفاته - اقترح هيكل مجلدات واضح)`;
  }
  
  if (msg.includes('ابحث') || msg.includes('أين') || msg.includes('وين')) {
    return `${message}\n\n(المستخدم يبحث عن ملف - ساعده في إيجاده)`;
  }
  
  if (msg.includes('حذف') || msg.includes('امسح') || msg.includes('نظف')) {
    return `${message}\n\n(المستخدم يريد تنظيف الملفات - اقترح ملفات يمكن حذفها بأمان)`;
  }
  
  return message;
}

/**
 * رد محلي ذكي ومفصل
 */
function getSmartLocalResponse(message, context) {
  const msg = message.toLowerCase();
  const analysis = context.files ? analyzeFiles(context.files) : null;
  
  // ==================== أسئلة التخزين ====================
  if (msg.includes('مساحة') || msg.includes('تخزين') || msg.includes('storage') || msg.includes('حجم')) {
    if (context.storageInfo) {
      const used = context.storageInfo.used || 0;
      const limit = context.storageInfo.limit || -1;
      const usedStr = formatSize(used);
      const limitStr = limit > 0 ? formatSize(limit) : 'غير محدود';
      
      let response = `📊 **تحليل التخزين:**\n\n`;
      response += `💾 المساحة المستخدمة: **${usedStr}**\n`;
      response += `📦 الحد الأقصى: **${limitStr}**\n`;
      
      if (limit > 0) {
        const percentage = Math.round((used / limit) * 100);
        const remaining = limit - used;
        response += `📈 النسبة المستخدمة: **${percentage}%**\n`;
        response += `✨ المتبقي: **${formatSize(remaining)}**\n`;
        
        if (percentage > 80) {
          response += `\n⚠️ **تنبيه:** المساحة تقترب من الامتلاء!\n`;
          response += `💡 نصيحة: احذف الملفات المكررة أو القديمة`;
        }
      }
      
      if (analysis) {
        response += `\n\n📁 **توزيع الملفات:**\n`;
        response += `• صور: ${analysis.summary.images} ملف\n`;
        response += `• فيديوهات: ${analysis.summary.videos} ملف\n`;
        response += `• مستندات: ${analysis.summary.documents} ملف\n`;
        response += `• صوتيات: ${analysis.summary.audio} ملف\n`;
      }
      
      return { success: true, response, method: 'local' };
    }
  }
  
  // ==================== عدد الملفات ====================
  if (msg.includes('كم ملف') || msg.includes('عدد الملفات') || msg.includes('كم عندي')) {
    if (analysis) {
      let response = `📁 **إحصائيات الملفات:**\n\n`;
      response += `📊 إجمالي الملفات: **${analysis.total}** ملف\n`;
      response += `💾 الحجم الإجمالي: **${formatSize(analysis.totalSize)}**\n\n`;
      response += `📂 **التوزيع حسب النوع:**\n`;
      response += `• 🖼️ صور: ${analysis.summary.images}\n`;
      response += `• 🎬 فيديوهات: ${analysis.summary.videos}\n`;
      response += `• 📄 مستندات: ${analysis.summary.documents}\n`;
      response += `• 🎵 صوتيات: ${analysis.summary.audio}\n`;
      response += `• 📦 أخرى: ${analysis.summary.other}\n`;
      
      if (context.folders && context.folders.length > 0) {
        response += `\n📁 عدد المجلدات: **${context.folders.length}**`;
      }
      
      return { success: true, response, method: 'local' };
    }
  }
  
  // ==================== البحث ====================
  if (msg.includes('أين') || msg.includes('وين') || msg.includes('ابحث') || msg.includes('find')) {
    const searchTerms = msg
      .replace(/أين|وين|ابحث عن|ابحث|find|عن/gi, '')
      .trim()
      .split(/\s+/)
      .filter(t => t.length > 1);
    
    if (context.files && searchTerms.length > 0) {
      const found = context.files.filter(f => {
        const name = (f.original_name || f.name || '').toLowerCase();
        return searchTerms.some(term => name.includes(term.toLowerCase()));
      });
      
      if (found.length > 0) {
        let response = `🔍 **نتائج البحث:**\n\n`;
        response += `وجدت **${found.length}** ملف:\n\n`;
        found.slice(0, 10).forEach((f, i) => {
          response += `${i + 1}. 📄 ${f.original_name || f.name}\n`;
          response += `   📦 الحجم: ${formatSize(f.size)}\n`;
        });
        if (found.length > 10) {
          response += `\n... و ${found.length - 10} ملفات أخرى`;
        }
        return { success: true, response, method: 'local' };
      } else {
        return {
          success: true,
          response: `🔍 لم أجد ملفات تطابق "${searchTerms.join(' ')}".\n\n💡 جرب:\n• البحث بكلمات مختلفة\n• التحقق من الإملاء\n• البحث بجزء من الاسم`,
          method: 'local'
        };
      }
    }
  }
  
  // ==================== أكبر الملفات ====================
  if (msg.includes('أكبر') || msg.includes('largest') || msg.includes('كبير')) {
    if (context.files && context.files.length > 0) {
      const sorted = [...context.files].sort((a, b) => (b.size || 0) - (a.size || 0));
      const top = sorted.slice(0, 10);
      
      let response = `📦 **أكبر 10 ملفات:**\n\n`;
      top.forEach((f, i) => {
        const icon = getFileIcon(f.mime_type || f.type);
        response += `${i + 1}. ${icon} ${f.original_name || f.name}\n`;
        response += `   💾 ${formatSize(f.size)}\n`;
      });
      
      const totalTop = top.reduce((sum, f) => sum + (f.size || 0), 0);
      response += `\n📊 هذه الملفات تشغل: **${formatSize(totalTop)}**`;
      
      if (analysis && analysis.totalSize > 0) {
        const percentage = Math.round((totalTop / analysis.totalSize) * 100);
        response += ` (${percentage}% من إجمالي التخزين)`;
      }
      
      return { success: true, response, method: 'local' };
    }
  }
  
  // ==================== التنظيم ====================
  if (msg.includes('نظم') || msg.includes('رتب') || msg.includes('organize') || msg.includes('تنظيم')) {
    let response = `📁 **نصائح لتنظيم ملفاتك:**\n\n`;
    response += `**1. إنشاء مجلدات حسب النوع:**\n`;
    response += `   • 📷 صور ومرئيات\n`;
    response += `   • 📄 مستندات وملفات PDF\n`;
    response += `   • 🎬 فيديوهات\n`;
    response += `   • 🎵 ملفات صوتية\n`;
    response += `   • 💼 ملفات العمل\n\n`;
    
    response += `**2. إنشاء مجلدات حسب المشروع:**\n`;
    response += `   • مجلد لكل مشروع أو موضوع\n`;
    response += `   • مجلدات فرعية للتفاصيل\n\n`;
    
    response += `**3. نصائح إضافية:**\n`;
    response += `   • استخدم أسماء واضحة للملفات\n`;
    response += `   • احذف الملفات المكررة\n`;
    response += `   • أرشف الملفات القديمة\n`;
    response += `   • استخدم الوسوم للتصنيف`;
    
    if (analysis) {
      response += `\n\n📊 **بناءً على ملفاتك:**\n`;
      if (analysis.summary.images > 10) {
        response += `• لديك ${analysis.summary.images} صورة - أنشئ مجلد "صور"\n`;
      }
      if (analysis.summary.documents > 5) {
        response += `• لديك ${analysis.summary.documents} مستند - أنشئ مجلد "مستندات"\n`;
      }
      if (analysis.summary.videos > 3) {
        response += `• لديك ${analysis.summary.videos} فيديو - أنشئ مجلد "فيديوهات"\n`;
      }
    }
    
    return { success: true, response, method: 'local' };
  }
  
  // ==================== المساعدة ====================
  if (msg.includes('مساعدة') || msg.includes('help') || msg.includes('ماذا') || msg.includes('شو')) {
    let response = `👋 **مرحباً! أنا مساعدك الذكي**\n\n`;
    response += `يمكنني مساعدتك في:\n\n`;
    response += `📊 **التخزين:**\n`;
    response += `• "كم مساحة متبقية؟"\n`;
    response += `• "ما هي أكبر الملفات؟"\n\n`;
    response += `🔍 **البحث:**\n`;
    response += `• "أين ملف [الاسم]؟"\n`;
    response += `• "ابحث عن [كلمة]"\n\n`;
    response += `📁 **التنظيم:**\n`;
    response += `• "كيف أنظم ملفاتي؟"\n`;
    response += `• "اقترح تنظيم"\n\n`;
    response += `📈 **الإحصائيات:**\n`;
    response += `• "كم ملف عندي؟"\n`;
    response += `• "حلل ملفاتي"\n\n`;
    response += `💡 جرب أي سؤال وسأحاول مساعدتك!`;
    
    return { success: true, response, method: 'local' };
  }
  
  // ==================== التحية ====================
  if (msg.includes('مرحبا') || msg.includes('هلا') || msg.includes('السلام') || msg.includes('هاي') || msg.includes('hello')) {
    const greetings = [
      `👋 أهلاً وسهلاً! كيف أقدر أساعدك اليوم؟`,
      `🌟 مرحباً! أنا هنا لمساعدتك في إدارة ملفاتك.`,
      `👋 هلا! اسألني أي شيء عن ملفاتك.`
    ];
    return {
      success: true,
      response: greetings[Math.floor(Math.random() * greetings.length)],
      method: 'local'
    };
  }
  
  // ==================== رد افتراضي ذكي ====================
  let response = `🤔 لم أفهم سؤالك بالضبط.\n\n`;
  response += `💡 **جرب أن تسألني:**\n`;
  response += `• "كم مساحة متبقية؟"\n`;
  response += `• "كم ملف عندي؟"\n`;
  response += `• "أين ملف [الاسم]؟"\n`;
  response += `• "ما هي أكبر الملفات؟"\n`;
  response += `• "كيف أنظم ملفاتي؟"\n\n`;
  response += `أو اكتب "مساعدة" لمزيد من الخيارات.`;
  
  return { success: true, response, method: 'local' };
}

// ==================== اقتراحات التنظيم ====================

async function suggestOrganization(files) {
  if (!files || files.length === 0) {
    return { success: false, error: 'لا توجد ملفات' };
  }

  const analysis = analyzeFiles(files);
  
  if (aiProvider.isAvailable()) {
    try {
      const prompt = `لدي ${files.length} ملف في نظام تخزين سحابي:
- صور: ${analysis.summary.images}
- فيديوهات: ${analysis.summary.videos}
- مستندات: ${analysis.summary.documents}
- صوتيات: ${analysis.summary.audio}
- أخرى: ${analysis.summary.other}

اقترح هيكل مجلدات مناسب لتنظيم هذه الملفات بالعربية.`;

      const result = await aiProvider.chat([
        { role: 'user', content: prompt }
      ], { maxTokens: 500, temperature: 0.5 });

      if (result.success) {
        return {
          success: true,
          suggestions: result.content,
          analysis,
          method: 'ai',
          provider: result.provider
        };
      }
    } catch (error) {
      console.error('AI Organization Error:', error.message);
    }
  }

  return {
    success: true,
    suggestions: generateLocalSuggestions(analysis),
    analysis,
    method: 'local'
  };
}

// ==================== تحليل الملفات ====================

function analyzeFiles(files) {
  const byType = {};
  const byExtension = {};
  let totalSize = 0;
  
  if (!files || !Array.isArray(files)) {
    return {
      total: 0,
      totalSize: 0,
      byType: {},
      byExtension: {},
      summary: { images: 0, videos: 0, audio: 0, documents: 0, other: 0 }
    };
  }
  
  files.forEach(file => {
    if (!file) return;
    
    const mimeType = file.mime_type || file.type || '';
    const type = mimeType.split('/')[0] || 'other';
    byType[type] = (byType[type] || 0) + 1;
    
    const fileName = file.original_name || file.name || '';
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : 'unknown';
    byExtension[ext] = (byExtension[ext] || 0) + 1;
    
    totalSize += file.size || 0;
  });

  return {
    total: files.length,
    totalSize,
    byType,
    byExtension,
    summary: {
      images: byType.image || 0,
      videos: byType.video || 0,
      audio: byType.audio || 0,
      documents: (byType.application || 0) + (byType.text || 0),
      other: byType.other || 0
    }
  };
}

function generateLocalSuggestions(analysis) {
  const suggestions = { folders: [], tips: [] };

  if (analysis.summary.images > 5) {
    suggestions.folders.push({ name: '📷 صور', description: `${analysis.summary.images} صورة` });
  }
  if (analysis.summary.videos > 0) {
    suggestions.folders.push({ name: '🎬 فيديوهات', description: `${analysis.summary.videos} فيديو` });
  }
  if (analysis.summary.documents > 5) {
    suggestions.folders.push({ name: '📄 مستندات', description: `${analysis.summary.documents} مستند` });
  }
  if (analysis.summary.audio > 0) {
    suggestions.folders.push({ name: '🎵 صوتيات', description: `${analysis.summary.audio} ملف صوتي` });
  }

  if (analysis.total > 50) {
    suggestions.tips.push('لديك ملفات كثيرة، فكر في إنشاء مجلدات فرعية');
  }
  if (analysis.totalSize > 1024 * 1024 * 1024) {
    suggestions.tips.push('التخزين يتجاوز 1GB، راجع الملفات الكبيرة');
  }

  return suggestions;
}

// ==================== كشف التشابه ====================

function findSimilarFiles(files) {
  if (!files || files.length < 2) return [];
  
  const similar = [];
  const checked = new Set();

  for (let i = 0; i < Math.min(files.length, 100); i++) {
    for (let j = i + 1; j < Math.min(files.length, 100); j++) {
      const key = `${i}-${j}`;
      if (checked.has(key)) continue;
      checked.add(key);

      const similarity = calculateSimilarity(files[i], files[j]);
      if (similarity > 0.7) {
        similar.push({
          file1: files[i],
          file2: files[j],
          similarity: Math.round(similarity * 100),
          reason: getSimilarityReason(files[i], files[j])
        });
      }
    }
  }

  return similar.sort((a, b) => b.similarity - a.similarity);
}

function calculateSimilarity(file1, file2) {
  if (!file1 || !file2) return 0;
  let score = 0;
  
  if (file1.size === file2.size && file1.size > 0) score += 0.5;
  else if (Math.abs((file1.size || 0) - (file2.size || 0)) < 1000) score += 0.2;
  
  const type1 = file1.mime_type || file1.type || '';
  const type2 = file2.mime_type || file2.type || '';
  if (type1 === type2 && type1) score += 0.2;
  
  const name1 = (file1.original_name || file1.name || '').toLowerCase().replace(/\.[^.]+$/, '');
  const name2 = (file2.original_name || file2.name || '').toLowerCase().replace(/\.[^.]+$/, '');
  if (name1 && name2) {
    score += stringSimilarity(name1, name2) * 0.3;
  }
  
  return score;
}

function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function getSimilarityReason(file1, file2) {
  const reasons = [];
  if (file1.size === file2.size) reasons.push('نفس الحجم');
  const type1 = file1.mime_type || file1.type;
  const type2 = file2.mime_type || file2.type;
  if (type1 === type2) reasons.push('نفس النوع');
  return reasons.join('، ') || 'محتوى متشابه';
}

// ==================== مساعدات ====================

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📕';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📘';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📗';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
  return '📄';
}

// ==================== تصدير ====================

module.exports = {
  chat,
  suggestOrganization,
  findSimilarFiles,
  analyzeFiles,
  isAIAvailable: () => aiProvider.isAvailable(),
  getProviderInfo: () => aiProvider.getProviderInfo(),
  getAvailableProviders: () => aiProvider.getAvailableProviders()
};
