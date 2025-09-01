import React, { useState, useEffect } from 'react';
import { Plus, Upload, Download, Check, X, Search, Edit2, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { 
  loadCatalog, 
  appendVariationToDeviceType, 
  appendVariationToReference,
  seedDefaultData,
  canWriteToSupabase
} from './lib/db.js';

const MedicalInventoryStandardizer = () => {
  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('import');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // Data state
  const [referenceDB, setReferenceDB] = useState({});
  const [nomenclatureSystems, setNomenclatureSystems] = useState([]);
  const [activeNomenclatureSystem, setActiveNomenclatureSystem] = useState('');

  // Import state
  const [importData, setImportData] = useState('');
  const [importedRawData, setImportedRawData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  // Review state
  const [reviewItems, setReviewItems] = useState([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [processedData, setProcessedData] = useState([]);
  const [isAnalyzingData, setIsAnalyzingData] = useState(false);
  const [isStandardizingData, setIsStandardizingData] = useState(false);

  // Admin state
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // Utility functions
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  // Initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        
        const connectivityTest = await canWriteToSupabase();
        
        if (connectivityTest.canWrite) {
          const catalog = await loadCatalog();
          if (catalog.nomenclatureSystems.length === 0) {
            await seedDefaultData();
            const seededCatalog = await loadCatalog();
            setNomenclatureSystems(seededCatalog.nomenclatureSystems);
            setReferenceDB(seededCatalog.referenceDB);
          } else {
            setNomenclatureSystems(catalog.nomenclatureSystems);
            setReferenceDB(catalog.referenceDB);
          }
          
          if (catalog.nomenclatureSystems.length > 0) {
            setActiveNomenclatureSystem(catalog.nomenclatureSystems[0].id);
          }
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load data:', error);
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Process import data
  const processImportData = () => {
    if (!importData.trim()) {
      showToast('Please paste data first', 'error');
      return;
    }

    setIsProcessingImport(true);
    
    try {
      const lines = importData.trim().split('\n');
      const headers = lines[0].split(/\t|\s{2,}/).map(h => h.trim());
      
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(/\t|\s{2,}/).map(v => v.trim());
          const row = { _rowIndex: i - 1 };
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }
      }

      setImportedRawData(data);
      
      const mapping = {};
      headers.forEach(header => {
        const lower = header.toLowerCase();
        if (lower.includes('tipo') || lower.includes('type') || lower.includes('device')) {
          mapping[header] = 'Device Type';
        } else if (lower.includes('marca') || lower.includes('manufacturer')) {
          mapping[header] = 'Manufacturer';
        } else if (lower.includes('modelo') || lower.includes('model')) {
          mapping[header] = 'Model';
        } else {
          mapping[header] = 'Reference Field';
        }
      });
      
      setColumnMapping(mapping);
      setActiveTab('mapping');
      showToast('Data loaded successfully', 'info');
    } catch (error) {
      showToast('Error processing data', 'error');
    } finally {
      setIsProcessingImport(false);
    }
  };

  // Get current field terms
  const getCurrentFieldTerms = (targetField) => {
    if (targetField === 'Device Type') {
      const activeSystem = nomenclatureSystems.find(s => s.id === activeNomenclatureSystem);
      return activeSystem?.deviceTypeTerms || [];
    } else {
      return referenceDB[targetField] || [];
    }
  };

  // Find best matches
  const findBestMatches = (originalValue, targetField) => {
    const fieldTerms = getCurrentFieldTerms(targetField);
    const matches = [];
    const originalLower = originalValue.toLowerCase().trim();
    
    if (originalLower.length < 2) return matches;
    
    for (const term of fieldTerms) {
      let bestScore = 0;
      let bestReason = '';
      
      // Exact matches
      if (term.standard.toLowerCase() === originalLower) {
        matches.push({ term, score: 1.0, reason: 'Exact match' });
        continue;
      }
      
      // Variation matches
      const exactVariation = term.variations.find(v => v.toLowerCase() === originalLower);
      if (exactVariation) {
        matches.push({ term, score: 1.0, reason: 'Exact variation match' });
        continue;
      }
      
      // Contains match
      const standardLower = term.standard.toLowerCase();
      if (standardLower.includes(originalLower) || originalLower.includes(standardLower)) {
        const lengthRatio = Math.min(originalLower.length, standardLower.length) / Math.max(originalLower.length, standardLower.length);
        const score = lengthRatio * 0.8;
        if (score > 0.4) {
          bestScore = Math.max(bestScore, score);
          bestReason = 'Contains match';
        }
      }
      
      if (bestScore > 0.3) {
        matches.push({ term, score: bestScore, reason: bestReason });
      }
    }
    
    return matches.sort((a, b) => b.score - a.score).slice(0, 8);
  };

  // Analyze data
  const analyzeData = () => {
    const mappedColumns = Object.keys(columnMapping).filter(k => columnMapping[k] && columnMapping[k] !== 'Reference Field');
    if (mappedColumns.length === 0) {
      showToast('Please map at least one column', 'error');
      return;
    }

    setIsAnalyzingData(true);

    setTimeout(() => {
      try {
        const reviewQueue = [];

        importedRawData.forEach((row) => {
          Object.entries(columnMapping).forEach(([sourceCol, targetField]) => {
            const originalValue = row[sourceCol];
            if (!originalValue || targetField === 'Reference Field') return;

            const matches = findBestMatches(originalValue, targetField);
            const exactMatch = matches.find(match => match.score === 1.0);
            
            if (!exactMatch) {
              reviewQueue.push({
                rowIndex: row._rowIndex,
                field: targetField,
                originalValue,
                potentialMatches: matches,
                processed: false,
                action: null
              });
            }
          });
        });

        if (reviewQueue.length === 0) {
          standardizeData();
        } else {
          setReviewItems(reviewQueue);
          setCurrentReviewIndex(0);
          setActiveTab('review');
          showToast(`${reviewQueue.length} terms need review`, 'info');
        }
      } catch (error) {
        showToast('Error analyzing data', 'error');
      } finally {
        setIsAnalyzingData(false);
      }
    }, 100);
  };

  // Accept suggestion
  const acceptSuggestion = async (selectedMatch) => {
    const item = reviewItems[currentReviewIndex];
    
    try {
      if (item.field === 'Device Type') {
        await appendVariationToDeviceType(selectedMatch.term.id, item.originalValue);
      } else {
        await appendVariationToReference(selectedMatch.term.id, item.originalValue);
      }
      
      showToast('Variation added successfully');
      
      setReviewItems(prev => prev.map((reviewItem, index) => {
        if (index === currentReviewIndex) {
          return { ...reviewItem, processed: true, action: 'accepted', matchedTerm: selectedMatch };
        }
        return reviewItem;
      }));
      
      moveToNextReview();
    } catch (error) {
      showToast(`Failed to save variation: ${error.message}`, 'error');
    }
  };

  // Move to next review
  const moveToNextReview = () => {
    if (currentReviewIndex < reviewItems.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1);
    } else {
      showToast('All items reviewed. Standardizing...', 'info');
      setTimeout(() => standardizeData(), 100);
    }
  };

  // Standardize data
  const standardizeData = () => {
    setIsStandardizingData(true);
    
    setTimeout(() => {
      try {
        const standardized = importedRawData.map(row => {
          const result = { ...row };
          delete result._rowIndex;
          
          Object.entries(columnMapping).forEach(([sourceCol, targetField]) => {
            const originalValue = row[sourceCol];
            
            if (targetField === 'Reference Field') {
              result[sourceCol] = originalValue || '';
              return;
            }
            
            if (!originalValue) {
              result[`Original ${sourceCol}`] = '';
              result[`Status ${sourceCol}`] = '';
              return;
            }
            
            const fieldTerms = getCurrentFieldTerms(targetField);
            let matchedTerm = null;
            
            for (const term of fieldTerms) {
              if (term.standard.toLowerCase() === originalValue.toLowerCase() ||
                  term.variations.some(v => v.toLowerCase() === originalValue.toLowerCase())) {
                matchedTerm = term;
                break;
              }
            }
            
            result[`Original ${sourceCol}`] = originalValue;
            result[`Standardized ${sourceCol}`] = matchedTerm ? matchedTerm.standard : originalValue;
            
            const reviewItem = reviewItems.find(item => 
              item.field === targetField && item.originalValue === originalValue
            );
            
            if (reviewItem && reviewItem.action === 'accepted') {
              result[`Status ${sourceCol}`] = 'Standardized';
            } else if (matchedTerm) {
              result[`Status ${sourceCol}`] = 'Standardized';
            } else {
              result[`Status ${sourceCol}`] = 'No Match';
            }
          });
          
          return result;
        });
        
        setProcessedData(standardized);
        setReviewItems([]);
        setCurrentReviewIndex(0);
        setActiveTab('export');
        showToast('Data standardized successfully!');
      } catch (error) {
        showToast('Error standardizing data', 'error');
      } finally {
        setIsStandardizingData(false);
      }
    }, 100);
  };

  // Admin functions
  const handleAdminTabClick = () => {
    if (isAdminAuthenticated) {
      setActiveTab('admin');
    } else {
      setShowAdminPasswordModal(true);
    }
  };

  const handleAdminPasswordSubmit = () => {
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'TINCTester';
    
    if (adminPasswordInput === adminPassword) {
      setIsAdminAuthenticated(true);
      setShowAdminPasswordModal(false);
      setActiveTab('admin');
      setAdminPasswordInput('');
      showToast('Admin access granted');
    } else {
      showToast('Invalid password', 'error');
      setAdminPasswordInput('');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Medical Inventory Standardizer</h2>
          <p className="text-gray-600">Initializing database connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Medical Equipment Inventory Standardizer
            </h1>
            <p className="text-lg text-gray-600">
              Streamline your medical equipment data with intelligent nomenclature standardization
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <nav className="flex">
              {[
                { id: 'import', label: 'Import Data', icon: Upload },
                { id: 'mapping', label: 'Map Columns', icon: Search },
                { id: 'review', label: 'Review', icon: Check },
                { id: 'export', label: 'Export Results', icon: Download },
                { id: 'admin', label: 'Admin', icon: Edit2 }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => id === 'admin' ? handleAdminTabClick() : setActiveTab(id)}
                  className={`flex-1 py-6 px-4 text-center transition-all duration-200 ${
                    activeTab === id
                      ? 'bg-blue-500 text-white shadow-lg transform -translate-y-1'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Icon size={24} className={activeTab === id ? 'text-white' : 'text-blue-500'} />
                    <span className="font-medium text-sm">{label}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6 lg:p-8">
            {/* Import Tab */}
            {activeTab === 'import' && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Import Data</h2>
                  <p className="text-lg text-gray-600">Upload your Excel data for standardization</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                  <div className="mb-4">
                    <label className="block text-lg font-semibold text-gray-700 mb-2">
                      Select Nomenclature System
                    </label>
                  </div>
                  <select
                    value={activeNomenclatureSystem}
                    onChange={(e) => setActiveNomenclatureSystem(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                  >
                    {nomenclatureSystems.map(system => (
                      <option key={system.id} value={system.id}>
                        {system.name} - {system.deviceTypeTerms?.length || 0} terms
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                  <label className="block text-lg font-semibold text-gray-700 mb-4">
                    📋 Paste your Excel data here:
                  </label>
                  <textarea
                    className="w-full h-48 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Paste your data here... (headers in first row, tab-separated)"
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                  />
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={processImportData}
                      disabled={isProcessingImport}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      {isProcessingImport ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload size={20} />
                          Load Data
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setImportData('')}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 border border-gray-300"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mapping Tab */}
            {activeTab === 'mapping' && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Map Your Columns</h2>
                  <p className="text-lg text-gray-600">Match your data columns to standardization fields</p>
                </div>

                {importedRawData.length === 0 ? (
                  <div className="text-center py-16">
                    <AlertCircle className="mx-auto text-gray-300 mb-6" size={64} />
                    <h3 className="text-2xl font-semibold text-gray-900 mb-4">No data loaded</h3>
                    <button
                      onClick={() => setActiveTab('import')}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      Go to Import
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Column Mapping</h3>
                    
                    <div className="space-y-4">
                      {Object.keys(importedRawData[0] || {})
                        .filter(key => key !== '_rowIndex')
                        .map(column => (
                          <div key={column} className="flex items-center gap-4">
                            <div className="w-1/3 font-medium text-gray-700">{column}</div>
                            <div className="text-gray-500">→</div>
                            <select
                              value={columnMapping[column] || ''}
                              onChange={(e) => setColumnMapping(prev => ({
                                ...prev,
                                [column]: e.target.value
                              }))}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Skip this column --</option>
                              <option value="Reference Field">Reference Field (preserve as-is)</option>
                              <option value="Device Type">Device Type</option>
                              <option value="Manufacturer">Manufacturer</option>
                              <option value="Model">Model</option>
                            </select>
                          </div>
                        ))}
                    </div>

                    <button
                      onClick={analyzeData}
                      disabled={Object.keys(columnMapping).filter(k => columnMapping[k]).length === 0 || isAnalyzingData}
                      className="mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      {isAnalyzingData ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Search size={20} />
                          Analyze Data
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Review Tab */}
            {activeTab === 'review' && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Review Terms</h2>
                  <p className="text-lg text-gray-600">Review and validate term matches</p>
                </div>

                {reviewItems.length === 0 ? (
                  <div className="text-center py-16">
                    <Check className="mx-auto text-green-500 mb-6" size={64} />
                    <h3 className="text-2xl font-semibold text-gray-900 mb-4">All terms matched!</h3>
                    <p className="text-gray-600 text-lg mb-8">No manual review needed. Your data is ready for export.</p>
                    <button
                      onClick={() => setActiveTab('export')}
                      className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      Go to Export
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Review Progress: {currentReviewIndex + 1} of {reviewItems.length}
                        </h3>
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {Math.round(((currentReviewIndex + 1) / reviewItems.length) * 100)}% Complete
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${((currentReviewIndex + 1) / reviewItems.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    {reviewItems[currentReviewIndex] && (
                      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                        <div className="mb-6">
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm font-medium text-blue-700">Field/Column:</span>
                            </div>
                            <div className="text-lg font-semibold text-blue-900">
                              {reviewItems[currentReviewIndex].field === 'Device Type' 
                                ? `Device Type (${nomenclatureSystems.find(s => s.id === activeNomenclatureSystem)?.name})`
                                : reviewItems[currentReviewIndex].field
                              }
                            </div>
                          </div>
                          
                          <div className="bg-gray-50 rounded-xl p-4 mb-6">
                            <div className="text-sm font-medium text-gray-700 mb-2">Original Value:</div>
                            <div className="text-2xl font-bold text-gray-900">
                              "{reviewItems[currentReviewIndex].originalValue}"
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {reviewItems[currentReviewIndex].potentialMatches?.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                              <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                                🎯 Suggested Matches 
                                <span className="text-sm font-normal text-blue-600">
                                  ({reviewItems[currentReviewIndex].potentialMatches.length} found)
                                </span>
                              </h4>
                              
                              <div className="space-y-2">
                                {reviewItems[currentReviewIndex].potentialMatches
                                  .slice(0, 5)
                                  .map((match, index) => (
                                    <div key={index} className="bg-white border border-blue-200 rounded-lg p-3 flex items-center justify-between hover:border-blue-300 transition-colors">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900">{match.term.standard}</div>
                                        <div className="text-xs text-gray-500 mt-1">
                                          {Math.round(match.score * 100)}% confidence • {match.reason}
                                        </div>
                                        {match.term.variations.length > 0 && (
                                          <div className="text-xs text-gray-400 mt-1">
                                            Variations: {match.term.variations.slice(0, 3).join(', ')}
                                            {match.term.variations.length > 3 && ` +${match.term.variations.length - 3} more`}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => acceptSuggestion(match)}
                                        className="ml-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 text-sm"
                                      >
                                        ✓ Accept
                                      </button>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-3">
                            <button
                              onClick={moveToNextReview}
                              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                            >
                              ⏭️ Skip This Term
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Export Results</h2>
                  <p className="text-lg text-gray-600">Download your standardized data</p>
                </div>

                {processedData.length === 0 ? (
                  <div className="text-center py-16">
                    <AlertCircle className="mx-auto text-gray-300 mb-6" size={64} />
                    <h3 className="text-2xl font-semibold text-gray-900 mb-4">No data to export</h3>
                    <button
                      onClick={() => setActiveTab('import')}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      Go to Import
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-green-50 p-6 rounded-2xl border border-green-200">
                      <div className="flex items-start gap-4">
                        <Check className="text-green-600 mt-1" size={24} />
                        <div>
                          <p className="text-green-800 font-semibold text-lg">
                            Successfully standardized {processedData.length} records!
                          </p>
                          <p className="text-green-700 mt-2">
                            Your data has been processed using the {nomenclatureSystems.find(s => s.id === activeNomenclatureSystem)?.name} nomenclature system.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-center gap-4">
                      <button
                        onClick={() => {
                          const headers = [];
                          const fieldGetters = [];
                          
                          Object.keys(importedRawData[0] || {})
                            .filter(key => key !== '_rowIndex' && columnMapping[key])
                            .forEach(originalCol => {
                              const mapping = columnMapping[originalCol];
                              if (mapping === 'Reference Field') {
                                headers.push(originalCol);
                                fieldGetters.push((row) => row[originalCol] || '');
                              } else {
                                headers.push(`Original ${originalCol}`, `Standardized ${originalCol}`, `Status ${originalCol}`);
                                fieldGetters.push(
                                  (row) => row[`Original ${originalCol}`] || '',
                                  (row) => row[`Standardized ${originalCol}`] || '',
                                  (row) => row[`Status ${originalCol}`] || ''
                                );
                              }
                            });
                           
                          const rows = processedData.map(row => 
                            fieldGetters.map(getter => getter(row))
                          );
                           
                          const clipboardContent = [
                            headers.join('\t'),
                            ...rows.map(row => row.join('\t'))
                          ].join('\n');
                           
                          navigator.clipboard.writeText(clipboardContent).then(() => {
                            showToast('Data copied to clipboard!');
                          }).catch(() => {
                            showToast('Failed to copy to clipboard', 'error');
                          });
                        }}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all duration-200"
                      >
                        <Download size={20} />
                        Copy Standardized Data
                      </button>
                      <button
                        onClick={() => {
                          setImportData('');
                          setImportedRawData([]);
                          setColumnMapping({});
                          setProcessedData([]);
                          setReviewItems([]);
                          setCurrentReviewIndex(0);
                          setActiveTab('import');
                        }}
                        className="bg-gray-100 text-gray-700 px-8 py-3 rounded-xl hover:bg-gray-200 transition-colors duration-200"
                      >
                        Import New Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Admin Tab */}
            {activeTab === 'admin' && (
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">Admin Panel</h2>
                  <p className="text-lg text-gray-600">Manage nomenclature systems and terms</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">System Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium text-blue-800">Nomenclature Systems</h4>
                      <p className="text-blue-600">{nomenclatureSystems.length} systems</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h4 className="font-medium text-green-800">Reference Terms</h4>
                      <p className="text-green-600">
                        {Object.values(referenceDB).reduce((sum, terms) => sum + (terms?.length || 0), 0)} terms
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-gray-600">Admin functionality will be restored in the next update.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Password Modal */}
      {showAdminPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Edit2 className="text-orange-600" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Required</h3>
              <p className="text-gray-600">Enter password: TINCTester</p>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAdminPasswordSubmit()}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter admin password"
                  autoFocus
                />
                {adminPasswordInput && (
                  <button
                    onClick={() => setAdminPasswordInput('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Clear password"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAdminPasswordModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdminPasswordSubmit}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700"
                >
                  Access Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay for Data Processing */}
      {(isAnalyzingData || isStandardizingData) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl text-center">
            <Loader2 className="mx-auto h-16 w-16 animate-spin text-blue-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {isAnalyzingData ? 'Analyzing Data...' : 'Standardizing Data...'}
            </h3>
            <p className="text-gray-600">
              {isAnalyzingData 
                ? 'Processing your data and finding potential matches...' 
                : 'Applying standardization rules to your data...'
              }
            </p>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 px-6 py-4 rounded-2xl shadow-2xl text-white z-50 ${
          toast.type === 'success' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 
          toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
        }`}>
          <div className="flex items-center gap-3">
            {toast.type === 'success' && <Check size={20} />}
            {toast.type === 'error' && <X size={20} />}
            {toast.type === 'info' && <AlertCircle size={20} />}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicalInventoryStandardizer;
