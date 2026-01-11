import { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  FiSearch, FiX, FiFilter, FiImage, FiVideo, FiMusic,
  FiFileText, FiPackage, FiStar, FiShare2, FiCalendar,
  FiClock, FiTrash2, FiTrendingUp
} from 'react-icons/fi';
import axios from 'axios';
import { useSearchHistory } from '../hooks/useSearchHistory';

const API = '/api';

// File type options
const FILE_TYPES = [
  { id: 'image', label: 'صور', icon: <FiImage />, color: '#ea4335' },
  { id: 'video', label: 'فيديو', icon: <FiVideo />, color: '#4285f4' },
  { id: 'audio', label: 'صوت', icon: <FiMusic />, color: '#fbbc04' },
  { id: 'document', label: 'مستندات', icon: <FiFileText />, color: '#34a853' },
  { id: 'archive', label: 'أرشيف', icon: <FiPackage />, color: '#9334e6' }
];

// Size presets
const SIZE_PRESETS = [
  { label: 'أي حجم', min: null, max: null },
  { label: 'أقل من 1 MB', min: null, max: 1024 * 1024 },
  { label: '1 - 10 MB', min: 1024 * 1024, max: 10 * 1024 * 1024 },
  { label: '10 - 100 MB', min: 10 * 1024 * 1024, max: 100 * 1024 * 1024 },
  { label: '100 MB - 1 GB', min: 100 * 1024 * 1024, max: 1024 * 1024 * 1024 },
  { label: 'أكثر من 1 GB', min: 1024 * 1024 * 1024, max: null }
];

