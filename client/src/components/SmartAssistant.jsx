import React, { useState, useRef, useEffect } from 'react';
import {
  FiMessageCircle, FiSend, FiX, FiCpu, FiLoader,
  FiFolder, FiImage, FiFileText, FiSearch, FiZap,
  FiCopy, FiRefreshCw, FiHardDrive, FiPieChart,
  FiTrendingUp, FiTrash2, FiGrid, FiList, FiStar,
  FiClock, FiShield, FiSettings, FiHelpCircle
} from 'react-icons/fi';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || '';

/**
 * Smart AI Assistant - المساعد الذكي المتقدم
 */
export default function SmartAssistant({ isOpen, onClose, showToast }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [stats, setStats] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // تهيئة المحادثة
  useEffect(() => {
    if (isOpen) {
      fetchAIStatus();
      fetchStats();
      inputRef.current?.focus();
      
      if (messages.length === 0) {
        setMessages([{
          role: 'assistant',
          content: getWelcomeMessage()
        }]);
      }
    }
  }, [isOpen]);

  // التمرير لآخر رسالة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getWelcomeMessage = () => {
    const hour = new Date().getHours();
    let greeting = 'مرحباً';
    if (hour < 12) greeting = 'صباح الخير';
    else if (hour < 18) greeting = 'مساء الخير';
    else greeting = 'مساء النور';
    
    return `${greeting}! 👋\n\nأنا مساعدك الذكي لإدارة الملفات. يمكنني مساعدتك في:\n\n• 📊 تحليل التخزين والمساحة\n• 🔍 البحث عن الملفات\n• 📁 تنظيم ملفاتك\n• 💡 تقديم نصائح ذكية\n\nكيف أقدر أساعدك؟`;
  };

  const fetchAIStatus = async () => {
    try {
      const res = await axios.get(`${API}/api/smart-ai/status`);
      setAiStatus(res.data);
    } catch (error) {
      // Silent fail for AI status
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/api/smart-ai/analyze`);
      setStats(res.data.analysis);
    } catch (error) {
      // Silent fail for stats
    }
  };

  // إرسال رسالة
  const sendMessage = async (text = input) => {
    if (!text.trim() || loading) return;

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API}/api/smart-ai/chat`, { message: text });
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        method: res.data.method,
        provider: res.data.provider
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ عذراً، حدث خطأ. حاول مرة أخرى.',
        error: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  // الإجراءات السريعة
  const quickActions = [
    { icon: FiHardDrive, label: 'المساحة', query: 'كم مساحة متبقية؟', color: '#3b82f6' },
    { icon: FiPieChart, label: 'إحصائيات', query: 'كم ملف عندي؟', color: '#10b981' },
    { icon: FiTrendingUp, label: 'أكبر الملفات', query: 'ما هي أكبر الملفات؟', color: '#f59e0b' },
    { icon: FiFolder, label: 'تنظيم', query: 'كيف أنظم ملفاتي؟', color: '#8b5cf6' },
    { icon: FiSearch, label: 'بحث', query: 'ابحث عن ', color: '#ec4899' },
    { icon: FiHelpCircle, label: 'مساعدة', query: 'مساعدة', color: '#6366f1' },
  ];

  // نسخ الرسالة
  const copyMessage = (content) => {
    navigator.clipboard.writeText(content.replace(/\*\*/g, '').replace(/[•📊🔍📁💡📦💾📈✨⚠️📂🖼️🎬📄🎵👋🌟🤔]/g, ''));
    showToast?.('تم النسخ', 'success');
  };

  // مسح المحادثة
  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: getWelcomeMessage()
    }]);
  };

  // تنسيق الرسالة
  const formatMessage = (content) => {
    if (!content) return null;
    
    return content.split('\n').map((line, i) => {
      // عناوين
      if (line.startsWith('**') && line.endsWith('**')) {
        return <div key={i} className="msg-title">{line.slice(2, -2)}</div>;
      }
      // عناوين مع نقطتين
      if (line.includes(':**')) {
        const parts = line.split(':**');
        return (
          <div key={i} className="msg-section">
            <span className="section-title">{parts[0].replace('**', '')}:</span>
            <span>{parts[1]?.replace('**', '')}</span>
          </div>
        );
      }
      // نقاط
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
        return <div key={i} className="msg-bullet">{line}</div>;
      }
      // أرقام
      if (/^\d+\./.test(line)) {
        return <div key={i} className="msg-numbered">{line}</div>;
      }
      // نص عادي
      if (line.trim()) {
        // تنسيق النص الغامق
        const formatted = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        return <div key={i} className="msg-line" dangerouslySetInnerHTML={{ __html: formatted }} />;
      }
      return <div key={i} className="msg-space" />;
    });
  };

  if (!isOpen) return null;

  return (
    <div className="smart-assistant-overlay" onClick={onClose}>
      <div className="smart-assistant modern" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="assistant-header">
          <div className="header-content">
            <div className="assistant-avatar">
              <FiCpu />
            </div>
            <div className="assistant-info">
              <h3>المساعد الذكي</h3>
              <span className={`status-badge ${aiStatus?.aiEnabled ? 'ai' : 'local'}`}>
                {aiStatus?.aiEnabled ? `${aiStatus.provider?.name || 'AI'}` : 'وضع محلي'}
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={clearChat} title="محادثة جديدة" className="icon-btn">
              <FiRefreshCw />
            </button>
            <button onClick={onClose} title="إغلاق" className="icon-btn close">
              <FiX />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="stats-bar">
            <div className="stat-item">
              <FiFileText />
              <span>{stats.total} ملف</span>
            </div>
            <div className="stat-item">
              <FiImage />
              <span>{stats.summary?.images || 0} صورة</span>
            </div>
            <div className="stat-item">
              <FiFolder />
              <span>{stats.summary?.documents || 0} مستند</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="assistant-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role} ${msg.error ? 'error' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="message-avatar">
                  <FiCpu />
                </div>
              )}
              <div className="message-bubble">
                <div className="message-content">
                  {formatMessage(msg.content)}
                </div>
                {msg.role === 'assistant' && !msg.error && (
                  <div className="message-actions">
                    <button onClick={() => copyMessage(msg.content)} title="نسخ">
                      <FiCopy />
                    </button>
                    {msg.method && (
                      <span className="method-badge">
                        {msg.method === 'ai' ? '🤖' : '💻'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="message assistant">
              <div className="message-avatar">
                <FiCpu />
              </div>
              <div className="message-bubble loading">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="quick-actions-bar">
          {quickActions.map((action, i) => (
            <button
              key={i}
              className="quick-action-chip"
              onClick={() => {
                if (action.query === 'ابحث عن ') {
                  setInput(action.query);
                  inputRef.current?.focus();
                } else {
                  sendMessage(action.query);
                }
              }}
              disabled={loading}
              style={{ '--action-color': action.color }}
            >
              <action.icon />
              <span>{action.label}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="assistant-input-container">
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              placeholder="اكتب سؤالك هنا..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button 
              onClick={() => sendMessage()} 
              disabled={!input.trim() || loading}
              className="send-button"
            >
              {loading ? <FiLoader className="spin" /> : <FiSend />}
            </button>
          </div>
          <div className="input-hint">
            اضغط Enter للإرسال • جرب "كم مساحة متبقية؟"
          </div>
        </div>
      </div>
    </div>
  );
}
