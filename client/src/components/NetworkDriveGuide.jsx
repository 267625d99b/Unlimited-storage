/**
 * Network Drive Guide Component
 * دليل ربط التخزين السحابي كقرص شبكي
 */

import { useState, memo } from 'react';
import {
  FiHardDrive,
  FiMonitor,
  FiSmartphone,
  FiCopy,
  FiCheck,
  FiX,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink
} from 'react-icons/fi';
import { SiWindows, SiApple, SiLinux } from 'react-icons/si';

const NetworkDriveGuide = memo(function NetworkDriveGuide({ onClose, serverUrl, embedded = false }) {
  const [activeTab, setActiveTab] = useState('windows');
  const [copied, setCopied] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);

  const webdavUrl = `${serverUrl || window.location.origin}/webdav`;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs = [
    { id: 'windows', label: 'Windows', icon: <SiWindows /> },
    { id: 'mac', label: 'macOS', icon: <SiApple /> },
    { id: 'linux', label: 'Linux', icon: <SiLinux /> },
    { id: 'mobile', label: 'الجوال', icon: <FiSmartphone /> }
  ];

  const windowsSteps = [
    {
      title: 'افتح مستكشف الملفات',
      content: 'اضغط Win + E لفتح مستكشف الملفات (File Explorer)'
    },
    {
      title: 'اختر "هذا الكمبيوتر"',
      content: 'من القائمة الجانبية، اضغط على "هذا الكمبيوتر" (This PC)'
    },
    {
      title: 'تعيين محرك أقراص الشبكة',
      content: 'من شريط الأدوات، اضغط على "..." ثم "تعيين محرك أقراص الشبكة" (Map network drive)',
      image: '🖥️ Computer > ... > Map network drive'
    },
    {
      title: 'أدخل العنوان',
      content: `في حقل "المجلد" (Folder)، أدخل العنوان التالي:`,
      code: webdavUrl
    },
    {
      title: 'أدخل بيانات الدخول',
      content: 'استخدم بريدك الإلكتروني وكلمة المرور الخاصة بحسابك'
    },
    {
      title: 'اكتمل!',
      content: 'الآن سيظهر التخزين السحابي كقرص في جهازك 🎉'
    }
  ];

  const macSteps = [
    {
      title: 'افتح Finder',
      content: 'اضغط Cmd + Space واكتب Finder'
    },
    {
      title: 'الاتصال بالخادم',
      content: 'من القائمة العلوية: Go > Connect to Server (أو Cmd + K)'
    },
    {
      title: 'أدخل العنوان',
      content: 'أدخل العنوان التالي:',
      code: webdavUrl
    },
    {
      title: 'أدخل بيانات الدخول',
      content: 'اختر "Registered User" وأدخل بريدك الإلكتروني وكلمة المرور'
    },
    {
      title: 'اكتمل!',
      content: 'سيظهر التخزين في Finder تحت "Locations" 🎉'
    }
  ];

  const linuxSteps = [
    {
      title: 'باستخدام مدير الملفات',
      content: 'في Nautilus أو Dolphin، اضغط Ctrl + L وأدخل:',
      code: `davs://${new URL(webdavUrl).host}/webdav`
    },
    {
      title: 'أو باستخدام Terminal',
      content: 'ثبت davfs2 ثم:',
      code: `sudo mount -t davfs ${webdavUrl} /mnt/cloud`
    },
    {
      title: 'للتثبيت التلقائي',
      content: 'أضف للـ fstab:',
      code: `${webdavUrl} /mnt/cloud davfs user,noauto 0 0`
    }
  ];

  const mobileSteps = [
    {
      title: 'Android',
      content: 'استخدم تطبيق "Solid Explorer" أو "FX File Explorer" وأضف WebDAV storage',
      code: webdavUrl
    },
    {
      title: 'iOS',
      content: 'استخدم تطبيق "Files" المدمج أو "Documents by Readdle"',
      steps: [
        'افتح التطبيق',
        'اضغط على "Connect to Server"',
        'اختر WebDAV',
        'أدخل العنوان وبيانات الدخول'
      ]
    }
  ];

  const getSteps = () => {
    switch (activeTab) {
      case 'windows':
        return windowsSteps;
      case 'mac':
        return macSteps;
      case 'linux':
        return linuxSteps;
      case 'mobile':
        return mobileSteps;
      default:
        return windowsSteps;
    }
  };

  // Embedded mode content
  const renderContent = () => (
    <>
      {/* URL Box */}
      <div className="webdav-url-box">
        <label>عنوان WebDAV:</label>
        <div className="url-input">
          <input type="text" value={webdavUrl} readOnly />
          <button onClick={() => copyToClipboard(webdavUrl)}>
            {copied ? <FiCheck /> : <FiCopy />}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="guide-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="guide-steps">
        {getSteps().map((step, index) => (
          <div key={index} className="step-item">
            <div className="step-number">{index + 1}</div>
            <div className="step-content">
              <h4>{step.title}</h4>
              <p>{step.content}</p>
              {step.code && (
                <div className="code-block">
                  <code>{step.code}</code>
                  <button onClick={() => copyToClipboard(step.code)}>
                    <FiCopy />
                  </button>
                </div>
              )}
              {step.steps && (
                <ul>
                  {step.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );

  // Embedded mode (inside SettingsModal)
  if (embedded) {
    return (
      <div className="network-drive-embedded">
        <h3><FiHardDrive /> ربط كقرص شبكي (WebDAV)</h3>
        <p className="guide-description">
          يمكنك الوصول لملفاتك من مستكشف الملفات مباشرة
        </p>
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="network-drive-overlay" onClick={onClose}>
      <div className="network-drive-guide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="guide-header">
          <div className="header-icon">
            <FiHardDrive />
          </div>
          <div className="header-text">
            <h2>ربط كقرص شبكي</h2>
            <p>الوصول للملفات مباشرة من جهازك</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        {/* WebDAV URL */}
        <div className="webdav-url-box">
          <label>عنوان WebDAV:</label>
          <div className="url-copy">
            <code>{webdavUrl}</code>
            <button onClick={() => copyToClipboard(webdavUrl)}>
              {copied ? <FiCheck /> : <FiCopy />}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="guide-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`guide-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Steps */}
        <div className="guide-steps">
          {getSteps().map((step, index) => (
            <div
              key={index}
              className={`guide-step ${expandedStep === index ? 'expanded' : ''}`}
            >
              <div
                className="step-header"
                onClick={() =>
                  setExpandedStep(expandedStep === index ? null : index)
                }
              >
                <span className="step-number">{index + 1}</span>
                <span className="step-title">{step.title}</span>
                {step.code && (
                  <span className="step-expand">
                    {expandedStep === index ? (
                      <FiChevronUp />
                    ) : (
                      <FiChevronDown />
                    )}
                  </span>
                )}
              </div>

              <div className="step-content">
                <p>{step.content}</p>

                {step.code && (
                  <div className="step-code">
                    <code>{step.code}</code>
                    <button onClick={() => copyToClipboard(step.code)}>
                      <FiCopy />
                    </button>
                  </div>
                )}

                {step.image && <div className="step-image">{step.image}</div>}

                {step.steps && (
                  <ul className="sub-steps">
                    {step.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="guide-tips">
          <h4>💡 نصائح:</h4>
          <ul>
            <li>استخدم بريدك الإلكتروني وكلمة المرور للدخول</li>
            <li>يمكنك حفظ بيانات الدخول لعدم إدخالها كل مرة</li>
            <li>سرعة النقل تعتمد على سرعة الإنترنت</li>
            <li>الملفات تُحفظ تلقائياً في السحابة</li>
          </ul>
        </div>
      </div>
    </div>
  );
});

export default NetworkDriveGuide;