const AdvancedSearch = memo(function AdvancedSearch({ 
  onSearch, 
  onClose,
  initialQuery = ''
}) {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  
  // سجل البحث
  const { history, addSearch, removeSearch, clearHistory } = useSearchHistory();
  
  // Filters
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [sizePreset, setSizePreset] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sharedOnly, setSharedOnly] = useState(false);
  
  const inputRef = useRef(null);
  const suggestionsTimeout = useRef(null);

  // Load file type stats
  useEffect(() => {
    axios.get(`${API}/search/stats`).then(res => {
      setStats(res.data.stats);
    }).catch(() => {});
  }, []);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Get suggestions
  const fetchSuggestions = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await axios.get(`${API}/search/suggestions`, {
        params: { q: searchQuery }
      });
      setSuggestions(res.data.suggestions || []);
    } catch (e) {
      // Silent fail for suggestions
    }
  }, []);

  // Handle input change with debounced suggestions
  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setQuery(value);
    
    if (suggestionsTimeout.current) {
      clearTimeout(suggestionsTimeout.current);
    }
    
    suggestionsTimeout.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);
  }, [fetchSuggestions]);

  // Toggle file type
  const toggleType = useCallback((typeId) => {
    setSelectedTypes(prev => 
      prev.includes(typeId) 
        ? prev.filter(t => t !== typeId)
        : [...prev, typeId]
    );
  }, []);

  // Check if any filter is active
  const hasActiveFilters = selectedTypes.length > 0 || sizePreset > 0 || 
    dateFrom || dateTo || starredOnly || sharedOnly;

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedTypes([]);
    setSizePreset(0);
    setDateFrom('');
    setDateTo('');
    setStarredOnly(false);
    setSharedOnly(false);
  }, []);

  // Perform search
  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    setLoading(true);
    setShowSuggestions(false);
    setShowHistory(false);

    try {
      const sizeFilter = SIZE_PRESETS[sizePreset];
      
      // حفظ في السجل
      if (query.trim()) {
        addSearch(query.trim(), { types: selectedTypes, sizePreset });
      }
      
      const res = await axios.post(`${API}/search/advanced`, {
        query: query.trim(),
        types: selectedTypes.length > 0 ? selectedTypes : undefined,
        minSize: sizeFilter.min,
        maxSize: sizeFilter.max,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        starred: starredOnly || undefined,
        shared: sharedOnly || undefined,
        limit: 100
      });

      onSearch({
        files: res.data.files || [],
        folders: res.data.folders || [],
        query: query.trim(),
        filters: {
          types: selectedTypes,
          sizePreset,
          dateFrom,
          dateTo,
          starredOnly,
          sharedOnly
        }
      });
    } catch (e) {
      // Error handled by UI
    } finally {
      setLoading(false);
    }
  }, [query, selectedTypes, sizePreset, dateFrom, dateTo, starredOnly, sharedOnly, onSearch, addSearch]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback((suggestion) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    // Trigger search
    setTimeout(() => handleSearch(), 0);
  }, [handleSearch]);

  return (
    <div className="advanced-search-overlay" onClick={onClose}>
      <div className="advanced-search" onClick={(e) => e.stopPropagation()}>
        {/* Search Input */}
        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-wrapper">
            <FiSearch className="search-icon" />
            <input
              ref={inputRef}
              type="text"
              placeholder="البحث في الملفات..."
              value={query}
              onChange={handleInputChange}
              onFocus={() => { setShowSuggestions(true); setShowHistory(true); }}
              className="search-input"
            />
            {query && (
              <button type="button" className="clear-btn" onClick={() => setQuery('')}>
                <FiX />
              </button>
            )}
            <button 
              type="button" 
              className={`filter-toggle ${hasActiveFilters ? 'active' : ''}`}
              onClick={() => setShowFilters(!showFilters)}
            >
              <FiFilter />
              {hasActiveFilters && <span className="filter-badge">{
                selectedTypes.length + (sizePreset > 0 ? 1 : 0) + (dateFrom || dateTo ? 1 : 0) + 
                (starredOnly ? 1 : 0) + (sharedOnly ? 1 : 0)
              }</span>}
            </button>
          </div>

          {/* Suggestions & History Dropdown */}
          {(showSuggestions || showHistory) && (
            <div className="suggestions-dropdown">
              {/* سجل البحث */}
              {history.length > 0 && !query && (
                <div className="search-history-section">
                  <div className="history-header">
                    <span><FiClock /> عمليات البحث السابقة</span>
                    <button 
                      type="button" 
                      className="clear-history-btn"
                      onClick={(e) => { e.stopPropagation(); clearHistory(); }}
                    >
                      <FiTrash2 /> مسح
                    </button>
                  </div>
                  {history.slice(0, 5).map((item) => (
                    <div key={item.id} className="history-item">
                      <button
                        type="button"
                        className="suggestion-item"
                        onClick={() => {
                          setQuery(item.query);
                          if (item.filters?.types) setSelectedTypes(item.filters.types);
                          setShowHistory(false);
                        }}
                      >
                        <FiClock />
                        <span>{item.query}</span>
                      </button>
                      <button 
                        type="button"
                        className="remove-history-btn"
                        onClick={(e) => { e.stopPropagation(); removeSearch(item.id); }}
                      >
                        <FiX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* الاقتراحات */}
              {suggestions.length > 0 && query && (
                <div className="suggestions-section">
                  <div className="suggestions-header">
                    <FiTrendingUp /> اقتراحات
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      className="suggestion-item"
                      onClick={() => handleSuggestionClick(s)}
                    >
                      <FiSearch />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Filters Panel */}
        {showFilters && (
          <div className="filters-panel">
            {/* File Types */}
            <div className="filter-section">
              <h4>نوع الملف</h4>
              <div className="type-filters">
                {FILE_TYPES.map(type => (
                  <button
                    key={type.id}
                    className={`type-btn ${selectedTypes.includes(type.id) ? 'active' : ''}`}
                    onClick={() => toggleType(type.id)}
                    style={{ '--type-color': type.color }}
                  >
                    {type.icon}
                    <span>{type.label}</span>
                    {stats && stats[type.id] && (
                      <small>{stats[type.id].count}</small>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Size Filter */}
            <div className="filter-section">
              <h4>الحجم</h4>
              <div className="size-filters">
                {SIZE_PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    className={`size-btn ${sizePreset === i ? 'active' : ''}`}
                    onClick={() => setSizePreset(i)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Filter */}
            <div className="filter-section">
              <h4><FiCalendar /> التاريخ</h4>
              <div className="date-filters">
                <div className="date-input">
                  <label>من</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="date-input">
                  <label>إلى</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Other Filters */}
            <div className="filter-section">
              <h4>خيارات أخرى</h4>
              <div className="checkbox-filters">
                <label className={starredOnly ? 'active' : ''}>
                  <input
                    type="checkbox"
                    checked={starredOnly}
                    onChange={(e) => setStarredOnly(e.target.checked)}
                  />
                  <FiStar /> المفضلة فقط
                </label>
                <label className={sharedOnly ? 'active' : ''}>
                  <input
                    type="checkbox"
                    checked={sharedOnly}
                    onChange={(e) => setSharedOnly(e.target.checked)}
                  />
                  <FiShare2 /> المشاركة فقط
                </label>
              </div>
            </div>

            {/* Filter Actions */}
            {hasActiveFilters && (
              <div className="filter-actions">
                <button type="button" className="clear-filters" onClick={clearFilters}>
                  مسح الفلاتر
                </button>
              </div>
            )}
          </div>
        )}

        {/* Search Button */}
        <div className="search-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            إلغاء
          </button>
          <button 
            type="submit" 
            className="search-btn"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? 'جاري البحث...' : 'بحث'}
          </button>
        </div>
      </div>
    </div>
  );
});

export default AdvancedSearch;
