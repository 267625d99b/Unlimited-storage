import { useEffect, useRef, useState } from 'react';
import { FiCopy, FiCheck, FiCode, FiSun, FiMoon } from 'react-icons/fi';
import hljs from 'highlight.js/lib/core';

// Import languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import php from 'highlight.js/lib/languages/php';
import ruby from 'highlight.js/lib/languages/ruby';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rb', ruby);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('kt', kotlin);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('ps1', powershell);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('sass', scss);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('dockerfile', dockerfile);

// File extension to language mapping
const EXT_TO_LANG = {
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'py': 'python',
  'java': 'java',
  'cpp': 'cpp',
  'c': 'c',
  'h': 'cpp',
  'hpp': 'cpp',
  'cs': 'csharp',
  'php': 'php',
  'rb': 'ruby',
  'go': 'go',
  'rs': 'rust',
  'swift': 'swift',
  'kt': 'kotlin',
  'sql': 'sql',
  'sh': 'bash',
  'bash': 'bash',
  'zsh': 'bash',
  'ps1': 'powershell',
  'json': 'json',
  'xml': 'xml',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'less': 'css',
  'md': 'markdown',
  'markdown': 'markdown',
  'yaml': 'yaml',
  'yml': 'yaml',
  'dockerfile': 'dockerfile',
  'env': 'bash',
  'gitignore': 'bash',
  'vue': 'xml',
  'svelte': 'xml'
};

// Get language from filename
function getLanguageFromFilename(filename) {
  const ext = filename.split('.').pop()?.toLowerCase();
  return EXT_TO_LANG[ext] || 'plaintext';
}

// Check if file is code
export function isCodeFile(filename, mimeType) {
  const ext = filename?.split('.').pop()?.toLowerCase();
  const codeExtensions = Object.keys(EXT_TO_LANG);
  
  if (codeExtensions.includes(ext)) return true;
  if (mimeType?.startsWith('text/')) return true;
  if (mimeType === 'application/json') return true;
  if (mimeType === 'application/xml') return true;
  if (mimeType === 'application/javascript') return true;
  
  return false;
}

export default function CodePreview({ code, filename, onClose }) {
  const codeRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  
  const language = getLanguageFromFilename(filename);
  const lines = code?.split('\n') || [];

  useEffect(() => {
    if (codeRef.current && code) {
      try {
        const result = hljs.highlight(code, { language, ignoreIllegals: true });
        codeRef.current.innerHTML = result.value;
      } catch (e) {
        codeRef.current.textContent = code;
      }
    }
  }, [code, language]);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Copy failed
    }
  };

  return (
    <div className={`code-preview ${darkMode ? 'dark' : 'light'}`}>
      {/* Toolbar */}
      <div className="code-toolbar">
        <div className="code-info">
          <FiCode />
          <span className="filename">{filename}</span>
          <span className="language-badge">{language}</span>
          <span className="line-count">{lines.length} سطر</span>
        </div>
        
        <div className="code-actions">
          <button 
            onClick={() => setShowLineNumbers(!showLineNumbers)}
            title={showLineNumbers ? 'إخفاء أرقام الأسطر' : 'إظهار أرقام الأسطر'}
            className={showLineNumbers ? 'active' : ''}
          >
            #
          </button>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            title={darkMode ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {darkMode ? <FiSun /> : <FiMoon />}
          </button>
          <button onClick={copyCode} title="نسخ الكود">
            {copied ? <FiCheck /> : <FiCopy />}
          </button>
        </div>
      </div>

      {/* Code Container */}
      <div className="code-container">
        {showLineNumbers && (
          <div className="line-numbers">
            {lines.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        )}
        <pre className="code-content">
          <code ref={codeRef} className={`hljs language-${language}`}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}
