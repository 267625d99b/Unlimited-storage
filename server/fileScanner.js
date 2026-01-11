/**
 * File Scanner Module - Virus/Malware Detection
 * وحدة فحص الملفات - كشف الفيروسات والبرمجيات الخبيثة
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============

// Known malicious file signatures (magic bytes)
const MALICIOUS_SIGNATURES = {
  // Executable files
  'MZ': { type: 'executable', risk: 'high', description: 'Windows Executable' },
  '7F454C46': { type: 'executable', risk: 'high', description: 'Linux ELF Executable' },
  'CAFEBABE': { type: 'executable', risk: 'medium', description: 'Java Class File' },
  
  // Scripts
  '#!/': { type: 'script', risk: 'medium', description: 'Shell Script' },
  '<?php': { type: 'script', risk: 'high', description: 'PHP Script' },
  '<%': { type: 'script', risk: 'high', description: 'ASP Script' },
  
  // Archives with potential threats
  'PK\x03\x04': { type: 'archive', risk: 'low', description: 'ZIP Archive' },
};

// Dangerous file patterns
const DANGEROUS_PATTERNS = [
  // Shell commands
  /\b(rm\s+-rf|chmod\s+777|wget\s+|curl\s+.*\|\s*sh|eval\s*\()/gi,
  // SQL injection patterns
  /(\bUNION\b.*\bSELECT\b|\bDROP\b.*\bTABLE\b|\bINSERT\b.*\bINTO\b.*\bVALUES\b)/gi,
  // XSS patterns
  /<script[^>]*>.*<\/script>/gi,
  // Base64 encoded payloads
  /eval\s*\(\s*base64_decode/gi,
  // Reverse shell patterns
  /\b(nc\s+-e|bash\s+-i|\/dev\/tcp\/)/gi,
];

// File extension risk levels
const EXTENSION_RISKS = {
  high: ['.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.pif', '.vbs', '.vbe', 
         '.js', '.jse', '.ws', '.wsf', '.wsc', '.wsh', '.ps1', '.psm1', '.psd1',
         '.dll', '.sys', '.drv', '.ocx', '.cpl', '.sh', '.bash', '.php', '.asp',
         '.aspx', '.jsp', '.cgi', '.pl', '.py', '.rb', '.jar'],
  medium: ['.doc', '.docm', '.xls', '.xlsm', '.ppt', '.pptm', '.pdf', '.rtf',
           '.html', '.htm', '.hta', '.svg', '.swf'],
  low: ['.zip', '.rar', '.7z', '.tar', '.gz', '.iso', '.img']
};

// Maximum file size for content scanning (10MB)
const MAX_SCAN_SIZE = 10 * 1024 * 1024;

// ============ SCANNER CLASS ============

class FileScanner {
  constructor(options = {}) {
    this.options = {
      enableSignatureScan: true,
      enablePatternScan: true,
      enableExtensionCheck: true,
      enableHashCheck: true,
      maxScanSize: options.maxScanSize || MAX_SCAN_SIZE,
      quarantinePath: options.quarantinePath || path.join(__dirname, 'quarantine'),
      ...options
    };
    
    // Ensure quarantine directory exists
    if (!fs.existsSync(this.options.quarantinePath)) {
      fs.mkdirSync(this.options.quarantinePath, { recursive: true });
    }
    
    // Known malicious hashes (would be loaded from database in production)
    this.maliciousHashes = new Set();
  }

  /**
   * Scan a file for potential threats
   * @param {string} filePath - Path to the file
   * @param {string} originalName - Original filename
   * @returns {Promise<ScanResult>}
   */
  async scanFile(filePath, originalName) {
    const result = {
      safe: true,
      threats: [],
      warnings: [],
      riskLevel: 'none',
      scannedAt: new Date().toISOString(),
      fileInfo: {
        path: filePath,
        originalName,
        size: 0,
        hash: null
      }
    };

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        result.safe = false;
        result.threats.push({ type: 'error', message: 'File not found' });
        return result;
      }

      const stats = fs.statSync(filePath);
      result.fileInfo.size = stats.size;

      // 1. Extension check
      if (this.options.enableExtensionCheck) {
        const extResult = this.checkExtension(originalName);
        if (extResult.risk !== 'none') {
          if (extResult.risk === 'high') {
            result.safe = false;
            result.threats.push({
              type: 'dangerous_extension',
              message: `Dangerous file extension: ${extResult.extension}`,
              risk: 'high'
            });
          } else {
            result.warnings.push({
              type: 'suspicious_extension',
              message: `Suspicious file extension: ${extResult.extension}`,
              risk: extResult.risk
            });
          }
        }
      }

      // 2. File signature scan
      if (this.options.enableSignatureScan && stats.size > 0) {
        const sigResult = await this.scanSignature(filePath);
        if (sigResult.detected) {
          if (sigResult.risk === 'high') {
            result.safe = false;
            result.threats.push({
              type: 'malicious_signature',
              message: `Detected: ${sigResult.description}`,
              risk: 'high'
            });
          } else {
            result.warnings.push({
              type: 'suspicious_signature',
              message: `Detected: ${sigResult.description}`,
              risk: sigResult.risk
            });
          }
        }
      }

      // 3. Content pattern scan (for text files under size limit)
      if (this.options.enablePatternScan && stats.size <= this.options.maxScanSize) {
        const patternResult = await this.scanPatterns(filePath, originalName);
        if (patternResult.detected) {
          result.safe = false;
          result.threats.push({
            type: 'malicious_pattern',
            message: `Malicious pattern detected: ${patternResult.pattern}`,
            risk: 'high'
          });
        }
      }

      // 4. Hash check
      if (this.options.enableHashCheck) {
        const hash = await this.calculateHash(filePath);
        result.fileInfo.hash = hash;
        
        if (this.maliciousHashes.has(hash)) {
          result.safe = false;
          result.threats.push({
            type: 'known_malware',
            message: 'File matches known malware signature',
            risk: 'critical'
          });
        }
      }

      // Determine overall risk level
      result.riskLevel = this.calculateRiskLevel(result);

    } catch (error) {
      result.warnings.push({
        type: 'scan_error',
        message: `Scan error: ${error.message}`,
        risk: 'unknown'
      });
    }

    return result;
  }

  /**
   * Check file extension risk
   */
  checkExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    if (EXTENSION_RISKS.high.includes(ext)) {
      return { extension: ext, risk: 'high' };
    }
    if (EXTENSION_RISKS.medium.includes(ext)) {
      return { extension: ext, risk: 'medium' };
    }
    if (EXTENSION_RISKS.low.includes(ext)) {
      return { extension: ext, risk: 'low' };
    }
    
    return { extension: ext, risk: 'none' };
  }

  /**
   * Scan file signature (magic bytes)
   */
  async scanSignature(filePath) {
    return new Promise((resolve) => {
      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(filePath, 'r');
      
      try {
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);
        
        const hexSignature = buffer.toString('hex').toUpperCase();
        const textSignature = buffer.toString('utf8', 0, 8);
        
        // Check hex signatures
        for (const [sig, info] of Object.entries(MALICIOUS_SIGNATURES)) {
          if (hexSignature.startsWith(sig.replace(/[^A-F0-9]/gi, '').toUpperCase())) {
            return resolve({ detected: true, ...info });
          }
          if (textSignature.startsWith(sig)) {
            return resolve({ detected: true, ...info });
          }
        }
        
        resolve({ detected: false });
      } catch (e) {
        fs.closeSync(fd);
        resolve({ detected: false, error: e.message });
      }
    });
  }

  /**
   * Scan file content for malicious patterns
   */
  async scanPatterns(filePath, originalName) {
    // Only scan text-based files
    const textExtensions = ['.txt', '.html', '.htm', '.js', '.php', '.asp', '.jsp', 
                           '.py', '.rb', '.pl', '.sh', '.bat', '.cmd', '.ps1', '.xml',
                           '.json', '.css', '.sql', '.md', '.csv'];
    const ext = path.extname(originalName).toLowerCase();
    
    if (!textExtensions.includes(ext)) {
      return { detected: false };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
          return { detected: true, pattern: pattern.toString() };
        }
      }
      
      return { detected: false };
    } catch (e) {
      return { detected: false, error: e.message };
    }
  }

  /**
   * Calculate file hash (SHA-256)
   */
  async calculateHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Calculate overall risk level
   */
  calculateRiskLevel(result) {
    if (result.threats.some(t => t.risk === 'critical')) return 'critical';
    if (result.threats.some(t => t.risk === 'high')) return 'high';
    if (result.threats.length > 0 || result.warnings.some(w => w.risk === 'high')) return 'medium';
    if (result.warnings.length > 0) return 'low';
    return 'none';
  }

  /**
   * Quarantine a suspicious file
   */
  async quarantineFile(filePath, scanResult) {
    const filename = path.basename(filePath);
    const timestamp = Date.now();
    const quarantineName = `${timestamp}_${filename}.quarantine`;
    const quarantinePath = path.join(this.options.quarantinePath, quarantineName);
    
    // Move file to quarantine
    fs.renameSync(filePath, quarantinePath);
    
    // Save scan result
    const metaPath = quarantinePath + '.meta.json';
    fs.writeFileSync(metaPath, JSON.stringify({
      originalPath: filePath,
      originalName: filename,
      quarantinedAt: new Date().toISOString(),
      scanResult
    }, null, 2));
    
    return quarantinePath;
  }

  /**
   * Add hash to malicious list
   */
  addMaliciousHash(hash) {
    this.maliciousHashes.add(hash);
  }

  /**
   * Load malicious hashes from file
   */
  loadMaliciousHashes(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const hashes = fs.readFileSync(filePath, 'utf8').split('\n').filter(h => h.trim());
        hashes.forEach(h => this.maliciousHashes.add(h.trim()));
        console.log(`📋 Loaded ${hashes.length} malicious hashes`);
      }
    } catch (e) {
      console.error('Error loading malicious hashes:', e);
    }
  }
}

// ============ EXPRESS MIDDLEWARE ============

/**
 * Create file scanning middleware
 */
function createScanMiddleware(options = {}) {
  const scanner = new FileScanner(options);
  
  return async (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }
    
    const files = req.files || [req.file];
    
    for (const file of files) {
      const scanResult = await scanner.scanFile(file.path, file.originalname);
      
      // Attach scan result to file object
      file.scanResult = scanResult;
      
      // Block dangerous files
      if (!scanResult.safe) {
        // Quarantine the file
        await scanner.quarantineFile(file.path, scanResult);
        
        return res.status(400).json({
          error: 'الملف يحتوي على محتوى ضار ولا يمكن رفعه',
          threats: scanResult.threats.map(t => t.message),
          riskLevel: scanResult.riskLevel
        });
      }
      
      // Warn about suspicious files but allow
      if (scanResult.riskLevel === 'medium' || scanResult.riskLevel === 'low') {
        console.warn(`⚠️ Suspicious file uploaded: ${file.originalname}`, scanResult.warnings);
      }
    }
    
    next();
  };
}

module.exports = {
  FileScanner,
  createScanMiddleware,
  EXTENSION_RISKS,
  DANGEROUS_PATTERNS
};
