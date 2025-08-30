import React, { useState, useEffect } from 'react';
import { Plus, Upload, Download, Check, X, Search, Edit2, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { 
  loadCatalog, 
  upsertDeviceTypeTerm, 
  appendVariationToDeviceType, 
  upsertReferenceTerm, 
  appendVariationToReference,
  seedDefaultData,
  canWriteToSupabase,
  deleteDeviceTypeTerm,
  deleteReferenceTerm,
  updateDeviceTypeTerm,
  updateReferenceTerm,
  updateDeviceTypeTermVariations,
  updateNomenclatureSystemTimestamp,
  createNomenclatureSystem,
  updateNomenclatureSystem,
  deleteNomenclatureSystem,
  bulkUploadDeviceTypeTerms
} from './lib/db.js';

const MedicalInventoryStandardizer = () => {
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [supabaseStatus, setSupabaseStatus] = useState({ configured: false, canWrite: false });
  const [isCreatingTerm, setIsCreatingTerm] = useState(false);

  // Default data (fallback)
  const defaultData = {
    'Manufacturer': [
      { id: 4, standard: 'Philips Healthcare', variations: ['Philips', 'Phillips', 'Philips Medical'] },
      { id: 5, standard: 'GE Healthcare', variations: ['GE', 'General Electric', 'GE Medical'] }
    ],
    'Model': [
      { id: 7, standard: 'M3046A', variations: ['M3046', 'M-3046A'] },
      { id: 8, standard: 'CARESCAPE R860', variations: ['R860', 'Carescape R860'] }
    ]
  };

  const defaultSystems = [
    { 
      id: 'umdns', 
      name: 'UMDNS', 
      description: 'Universal Medical Device Nomenclature System',
      lastUpdated: new Date().toISOString(),
      deviceTypeTerms: [
        { id: 1, standard: 'Electrocautery Unit', variations: ['Electrocauterio', 'ESU', 'Cautery Unit'] },
        { id: 2, standard: 'Defibrillator', variations: ['Desfibrilador', 'AED'] }
      ]
    },
    { 
      id: 'gmdn', 
      name: 'GMDN', 
      description: 'Global Medical Device Nomenclature',
      lastUpdated: new Date().toISOString(),
      deviceTypeTerms: [
        { id: 3, standard: 'Ventilator', variations: ['Ventilador', 'Mechanical Ventilator'] }
      ]
    }
  ];

  // State
  const [referenceDB, setReferenceDB] = useState(defaultData);
  const [nomenclatureSystems, setNomenclatureSystems] = useState(defaultSystems);
  const [activeNomenclatureSystem, setActiveNomenclatureSystem] = useState('umdns');
  const [activeTab, setActiveTab] = useState('import');
  const [toast, setToast] = useState({ show: false, message: '', type: '' });
  const [importData, setImportData] = useState('');
  const [processedData, setProcessedData] = useState([]);
  const [importedRawData, setImportedRawData] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [reviewItems, setReviewItems] = useState([]);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [createTerm, setCreateTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Admin states
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminPasswordModal, setShowAdminPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminSelectedSystem, setAdminSelectedSystem] = useState('umdns');
  const [adminSelectedSection, setAdminSelectedSection] = useState('nomenclature');
  const [showAddSystemModal, setShowAddSystemModal] = useState(false);
  const [newSystemData, setNewSystemData] = useState({ name: '', description: '' });
  const [showAddTermModal, setShowAddTermModal] = useState(false);
  const [newTermData, setNewTermData] = useState({ standard: '', variations: '' });
  const [addTermType, setAddTermType] = useState('');
  const [showEditSystemModal, setShowEditSystemModal] = useState(false);
  const [editSystemData, setEditSystemData] = useState({ id: null, name: '', description: '' });
  const [showDeleteSystemModal, setShowDeleteSystemModal] = useState(false);
  const [deleteSystemData, setDeleteSystemData] = useState({ id: null, name: '' });
  const [showEditTermModal, setShowEditTermModal] = useState(false);
  const [editTermData, setEditTermData] = useState({ id: null, standard: '', variations: '', type: '' });
  const [showDeleteTermModal, setShowDeleteTermModal] = useState(false);
  const [deleteTermData, setDeleteTermData] = useState({ id: null, standard: '', type: '' });
  const [showMergeTermModal, setShowMergeTermModal] = useState(false);
  const [mergeTermData, setMergeTermData] = useState({ sourceId: null, sourceName: '', targetId: null, type: '', searchTerm: '' });
  const [showMergeConfirmModal, setShowMergeConfirmModal] = useState(false);
  const [mergeConfirmData, setMergeConfirmData] = useState({ source: null, target: null, type: '' });
  const [adminSearchTerms, setAdminSearchTerms] = useState({
    deviceTypes: '',
    selectedUniversalType: 'Manufacturer',
    universalSearch: ''
  });

  // Bulk upload state
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [bulkUploadType, setBulkUploadType] = useState('');
  const [bulkUploadSystem, setBulkUploadSystem] = useState('');
  const [bulkUploadField, setBulkUploadField] = useState('');
  const [bulkUploadData, setBulkUploadData] = useState('');
  const [bulkUploadPreview, setBulkUploadPreview] = useState([]);
  const [bulkUploadColumnMapping, setBulkUploadColumnMapping] = useState({});

    // Load data from database on component mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Check Supabase configuration and connectivity
        const connectivityTest = await canWriteToSupabase();
        setSupabaseStatus({
          configured: !connectivityTest.error?.includes('environment variables missing'),
          canWrite: connectivityTest.canWrite
        });
        
        if (!connectivityTest.canWrite) {
          console.warn('Supabase not available:', connectivityTest.error);
          // Fallback to hardcoded defaults
          setNomenclatureSystems(defaultSystems);
          setReferenceDB(defaultData);
          setIsLoading(false);
          return;
        }
        
        // Try to load from database
        const catalog = await loadCatalog();
        
        if (catalog.nomenclatureSystems.length === 0) {
          // Database is empty, seed with defaults
          await seedDefaultData();
          const seededCatalog = await loadCatalog();
          setNomenclatureSystems(seededCatalog.nomenclatureSystems);
          setReferenceDB(seededCatalog.referenceDB);
        } else {
          // Use data from database
          setNomenclatureSystems(catalog.nomenclatureSystems);
          setReferenceDB(catalog.referenceDB);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to load data from database:', error);
        setLoadError(error.message);
        
        // Fallback to hardcoded defaults
        setNomenclatureSystems(defaultSystems);
        setReferenceDB(defaultData);
        setIsLoading(false);
        
        if (error.message.includes('environment variables missing')) {
          showToast('Database not configured, using local data', 'info');
        } else {
          showToast('Failed to load from database, using local data', 'error');
        }
      }
    };

    initializeData();
  }, []);

  // Auto-select the first available nomenclature system when data loads
  useEffect(() => {
    if (nomenclatureSystems.length > 0 && !isLoading) {
      // If adminSelectedSystem is not in the loaded systems, default to the first one
      const validSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
      if (!validSystem) {
        setAdminSelectedSystem(nomenclatureSystems[0].id);
        console.log(`Auto-selecting first available system: ${nomenclatureSystems[0].id} (${nomenclatureSystems[0].name})`);
      }
    }
  }, [nomenclatureSystems, isLoading, adminSelectedSystem]);

  // Ensure adminSelectedSystem is always valid
  useEffect(() => {
    if (nomenclatureSystems.length > 0) {
      const validSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
      if (!validSystem) {
        setAdminSelectedSystem(nomenclatureSystems[0].id);
        console.log(`Admin selected system ${adminSelectedSystem} not found, defaulting to ${nomenclatureSystems[0].id}`);
      }
    }
  }, [nomenclatureSystems, adminSelectedSystem]);

  // Utility functions
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 3000);
  };

  const selectActiveSystem = (systemId) => {
    setActiveNomenclatureSystem(systemId);
    const systemName = nomenclatureSystems.find(s => s.id === systemId)?.name;
    showToast(`Active system: ${systemName}`);
  };

  // Import
  const processImportData = () => {
    if (!importData.trim()) {
      showToast('Please paste data first', 'error');
      return;
    }

    try {
      const lines = importData.trim().split('\n');
      
      // First, try to detect if data is tab-separated or space-separated
      const firstLine = lines[0];
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const spaceCount = (firstLine.match(/\s{2,}/g) || []).length;
      
      let separator;
      if (tabCount > 0) {
        // Use tab separation (most reliable for structured data)
        separator = '\t';
        console.log('Using tab separation for data parsing');
      } else if (spaceCount > 0) {
        // Use multiple spaces as separator, but be more careful
        separator = /\s{2,}/;
        console.log('Using space separation for data parsing');
      } else {
        // Fallback to single space if no clear separator pattern
        separator = ' ';
        console.log('Using single space separation as fallback');
      }
      
      const headers = lines[0].split(separator).map(h => h.trim());
      console.log('Detected headers:', headers);
      
      const data = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(separator).map(v => v.trim());
          console.log(`Row ${i} values:`, values);
          
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
    }
  };

  // Get current field terms including newly added ones during the session
  const getCurrentFieldTerms = (targetField) => {
    if (targetField === 'Device Type') {
      const activeSystem = nomenclatureSystems.find(s => s.id === activeNomenclatureSystem);
      const terms = activeSystem?.deviceTypeTerms || [];
      console.log(`🔍 getCurrentFieldTerms("${targetField}"):`, {
        systemFound: !!activeSystem,
        systemId: activeNomenclatureSystem,
        termsCount: terms.length,
        terms: terms.map(t => ({ standard: t.standard, variations: t.variations }))
      });
      return terms;
    } else {
      const terms = referenceDB[targetField] || [];
      console.log(`🔍 getCurrentFieldTerms("${targetField}"):`, {
        termsCount: terms.length,
        terms: terms.map(t => ({ standard: t.standard, variations: t.variations }))
      });
      return terms;
    }
  };

  // Enhanced fuzzy matching with multiple algorithms
  const findBestMatches = (originalValue, targetField) => {
    // Get current field terms (including newly added ones)
    const fieldTerms = getCurrentFieldTerms(targetField);
    const matches = [];
    const originalNormalized = normalizeText(originalValue);
    
    console.log(`🔍 findBestMatches: "${originalValue}" -> "${originalNormalized}" for field "${targetField}"`);
    console.log(`🔍 Available terms:`, fieldTerms.map(t => ({ standard: t.standard, variations: t.variations })));
    
    if (originalNormalized.length < 2) return matches;
    
    for (const term of fieldTerms) {
      let bestScore = 0;
      let bestReason = '';
      
      const termStandardNormalized = normalizeText(term.standard);
      console.log(`🔍 Checking term: "${term.standard}" -> "${termStandardNormalized}"`);
      
      // 1. Exact matches (highest priority)
      if (termStandardNormalized === originalNormalized) {
        console.log(`✅ EXACT MATCH FOUND: "${term.standard}" = "${originalValue}"`);
        matches.push({ term, score: 1.0, reason: 'Exact match' });
        continue;
      }
      
      // 2. Exact variation matches
      const exactVariation = term.variations.find(v => normalizeText(v) === originalNormalized);
      if (exactVariation) {
        matches.push({ term, score: 1.0, reason: 'Exact variation match' });
        continue;
      }
      
      // 3. Contains match (original contains standard or vice versa)
      if (termStandardNormalized.includes(originalNormalized) || originalNormalized.includes(termStandardNormalized)) {
        const lengthRatio = Math.min(originalNormalized.length, termStandardNormalized.length) / Math.max(originalNormalized.length, termStandardNormalized.length);
        const score = lengthRatio * 0.8;
        if (score > 0.4) {
          bestScore = Math.max(bestScore, score);
          bestReason = 'Contains match';
        }
      }
      
      // 4. Fuzzy string similarity using Levenshtein distance approximation
      const similarity = calculateSimilarity(originalNormalized, termStandardNormalized);
      if (similarity > 0.6) {
        const score = similarity * 0.7;
        if (score > bestScore) {
          bestScore = score;
          bestReason = 'Similar term';
        }
      }
      
      // 5. Check variations for fuzzy matches
      for (const variation of term.variations) {
        const variationNormalized = normalizeText(variation);
        const variationSimilarity = calculateSimilarity(originalNormalized, variationNormalized);
        if (variationSimilarity > 0.6) {
          const score = variationSimilarity * 0.65;
          if (score > bestScore) {
            bestScore = score;
            bestReason = 'Similar variation';
          }
        }
      }
      
      // 6. Word-based similarity (for multi-word terms)
      const originalWords = originalNormalized.split(/\s+/);
      const standardWords = termStandardNormalized.split(/\s+/);
      const commonWords = originalWords.filter(word => 
        standardWords.some(sw => calculateSimilarity(word, sw) > 0.7)
      );
      if (commonWords.length > 0) {
        const wordScore = (commonWords.length / Math.max(originalWords.length, standardWords.length)) * 0.6;
        if (wordScore > bestScore) {
          bestScore = wordScore;
          bestReason = 'Word similarity';
        }
      }
      
      if (bestScore > 0.3) {
        matches.push({ term, score: bestScore, reason: bestReason });
      }
    }
    
    return matches.sort((a, b) => b.score - a.score).slice(0, 8); // Show more matches
  };

  // Normalize text for search (remove accents, convert to lowercase)
  const normalizeText = (text) => {
    if (!text) return '';
    return text
      .normalize('NFD') // Decompose characters with accents
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
      .toLowerCase()
      .trim();
  };

  // Calculate string similarity (0-1 scale)
  const calculateSimilarity = (str1, str2) => {
    if (str1 === str2) return 1;
    if (str1.length === 0) return str2.length === 0 ? 1 : 0;
    if (str2.length === 0) return 0;
    
    // Simple similarity based on character overlap and length difference
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    // Count common characters in order
    let commonChars = 0;
    let j = 0;
    for (let i = 0; i < shorter.length && j < longer.length; i++) {
      if (shorter[i] === longer[j]) {
        commonChars++;
        j++;
      } else {
        // Look ahead for better matches
        for (let k = j + 1; k < longer.length; k++) {
          if (shorter[i] === longer[k]) {
            commonChars++;
            j = k + 1;
            break;
          }
        }
      }
    }
    
    const lengthPenalty = 1 - Math.abs(longer.length - shorter.length) / Math.max(longer.length, shorter.length);
    return (commonChars / longer.length) * 0.7 + lengthPenalty * 0.3;
  };

  const analyzeData = () => {
    const mappedColumns = Object.keys(columnMapping).filter(k => columnMapping[k] && columnMapping[k] !== 'Reference Field');
    if (mappedColumns.length === 0) {
      showToast('Please map at least one column', 'error');
      return;
    }

    const reviewQueue = [];

    importedRawData.forEach((row) => {
      Object.entries(columnMapping).forEach(([sourceCol, targetField]) => {
        const originalValue = row[sourceCol];
        if (!originalValue || targetField === 'Reference Field') return;

        const matches = findBestMatches(originalValue, targetField);
        const exactMatch = matches.find(match => match.score === 1.0);
        
        // Debug logging
        console.log(`🔍 Analyzing "${originalValue}" for field "${targetField}":`, {
          matches: matches.length,
          exactMatch: exactMatch ? exactMatch.term.standard : null,
          allMatches: matches.map(m => ({ term: m.term.standard, score: m.score, reason: m.reason }))
        });
        
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
      setCreateTerm(reviewQueue[0]?.originalValue || '');
      setSearchTerm(''); // Reset search term for new review session
      setActiveTab('review');
      showToast(`${reviewQueue.length} terms need review`, 'info');
    }
  };

  // Review
  const acceptSuggestion = async (selectedMatch) => {
    const item = reviewItems[currentReviewIndex];
    
    try {
      let updatedTerms;
      
      if (item.field === 'Device Type') {
        // Persist to database
        console.log(`🔄 Attempting to add variation "${item.originalValue}" to term "${selectedMatch.term.standard}" (ID: ${selectedMatch.term.id})`);
        
        try {
          await appendVariationToDeviceType(selectedMatch.term.id, item.originalValue);
          console.log(`✅ Database update successful for variation "${item.originalValue}"`);
        } catch (dbError) {
          console.error(`❌ Database update failed for variation "${item.originalValue}":`, dbError);
          showToast(`Failed to save variation: ${dbError.message}`, 'error');
          return; // Don't proceed if database update fails
        }
        
                // Update local state and capture the updated terms
        console.log(`🔄 Updating local state for term "${selectedMatch.term.standard}"`);
        console.log(`🔄 Current variations:`, selectedMatch.term.variations);
        console.log(`🔄 Adding new variation: "${item.originalValue}"`);
        
        setNomenclatureSystems(prev => {
          const updated = prev.map(system => 
            system.id === activeNomenclatureSystem
              ? { 
                  ...system, 
                  deviceTypeTerms: system.deviceTypeTerms.map(term => 
                    term.id === selectedMatch.term.id
                      ? { 
                          ...term, 
                          variations: [...new Set([
                            ...term.variations.filter(v => v !== item.originalValue), // Remove if already exists
                            item.originalValue
                          ])]
                        }
                      : term
                  ),
                  lastUpdated: new Date().toISOString()
                }
              : system
          );
          
          // Capture the updated terms for immediate use
          const activeSystem = updated.find(s => s.id === activeNomenclatureSystem);
          updatedTerms = activeSystem?.deviceTypeTerms || [];
          
          console.log(`✅ Local state updated. New variations for term "${selectedMatch.term.standard}":`, 
            updated.find(s => s.id === activeNomenclatureSystem)?.deviceTypeTerms.find(t => t.id === selectedMatch.term.id)?.variations
          );
          
          return updated;
        });
      } else {
        // Persist to database
        console.log(`🔍 About to add variation to reference term:`, {
          termId: selectedMatch.term.id,
          originalValue: item.originalValue,
          originalValueType: typeof item.originalValue,
          originalValueLength: item.originalValue.length,
          originalValueTrimmed: item.originalValue.trim(),
          originalValueSplit: item.originalValue.split(/\s+/)
        });
        
        await appendVariationToReference(selectedMatch.term.id, item.originalValue);
        
        // Update local state and capture the updated terms
        setReferenceDB(prev => {
          const updated = {
            ...prev,
            [item.field]: prev[item.field].map(term =>
              term.id === selectedMatch.term.id
                ? { 
                    ...term, 
                    variations: [...new Set([
                      ...term.variations.filter(v => v !== item.originalValue), // Remove if already exists
                      item.originalValue
                    ])]
                  }
                : term
            )
          };
          
          // Capture the updated terms for immediate use
          updatedTerms = updated[item.field] || [];
          
          return updated;
        });
      }
      
      showToast('Variation added successfully');
      
      // Mark this item as processed with action
      setReviewItems(prev => prev.map((reviewItem, index) => {
        if (index === currentReviewIndex) {
          return { ...reviewItem, processed: true, action: 'accepted', matchedTerm: selectedMatch };
        }
        return reviewItem;
      }));
      
      // Update review items to mark any subsequent items with the same value as already processed
      // This prevents users from having to review the same term multiple times in the same session
      setReviewItems(prev => prev.map((reviewItem, index) => {
        if (index > currentReviewIndex && 
            reviewItem.field === item.field && 
            reviewItem.originalValue === item.originalValue &&
            !reviewItem.processed) {
          return { 
            ...reviewItem, 
            processed: true, 
            action: 'auto-matched', 
            matchedTerm: { term: selectedMatch.term, score: 1.0, reason: 'Auto-matched from accepted suggestion' }
          };
        }
        return reviewItem;
      }));
      
      // Move to next review
      if (currentReviewIndex < reviewItems.length - 1) {
        setCurrentReviewIndex(currentReviewIndex + 1);
        setCreateTerm(reviewItems[currentReviewIndex + 1]?.originalValue || '');
        setSearchTerm(''); // Reset search term for next item
      } else {
        // All items reviewed, reload data from database and then standardize
        showToast('All items reviewed. Reloading data from database...', 'info');
        try {
          const { nomenclatureSystems: freshSystems, referenceDB: freshReferenceDB } = await loadCatalog();
          setNomenclatureSystems(freshSystems);
          setReferenceDB(freshReferenceDB);
          showToast('Data reloaded successfully. Standardizing...', 'success');
          // Use a small delay to ensure state is updated
          setTimeout(() => standardizeData(), 100);
        } catch (error) {
          console.error('Failed to reload data:', error);
          showToast('Failed to reload data, using local state', 'warning');
          standardizeData();
        }
      }
    } catch (error) {
      console.error('Failed to persist variation:', error);
      
      // Show the actual error message
      const errorMessage = error.message || 'Unknown error occurred';
      showToast(`Failed to save variation: ${errorMessage}`, 'error');
      
      // Don't advance to next review on failure
    }
  };

  const addNewStandardTerm = async (newStandardTerm) => {
    const item = reviewItems[currentReviewIndex];
    
    setIsCreatingTerm(true);
    
    try {
      let newTerm;
      
      if (item.field === 'Device Type') {
        // Persist to database
        const termId = await upsertDeviceTypeTerm(activeNomenclatureSystem, newStandardTerm, item.originalValue);
        
        // Update local state with the new term from database
        newTerm = {
          id: termId,
          standard: newStandardTerm,
          variations: [item.originalValue]
        };
        
        setNomenclatureSystems(prev => 
          prev.map(system => 
            system.id === activeNomenclatureSystem
              ? { 
                  ...system, 
                  deviceTypeTerms: [...system.deviceTypeTerms, newTerm],
                  lastUpdated: new Date().toISOString()
                }
              : system
          )
        );
      } else {
        // Persist to database
        const termId = await upsertReferenceTerm(item.field, newStandardTerm, item.originalValue);
        
        // Update local state with the new term from database
        newTerm = {
          id: termId,
          standard: newStandardTerm,
          variations: [item.originalValue]
        };
        
        setReferenceDB(prev => ({
          ...prev,
          [item.field]: [...(prev[item.field] || []), newTerm]
        }));
      }
      
      showToast('New term created successfully');
      
      // Mark this item as processed with action
      setReviewItems(prev => prev.map((reviewItem, index) => {
        if (index === currentReviewIndex) {
          return { ...reviewItem, processed: true, action: 'added', newTerm };
        }
        return reviewItem;
      }));
      
      // Update review items to mark any subsequent items with the same value as already processed
      // This prevents users from having to add the same term multiple times in the same session
      setReviewItems(prev => prev.map((reviewItem, index) => {
        if (index > currentReviewIndex && 
            reviewItem.field === item.field && 
            reviewItem.originalValue === item.originalValue &&
            !reviewItem.processed) {
          return { 
            ...reviewItem, 
            processed: true, 
            action: 'auto-matched', 
            matchedTerm: { term: newTerm, score: 1.0, reason: 'Auto-matched from newly added term' }
          };
        }
        return reviewItem;
      }));
      
      // Move to next review
      if (currentReviewIndex < reviewItems.length - 1) {
        setCurrentReviewIndex(currentReviewIndex + 1);
        setCreateTerm(reviewItems[currentReviewIndex + 1]?.originalValue || '');
        setSearchTerm(''); // Reset search term for next item
      } else {
        // All items reviewed, reload data from database and then standardize
        showToast('All items reviewed. Reloading data from database...', 'info');
        try {
          const { nomenclatureSystems: freshSystems, referenceDB: freshReferenceDB } = await loadCatalog();
          setNomenclatureSystems(freshSystems);
          setReferenceDB(freshReferenceDB);
          showToast('Data reloaded successfully. Standardizing...', 'success');
          // Use a small delay to ensure state is updated
          setTimeout(() => standardizeData(), 100);
        } catch (error) {
          console.error('Failed to reload data:', error);
          showToast('Failed to reload data, using local state', 'warning');
          standardizeData();
        }
      }
      
    } catch (error) {
      console.error('Failed to create new term:', error);
      
      // Show the actual error message instead of generic text
      const errorMessage = error.message || 'Unknown error occurred';
      showToast(`Failed to create new term: ${errorMessage}`, 'error');
      
      // Don't advance to next review on failure - keep user on same item
    } finally {
      setIsCreatingTerm(false);
    }
  };

  const moveToNextReview = async () => {
    // Mark current item as skipped if it wasn't already processed
    setReviewItems(prev => prev.map((reviewItem, index) => {
      if (index === currentReviewIndex && !reviewItem.processed) {
        return { ...reviewItem, processed: true, action: 'skipped' };
      }
      return reviewItem;
    }));
    
    // Move to next review
    if (currentReviewIndex < reviewItems.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1);
      setCreateTerm(reviewItems[currentReviewIndex + 1]?.originalValue || '');
      setSearchTerm(''); // Reset search term for next item
    } else {
      // All items reviewed, reload data from database and then standardize
      showToast('All items reviewed. Reloading data from database...', 'info');
      try {
        const { nomenclatureSystems: freshSystems, referenceDB: freshReferenceDB } = await loadCatalog();
        setNomenclatureSystems(freshSystems);
        setReferenceDB(freshReferenceDB);
        showToast('Data reloaded successfully. Standardizing...', 'success');
        // Use a small delay to ensure state is updated
        setTimeout(() => standardizeData(), 100);
      } catch (error) {
        console.error('Failed to reload data:', error);
        showToast('Failed to reload data, using local state', 'warning');
        standardizeData();
      }
    }
  };

  const standardizeData = () => {
    
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
          result[`Standardized ${sourceCol}`] = '';
          return;
        }
        
        // Get current field terms (including newly added ones)
        const fieldTerms = getCurrentFieldTerms(targetField);
        
        let matchedTerm = null;
        for (const term of fieldTerms) {
          if (normalizeText(term.standard) === normalizeText(originalValue) ||
              term.variations.some(v => normalizeText(v) === normalizeText(originalValue))) {
            matchedTerm = term;
            break;
          }
        }
        
        result[`Original ${sourceCol}`] = originalValue;
        result[`Standardized ${sourceCol}`] = matchedTerm ? matchedTerm.standard : originalValue;
        
        // Add status information based on review actions
        const reviewItem = reviewItems.find(item => 
          item.field === targetField && item.originalValue === originalValue
        );
        
        if (reviewItem && reviewItem.action === 'skipped') {
          result[`Status ${sourceCol}`] = 'Skipped';
        } else if (reviewItem && reviewItem.action === 'added') {
          result[`Status ${sourceCol}`] = 'Added as New Term';
        } else if (reviewItem && reviewItem.action === 'accepted') {
          result[`Status ${sourceCol}`] = 'Standardized';
        } else if (reviewItem && reviewItem.action === 'auto-matched') {
          result[`Status ${sourceCol}`] = 'Auto-Matched';
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

  const handleAddSystemClick = () => {
    setNewSystemData({ name: '', description: '' });
    setShowAddSystemModal(true);
  };

  const handleAddSystemSubmit = async () => {
    if (!newSystemData.name.trim()) {
      showToast('System name required', 'error');
      return;
    }

    try {
      // Create in database
      const newSystem = await createNomenclatureSystem(
        newSystemData.name.trim(),
        newSystemData.description.trim()
      );

      // Refresh data from database
      const { nomenclatureSystems: freshSystems } = await loadCatalog();
      setNomenclatureSystems(freshSystems);
      
      setAdminSelectedSystem(newSystem.id);
      setShowAddSystemModal(false);
      setNewSystemData({ name: '', description: '' });
      showToast(`System "${newSystem.name}" created!`, 'success');
    } catch (error) {
      console.error('Error creating system:', error);
      showToast(`Error creating system: ${error.message}`, 'error');
    }
  };

  const handleAddTermClick = (type) => {
    setAddTermType(type);
    setNewTermData({ standard: '', variations: '' });
    setShowAddTermModal(true);
  };

  const handleAddTermSubmit = async () => {
    if (!newTermData.standard.trim()) {
      showToast('Term name required', 'error');
      return;
    }

    try {
      const variations = newTermData.variations
        .split(',')
        .map(v => v.trim())
        .filter(v => v);

      if (addTermType === 'deviceType') {
        // Add to database with all variations
        const termId = await upsertDeviceTypeTerm(adminSelectedSystem, newTermData.standard.trim(), null);
        
        // If we have variations, add them one by one
        if (variations.length > 0) {
          for (const variation of variations) {
            if (variation.trim()) {
              await appendVariationToDeviceType(termId, variation.trim());
            }
          }
        }
        
        // Refresh data from database
        const { nomenclatureSystems: freshSystems } = await loadCatalog();
        setNomenclatureSystems(freshSystems);
        
        showToast(`${newTermData.standard.trim()} added to ${nomenclatureSystems.find(s => s.id === adminSelectedSystem)?.name}!`, 'success');
      } else {
        // Add to reference database with all variations
        const field = addTermType === 'manufacturer' ? 'Manufacturer' : 'Model';
        const termId = await upsertReferenceTerm(field, newTermData.standard.trim(), null);
        
        // If we have variations, add them one by one
        if (variations.length > 0) {
          for (const variation of variations) {
            if (variation.trim()) {
              await appendVariationToReference(termId, variation.trim());
            }
          }
        }
        
        // Refresh data from database
        const { referenceDB: freshReferenceDB } = await loadCatalog();
        setReferenceDB(freshReferenceDB);
        
        showToast(`${newTermData.standard.trim()} added to ${field}!`, 'success');
      }

      setShowAddTermModal(false);
      setNewTermData({ standard: '', variations: '' });
      setAddTermType('');
    } catch (error) {
      console.error('Error adding term:', error);
      showToast(`Error adding term: ${error.message}`, 'error');
    }
  };

  // Bulk upload functions
  const handleBulkUploadClick = () => {
    setShowBulkUploadModal(true);
  };

  const handleBulkUploadDataChange = (data) => {
    setBulkUploadData(data);
    
    if (data.trim()) {
      try {
        const lines = data.trim().split('\n');
        const headers = lines[0].split(/\t/).map(h => h.trim());
        
        // Auto-map columns based on content
        const mapping = {};
        headers.forEach(header => {
          const lower = header.toLowerCase();
          if (lower.includes('standard') || lower.includes('term') || lower.includes('name')) {
            mapping[header] = 'standard';
          } else if (lower.includes('variation') || lower.includes('alias') || lower.includes('also')) {
            mapping[header] = 'variations';
          } else {
            mapping[header] = 'standard'; // default
          }
        });
        
        setBulkUploadColumnMapping(mapping);
        
        // Preview first few rows
        const preview = [];
        for (let i = 1; i < Math.min(6, lines.length); i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(/\t/).map(v => v.trim());
            const row = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            preview.push(row);
          }
        }
        setBulkUploadPreview(preview);
      } catch (error) {
        console.error('Error processing bulk upload data:', error);
        showToast('Error processing data', 'error');
      }
    } else {
      setBulkUploadPreview([]);
      setBulkUploadColumnMapping({});
    }
  };

  const handleBulkUploadSubmit = async () => {
    if (!bulkUploadData.trim()) {
      showToast('Please paste data first', 'error');
      return;
    }

    try {
      const lines = bulkUploadData.trim().split('\n');
      const headers = lines[0].split(/\t/).map(h => h.trim());
      
      const terms = [];
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          const values = lines[i].split(/\t/).map(v => v.trim());
          const standard = values[headers.findIndex(h => bulkUploadColumnMapping[h] === 'standard')] || '';
          const variations = values[headers.findIndex(h => bulkUploadColumnMapping[h] === 'variations')] || '';
          
          if (standard.trim()) {
            const term = {
              id: Date.now() + i,
              standard: standard.trim(),
              variations: variations ? variations.split(',').map(v => v.trim()).filter(v => v) : []
            };
            terms.push(term);
          }
        }
      }

      if (terms.length === 0) {
        showToast('No valid terms found in data', 'error');
        return;
      }

      // Add terms based on type
      if (bulkUploadType === 'deviceType') {
        // Use database function for bulk upload
        const results = await bulkUploadDeviceTypeTerms(bulkUploadSystem, terms);
        
        if (results.errors.length > 0) {
          showToast(`${results.created} terms created, ${results.updated} updated, but ${results.errors.length} had errors`, 'warning');
        } else {
          showToast(`${results.created} terms created, ${results.updated} updated successfully!`, 'success');
        }
        
        // Refresh data from database
        const { nomenclatureSystems: freshSystems } = await loadCatalog();
        setNomenclatureSystems(freshSystems);
      } else {
        // Add reference terms one by one
        let created = 0;
        let updated = 0;
        let errors = 0;
        
        for (const term of terms) {
          try {
            const termId = await upsertReferenceTerm(bulkUploadField, term.standard, null);
            
            // Add variations one by one
            if (term.variations && term.variations.length > 0) {
              for (const variation of term.variations) {
                if (variation.trim()) {
                  await appendVariationToReference(termId, variation.trim());
                }
              }
              updated++;
            } else {
              created++;
            }
          } catch (error) {
            console.error(`Error adding term ${term.standard}:`, error);
            errors++;
          }
        }
        
        if (errors > 0) {
          showToast(`${created} terms created, ${updated} updated, but ${errors} had errors`, 'warning');
        } else {
          showToast(`${created} terms created, ${updated} updated successfully!`, 'success');
        }
        
        // Refresh data from database
        const { referenceDB: freshReferenceDB } = await loadCatalog();
        setReferenceDB(freshReferenceDB);
      }

      setShowBulkUploadModal(false);
      setBulkUploadData('');
      setBulkUploadPreview([]);
      setBulkUploadColumnMapping({});
    } catch (error) {
      console.error('Error submitting bulk upload:', error);
      showToast(`Error adding terms: ${error.message}`, 'error');
    }
  };

  // Edit system functions
  const handleEditSystemClick = (system) => {
    setEditSystemData({
      id: system.id,
      name: system.name,
      description: system.description
    });
    setShowEditSystemModal(true);
  };

  const handleEditSystemSubmit = async () => {
    if (!editSystemData.name.trim()) {
      showToast('System name required', 'error');
      return;
    }

    try {
      const nameExists = nomenclatureSystems.some(system => 
        system.id !== editSystemData.id && 
        system.name.toLowerCase() === editSystemData.name.trim().toLowerCase()
      );

      if (nameExists) {
        showToast('System name already exists', 'error');
        return;
      }

      // Update in database
      await updateNomenclatureSystem(
        editSystemData.id,
        editSystemData.name.trim(),
        editSystemData.description.trim()
      );

      // Refresh data from database
      const { nomenclatureSystems: freshSystems } = await loadCatalog();
      setNomenclatureSystems(freshSystems);

      setShowEditSystemModal(false);
      setEditSystemData({ id: null, name: '', description: '' });
      showToast(`System "${editSystemData.name}" updated!`, 'success');
    } catch (error) {
      console.error('Error updating system:', error);
      showToast(`Error updating system: ${error.message}`, 'error');
    }
  };

  // Delete system functions
  const handleDeleteSystemClick = (system) => {
    setDeleteSystemData({
      id: system.id,
      name: system.name
    });
    setShowDeleteSystemModal(true);
  };

  const handleDeleteSystemConfirm = async () => {
    try {
      // Delete from database
      await deleteNomenclatureSystem(deleteSystemData.id);

      // Handle system selection updates
    if (deleteSystemData.id === adminSelectedSystem) {
      const remainingSystems = nomenclatureSystems.filter(s => s.id !== deleteSystemData.id);
      if (remainingSystems.length > 0) {
        setAdminSelectedSystem(remainingSystems[0].id);
      }
    }

    if (deleteSystemData.id === activeNomenclatureSystem) {
      const remainingSystems = nomenclatureSystems.filter(s => s.id !== deleteSystemData.id);
      if (remainingSystems.length > 0) {
        setActiveNomenclatureSystem(remainingSystems[0].id);
      }
    }

      // Refresh data from database
      const { nomenclatureSystems: freshSystems } = await loadCatalog();
      setNomenclatureSystems(freshSystems);

      setShowDeleteSystemModal(false);
      setDeleteSystemData({ id: null, name: '' });
      showToast(`System "${deleteSystemData.name}" deleted!`, 'success');
    } catch (error) {
      console.error('Error deleting system:', error);
      showToast(`Error deleting system: ${error.message}`, 'error');
    }
  };

  // Term management functions
  const handleEditTermClick = (term, type) => {
    console.log('Edit term clicked:', { term, type });
    setEditTermData({
      id: term.id,
      standard: term.standard,
      variations: term.variations.join(', '),
      type: type
    });
    setShowEditTermModal(true);
  };

  const handleEditTermSubmit = async () => {
    console.log('Edit term submit:', editTermData);
    
    if (!editTermData.standard.trim()) {
      showToast('Term name required', 'error');
      return;
    }

    try {
      const variations = editTermData.variations
        .split(',')
        .map(v => v.trim())
        .filter(v => v);

      console.log('Processing edit for type:', editTermData.type, 'with variations:', variations);

      if (editTermData.type === 'deviceType') {
        // Update in database
        await updateDeviceTypeTerm(editTermData.id, editTermData.standard.trim(), variations);
        
        // Refresh data from database
        const { nomenclatureSystems: freshSystems } = await loadCatalog();
        setNomenclatureSystems(freshSystems);
        
        showToast(`${editTermData.standard} updated!`, 'success');
      } else if (editTermData.type === 'manufacturer') {
        // Update in reference database
        await updateReferenceTerm(editTermData.id, editTermData.standard.trim(), variations);
        
        // Refresh data from database
        const { referenceDB: freshReferenceDB } = await loadCatalog();
        setReferenceDB(freshReferenceDB);
        
        showToast(`${editTermData.standard} updated!`, 'success');
      } else if (editTermData.type === 'model') {
        // Update in reference database
        await updateReferenceTerm(editTermData.id, editTermData.standard.trim(), variations);
        
        // Refresh data from database
        const { referenceDB: freshReferenceDB } = await loadCatalog();
        setReferenceDB(freshReferenceDB);
        
        showToast(`${editTermData.standard} updated!`, 'success');
      }

      setShowEditTermModal(false);
      setEditTermData({ id: null, standard: '', variations: '', type: '' });
    } catch (error) {
      console.error('Error updating term:', error);
      showToast(`Error updating term: ${error.message}`, 'error');
    }
  };

  const handleDeleteTermClick = (term, type) => {
    setDeleteTermData({
      id: term.id,
      standard: term.standard,
      type: type
    });
    setShowDeleteTermModal(true);
  };

  const handleDeleteTermConfirm = async () => {
    const { id, type } = deleteTermData;
    
    try {
      if (type === 'deviceType') {
        // Delete from database
        await deleteDeviceTypeTerm(id);
        
        // Refresh data from database
        const { nomenclatureSystems: freshSystems } = await loadCatalog();
        setNomenclatureSystems(freshSystems);
        
        showToast(`${deleteTermData.standard} deleted successfully!`, 'success');
      } else if (type === 'manufacturer') {
        // Delete from reference database
        await deleteReferenceTerm(id);
        
        // Refresh data from database
        const { referenceDB: freshReferenceDB } = await loadCatalog();
        setReferenceDB(freshReferenceDB);
        
        showToast(`${deleteTermData.standard} deleted successfully!`, 'success');
      } else if (type === 'model') {
        // Delete from reference database
        await deleteReferenceTerm(id);
        
        // Refresh data from database
        const { referenceDB: freshReferenceDB } = await loadCatalog();
        setReferenceDB(freshReferenceDB);
        
        showToast(`${deleteTermData.standard} deleted successfully!`, 'success');
      }

      setShowDeleteTermModal(false);
      setDeleteTermData({ id: null, standard: '', type: '' });
    } catch (error) {
      console.error('Error deleting term:', error);
      showToast(`Error deleting term: ${error.message}`, 'error');
    }
  };

  const handleMergeTermClick = (term, type) => {
    setMergeTermData({
      sourceId: term.id,
      sourceName: term.standard,
      targetId: null,
      type: type,
      searchTerm: ''
    });
    setShowMergeTermModal(true);
  };

  const handleMergeTermSubmit = () => {
    if (!mergeTermData.targetId) {
      showToast('Please select a term to merge with', 'error');
      return;
    }

    if (mergeTermData.sourceId === mergeTermData.targetId) {
      showToast('Cannot merge a term with itself', 'error');
      return;
    }

    let terms, sourceItem, targetItem;
    
    if (mergeTermData.type === 'deviceType') {
      // Handle device type terms from nomenclature systems
      const selectedSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
      if (!selectedSystem) {
        showToast('No nomenclature system selected', 'error');
        return;
      }
      terms = selectedSystem.deviceTypeTerms || [];
      sourceItem = terms.find(t => t.id === mergeTermData.sourceId);
      targetItem = terms.find(t => t.id === mergeTermData.targetId);
    } else {
      // Handle reference terms (manufacturer/model)
      terms = referenceDB[mergeTermData.type === 'manufacturer' ? 'Manufacturer' : 'Model'] || [];
      sourceItem = terms.find(t => t.id === mergeTermData.sourceId);
      targetItem = terms.find(t => t.id === mergeTermData.targetId);
    }

    if (!sourceItem || !targetItem) {
      showToast('One or both terms not found', 'error');
      return;
    }

    setMergeConfirmData({
      source: sourceItem,
      target: targetItem,
      type: mergeTermData.type
    });
    setShowMergeTermModal(false);
    setShowMergeConfirmModal(true);
  };

  const handleMergeConfirm = async () => {
    const { source, target, type } = mergeConfirmData;
    
    try {
      // Combine variations and remove duplicates
      // SOURCE keeps its name, TARGET name becomes a variation
      const combinedVariations = [...new Set([
        ...source.variations,
        target.standard, // Add target name as variation
        ...target.variations
      ])];

      const updatedSource = {
        ...source,
        variations: combinedVariations
      };

      if (type === 'deviceType') {
        // Handle device type terms from nomenclature systems
        try {
          // Update source term with combined variations
          await updateDeviceTypeTermVariations(source.id, combinedVariations);
          
          // Delete target term
          await deleteDeviceTypeTerm(target.id);
          
          // Update system timestamp
          await updateNomenclatureSystemTimestamp(adminSelectedSystem);
          
          // Refresh data from database
          const { nomenclatureSystems: freshSystems } = await loadCatalog();
          setNomenclatureSystems(freshSystems);
          
          showToast(`${target.standard} merged into ${source.standard}!`, 'success');
        } catch (error) {
          console.error('Error merging device type terms:', error);
          showToast(`Error merging terms: ${error.message}`, 'error');
          return; // Don't close modal on error
        }
      } else if (type === 'manufacturer') {
        // Handle manufacturer terms
        try {
          // Update source term with combined variations
          await updateReferenceTerm(source.id, source.standard, combinedVariations);
          
          // Delete target term
          await deleteReferenceTerm(target.id);
          
          // Refresh data from database
          const { referenceDB: freshReferenceDB } = await loadCatalog();
          setReferenceDB(freshReferenceDB);
          
          showToast(`${target.standard} merged into ${source.standard}!`, 'success');
        } catch (error) {
          console.error('Error merging manufacturer terms:', error);
          showToast(`Error merging terms: ${error.message}`, 'error');
          return; // Don't close modal on error
        }
      } else if (type === 'model') {
        // Handle model terms
        try {
          // Update source term with combined variations
          await updateReferenceTerm(source.id, source.standard, combinedVariations);
          
          // Delete target term
          await deleteReferenceTerm(target.id);
          
          // Refresh data from database
          const { referenceDB: freshReferenceDB } = await loadCatalog();
          setReferenceDB(freshReferenceDB);
          
          showToast(`${target.standard} merged into ${source.standard}!`, 'success');
        } catch (error) {
          console.error('Error merging model terms:', error);
          showToast(`Error merging terms: ${error.message}`, 'error');
          return; // Don't close modal on error
        }
      }

      setShowMergeConfirmModal(false);
      setMergeConfirmData({ source: null, target: null, type: '' });
    } catch (error) {
      console.error('Failed to merge terms:', error);
      showToast(`Failed to merge terms: ${error.message}`, 'error');
    }
  };

  // Show loading spinner while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Medical Inventory Standardizer</h2>
          <p className="text-gray-600">Initializing database connection...</p>
          {loadError && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                ⚠️ {loadError.includes('environment variables') ? 
                  'Database not configured, using local data' : 
                  'Using local data due to database error'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Environment Variable Warning Banner */}
        {!supabaseStatus.configured && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-yellow-600 mt-1" size={20} />
              <div>
                <h3 className="text-yellow-800 font-semibold">Supabase Environment Variables Missing</h3>
                <p className="text-yellow-700 text-sm mt-1">
                  Database persistence is disabled. Create a <code className="bg-yellow-100 px-1 rounded">.env</code> file with 
                  <code className="bg-yellow-100 px-1 rounded">VITE_SUPABASE_URL</code> and 
                  <code className="bg-yellow-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable data persistence.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-8">
          <div className="text-center mb-6">
            {/* Logo and Title */}
            <div className="flex justify-center items-center mb-4">
              <img src="/logo-large.svg" alt="Medical Equipment Inventory Standardizer Logo" className="h-16 w-auto" />
            </div>
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
                    onChange={(e) => selectActiveSystem(e.target.value)}
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
                      className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 flex items-center justify-center gap-2 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      <Upload size={20} />
                      Load Data
                    </button>
                    <button
                      onClick={() => setImportData('')}
                      className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 flex items-center gap-2 transition-all duration-200 border border-gray-300"
                      title="Clear the input field"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
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
                      disabled={Object.keys(columnMapping).filter(k => columnMapping[k]).length === 0}
                      className="mt-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-3 rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      <Search size={20} />
                      Analyze Data
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

                {importedRawData.length === 0 ? (
                  <div className="text-center py-16">
                    <AlertCircle className="mx-auto text-gray-300 mb-6" size={64} />
                    <h3 className="text-2xl font-semibold text-gray-900 mb-4">No data imported yet</h3>
                    <p className="text-gray-600 text-lg mb-8">Import and analyze your data first to review term matches.</p>
                    <button
                      onClick={() => setActiveTab('import')}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 shadow-lg transform hover:scale-105 transition-all duration-200"
                    >
                      Go to Import
                    </button>
                  </div>
                ) : reviewItems.length === 0 ? (
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
                          {/* Field/Column Information */}
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
                            <div className="text-xs text-blue-600 mt-1">
                              This term will be standardized in the {reviewItems[currentReviewIndex].field} field
                            </div>
                          </div>
                          
                          {/* Original Value */}
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
                              
                              {/* High Confidence Matches (Score > 0.7) */}
                              {reviewItems[currentReviewIndex].potentialMatches.filter(m => m.score > 0.7).length > 0 && (
                                <div className="mb-4">
                                  <div className="text-xs font-medium text-blue-700 mb-2 uppercase tracking-wide">High Confidence</div>
                                  <div className="space-y-2">
                                    {reviewItems[currentReviewIndex].potentialMatches
                                      .filter(m => m.score > 0.7)
                                      .slice(0, 3)
                                      .map((match, index) => (
                                        <div key={index} className="bg-white border-2 border-green-200 rounded-lg p-3 flex items-center justify-between hover:border-green-300 transition-colors">
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
                                            className="ml-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 text-sm font-medium"
                                          >
                                            ✓ Accept
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Medium Confidence Matches (Score 0.4-0.7) */}
                              {reviewItems[currentReviewIndex].potentialMatches.filter(m => m.score <= 0.7 && m.score > 0.4).length > 0 && (
                                <div className="mb-4">
                                  <div className="text-xs font-medium text-blue-700 mb-2 uppercase tracking-wide">Medium Confidence</div>
                                  <div className="space-y-2">
                                    {reviewItems[currentReviewIndex].potentialMatches
                                      .filter(m => m.score <= 0.7 && m.score > 0.4)
                                      .slice(0, 3)
                                      .map((match, index) => (
                                        <div key={index} className="bg-white border border-blue-200 rounded-lg p-3 flex items-center justify-between hover:border-blue-300 transition-colors">
                                          <div className="flex-1">
                                            <div className="font-medium text-gray-900">{match.term.standard}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                              {Math.round(match.score * 100)}% confidence • {match.reason}
                                            </div>
                                            {match.term.variations.length > 0 && (
                                              <div className="text-xs text-gray-400 mt-1">
                                                Variations: {match.term.variations.slice(0, 2).join(', ')}
                                                {match.term.variations.length > 2 && ` +${match.term.variations.length - 2} more`}
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
                              
                              {/* Low Confidence Matches (Score < 0.4) */}
                              {reviewItems[currentReviewIndex].potentialMatches.filter(m => m.score <= 0.4).length > 0 && (
                                <div>
                                  <div className="text-xs font-medium text-blue-700 mb-2 uppercase tracking-wide">Low Confidence</div>
                                  <div className="space-y-2">
                                    {reviewItems[currentReviewIndex].potentialMatches
                                      .filter(m => m.score <= 0.4)
                                      .slice(0, 2)
                                      .map((match, index) => (
                                        <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between opacity-75">
                                          <div className="flex-1">
                                            <div className="font-medium text-gray-700">{match.term.standard}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                              {Math.round(match.score * 100)}% confidence • {match.reason}
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => acceptSuggestion(match)}
                                            className="ml-3 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors duration-200 text-sm"
                                            disabled
                                          >
                                            Use with Caution
                                          </button>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                              
                              {reviewItems[currentReviewIndex].potentialMatches.length > 8 && (
                                <div className="mt-3 text-center">
                                  <div className="text-xs text-blue-600">
                                    Showing top 8 matches • {reviewItems[currentReviewIndex].potentialMatches.length - 8} more available
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Search Within Nomenclature Terms */}
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                            <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                              🔍 Search Within Nomenclature Terms
                              <span className="text-sm font-normal text-orange-600">
                                Browse and search available terms in this field
                              </span>
                            </h4>
                            
                            <div className="mb-3">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                                <input
                                  type="text"
                                  placeholder="Search for terms..."
                                  value={searchTerm || ''}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="w-full pl-10 pr-10 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                                />
                                {searchTerm && (
                                  <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    title="Clear search"
                                  >
                                    <X size={16} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-2">
                              {(() => {
                                let terms = [];
                                if (reviewItems[currentReviewIndex].field === 'Device Type') {
                                  // Get terms from active nomenclature system
                                  const activeSystem = nomenclatureSystems.find(s => s.id === activeNomenclatureSystem);
                                  terms = activeSystem?.deviceTypeTerms || [];
                                } else {
                                  // Get terms from reference database
                                  terms = referenceDB[reviewItems[currentReviewIndex].field] || [];
                                }
                                
                                // Filter by search term if provided
                                const filteredTerms = searchTerm 
                                  ? terms.filter(term => 
                                      normalizeText(term.standard).includes(normalizeText(searchTerm)) ||
                                      term.variations.some(v => normalizeText(v).includes(normalizeText(searchTerm)))
                                    )
                                  : terms.slice(0, 10); // Show first 10 by default
                                
                                return filteredTerms.length > 0 ? (
                                  filteredTerms.map((term, index) => (
                                    <div key={index} className="bg-white border border-orange-200 rounded-lg p-3 flex items-center justify-between hover:border-orange-300 transition-colors">
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900">{term.standard}</div>
                                        {term.variations.length > 0 && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            Variations: {term.variations.slice(0, 3).join(', ')}
                                            {term.variations.length > 3 && ` +${term.variations.length - 3} more`}
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => acceptSuggestion({ term, score: 1.0, reason: 'Manually selected from nomenclature' })}
                                        className="ml-3 bg-gradient-to-r from-orange-500 to-red-600 text-white px-3 py-2 rounded-lg hover:from-orange-600 hover:to-red-700 transition-all duration-200 text-sm font-medium"
                                      >
                                        ✓ Select
                                      </button>
                                    </div>
                                  ))
                                ) : searchTerm ? (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No terms found matching "{searchTerm}"
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-gray-500 text-sm">
                                    No terms available in this field
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {(() => {
                              let totalTerms = 0;
                              if (reviewItems[currentReviewIndex].field === 'Device Type') {
                                const activeSystem = nomenclatureSystems.find(s => s.id === activeNomenclatureSystem);
                                totalTerms = activeSystem?.deviceTypeTerms?.length || 0;
                              } else {
                                totalTerms = referenceDB[reviewItems[currentReviewIndex].field]?.length || 0;
                              }
                              
                              return totalTerms > 10 && (
                                <div className="mt-3 text-center">
                                  <div className="text-xs text-orange-600">
                                    {searchTerm ? 'Searching all terms' : `Showing first 10 of ${totalTerms} total terms`}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
                            <h4 className="font-semibold text-gray-800 mb-4">Create New Standard Term</h4>
                            
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Enter new standard term..."
                                value={createTerm}
                                onChange={(e) => setCreateTerm(e.target.value)}
                                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                              />
                              {createTerm && (
                                <button
                                  onClick={() => setCreateTerm('')}
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                  title="Clear input"
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => createTerm.trim() && addNewStandardTerm(createTerm.trim())}
                                disabled={!createTerm.trim() || isCreatingTerm}
                                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                              >
                                {isCreatingTerm ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Plus size={16} />
                                    Add as New Term
                                  </>
                                )}
                              </button>

                              <button
                                onClick={moveToNextReview}
                                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                              >
                                ⏭️ Skip This Term
                              </button>
                            </div>
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

                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                      <div className="p-6 border-b border-gray-200">
                        <h3 className="text-xl font-semibold text-gray-900">Standardized Data Preview</h3>
                        <p className="text-gray-600 text-sm mt-1">Comparison between original and standardized terms</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              {Object.keys(importedRawData[0] || {})
                                .filter(key => key !== '_rowIndex' && columnMapping[key])
                                .map(originalCol => {
                                  const mapping = columnMapping[originalCol];
                                  if (mapping === 'Reference Field') {
                                    return (
                                      <th key={originalCol} className="px-4 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider">
                                        {originalCol}
                                      </th>
                                    );
                                  } else {
                                    return [
                                      <th key={`orig-${originalCol}`} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Original {originalCol}
                                      </th>,
                                      <th key={`std-${originalCol}`} className="px-4 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                                        Standardized {originalCol}
                                      </th>,
                                      <th key={`status-${originalCol}`} className="px-4 py-3 text-left text-xs font-medium text-purple-600 uppercase tracking-wider">
                                        Status {originalCol}
                                      </th>
                                    ];
                                  }
                                }).flat()}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {processedData.slice(0, 10).map((row, index) => (
                              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                {Object.keys(importedRawData[0] || {})
                                  .filter(key => key !== '_rowIndex' && columnMapping[key])
                                  .map(originalCol => {
                                    const mapping = columnMapping[originalCol];
                                    if (mapping === 'Reference Field') {
                                      return (
                                        <td key={originalCol} className="px-4 py-3 text-sm font-medium text-green-800">
                                          {row[originalCol] || '-'}
                                        </td>
                                      );
                                    } else {
                                      return [
                                        <td key={`orig-${originalCol}`} className="px-4 py-3 text-sm text-gray-600">
                                          {row[`Original ${originalCol}`] || '-'}
                                        </td>,
                                        <td key={`std-${originalCol}`} className="px-4 py-3 text-sm font-medium text-blue-800">
                                          {row[`Standardized ${originalCol}`] || '-'}
                                        </td>,
                                        <td key={`status-${originalCol}`} className="px-4 py-3 text-sm font-medium">
                                          {(() => {
                                            const status = row[`Status ${originalCol}`];
                                            if (status === 'Skipped') {
                                              return <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-full text-xs">⏭️ Skipped</span>;
                                            } else if (status === 'No Match') {
                                              return <span className="text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs">❌ No Match</span>;
                                            } else if (status === 'Added as New Term') {
                                              return <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded-full text-xs">🆕 Added as New Term</span>;
                                            } else if (status === 'Auto-Matched') {
                                              return <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded-full text-xs">🔄 Auto-Matched</span>;
                                            } else {
                                              return <span className="text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">✅ Standardized</span>;
                                            }
                                          })()}
                                        </td>
                                      ];
                                    }
                                  }).flat()}
                              </tr>
                            ))}
                          </tbody>
                        </table>
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

                <div className="flex justify-center">
                  <div className="bg-gray-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAdminSelectedSection('nomenclature')}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                        adminSelectedSection === 'nomenclature'
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 Nomenclature Systems
                    </button>
                    <button
                      onClick={() => setAdminSelectedSection('universal')}
                      className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                        adminSelectedSection === 'universal'
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🌍 Universal Terms
                    </button>
                  </div>
                </div>

                {adminSelectedSection === 'nomenclature' && (
                  <div className="space-y-6">
                    {/* System Selector */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-gray-900">Select Nomenclature System</h3>
                        <button
                          onClick={handleAddSystemClick}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                        >
                          <Plus size={16} />
                          New System
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <select
                          value={adminSelectedSystem}
                          onChange={(e) => {
                            console.log(`System selection changed from ${adminSelectedSystem} to ${e.target.value}`);
                            setAdminSelectedSystem(e.target.value);
                          }}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {nomenclatureSystems.map(system => (
                            <option key={system.id} value={system.id}>
                              {system.name} - {system.deviceTypeTerms?.length || 0} terms
                            </option>
                          ))}
                        </select>

                        
                        <button
                          onClick={() => handleEditSystemClick(nomenclatureSystems.find(s => s.id === adminSelectedSystem))}
                          className="p-3 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit System"
                        >
                          <Edit2 size={20} />
                        </button>
                        
                        <button
                          onClick={() => handleDeleteSystemClick(nomenclatureSystems.find(s => s.id === adminSelectedSystem))}
                          className="p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete System"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>

                    {/* Device Types Table */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold text-gray-900">
                          Device Types - {nomenclatureSystems.find(s => s.id === adminSelectedSystem)?.name}
                        </h3>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleAddTermClick('deviceType')}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                          >
                            <Plus size={16} />
                            Add Term
                          </button>
                          <button 
                            onClick={() => {
                              setBulkUploadType('deviceType');
                              setBulkUploadSystem(adminSelectedSystem);
                              handleBulkUploadClick();
                            }}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2"
                          >
                            <Upload size={16} />
                            Bulk Upload
                          </button>
                        </div>
                      </div>
                      
                      {/* Search Bar */}
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                          <input
                            type="text"
                            placeholder="Search device types..."
                            value={adminSearchTerms.deviceTypes}
                            onChange={(e) => setAdminSearchTerms(prev => ({ ...prev, deviceTypes: e.target.value }))}
                            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {adminSearchTerms.deviceTypes && (
                            <button
                              onClick={() => setAdminSearchTerms(prev => ({ ...prev, deviceTypes: '' }))}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Clear search"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                                              {/* Terms Table */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(() => {
                          const currentSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
                          const deviceTypeTerms = currentSystem?.deviceTypeTerms || [];
                          const filteredTerms = deviceTypeTerms
                            .filter(term => 
                              normalizeText(term.standard).includes(normalizeText(adminSearchTerms.deviceTypes)) ||
                              term.variations.some(v => normalizeText(v).includes(normalizeText(adminSearchTerms.deviceTypes)))
                            )
                            .sort((a, b) => a.standard.localeCompare(b.standard));

                          // Debug info - remove in production
                          console.log('Current system:', currentSystem);
                          console.log('Device type terms:', deviceTypeTerms);
                          console.log('Filtered terms:', filteredTerms);

                          if (filteredTerms.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                {adminSearchTerms.deviceTypes ? 
                                  `No device types found matching "${adminSearchTerms.deviceTypes}"` : 
                                  `No device types found in this system (${deviceTypeTerms.length} total terms)`
                                }
                                {/* Debug info - remove in production */}
                                <div className="mt-2 text-xs text-gray-400">
                                  System ID: {adminSelectedSystem} | 
                                  System Name: {currentSystem?.name} | 
                                  Terms Count: {deviceTypeTerms.length}
                                </div>
                              </div>
                            );
                          }

                          return filteredTerms.map(term => (
                            <div key={term.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{term.standard}</div>
                                {term.variations.length > 0 && (
                                  <div className="text-sm text-gray-600 mt-1">
                                    Also called: {term.variations.join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleEditTermClick(term, 'deviceType')}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit Term"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleMergeTermClick(term, 'deviceType')}
                                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Merge Term"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h7m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => handleDeleteTermClick(term, 'deviceType')}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Term"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {adminSelectedSection === 'universal' && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <h3 className="text-xl font-semibold text-gray-900">Universal Terms</h3>
                          <select
                            value={adminSearchTerms.selectedUniversalType}
                            onChange={(e) => setAdminSearchTerms(prev => ({ 
                              ...prev, 
                              selectedUniversalType: e.target.value,
                              universalSearch: ''
                            }))}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="Manufacturer">🏭 Manufacturers ({referenceDB.Manufacturer?.length || 0})</option>
                            <option value="Model">🔧 Models ({referenceDB.Model?.length || 0})</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleAddTermClick(adminSearchTerms.selectedUniversalType?.toLowerCase() || 'manufacturer')}
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                          >
                            <Plus size={16} />
                            Add {adminSearchTerms.selectedUniversalType || 'Manufacturer'}
                          </button>
                          <button 
                            onClick={() => {
                              setBulkUploadType(adminSearchTerms.selectedUniversalType?.toLowerCase() || 'manufacturer');
                              setBulkUploadField(adminSearchTerms.selectedUniversalType || 'Manufacturer');
                              handleBulkUploadClick();
                            }}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 flex items-center gap-2"
                          >
                            <Upload size={16} />
                            Bulk Upload {adminSearchTerms.selectedUniversalType || 'Manufacturer'}s
                          </button>
                        </div>
                      </div>
                      
                      {/* Search Bar */}
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                          <input
                            type="text"
                            placeholder={`Search ${adminSearchTerms.selectedUniversalType?.toLowerCase() || 'manufacturer'}s...`}
                            value={adminSearchTerms.universalSearch}
                            onChange={(e) => setAdminSearchTerms(prev => ({ ...prev, universalSearch: e.target.value }))}
                            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {adminSearchTerms.universalSearch && (
                            <button
                              onClick={() => setAdminSearchTerms(prev => ({ ...prev, universalSearch: '' }))}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Clear search"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(() => {
                          const selectedType = adminSearchTerms.selectedUniversalType || 'Manufacturer';
                          const terms = referenceDB[selectedType] || [];
                          
                          const filteredTerms = terms
                            .filter(term => 
                              !adminSearchTerms.universalSearch ||
                              normalizeText(term.standard).includes(normalizeText(adminSearchTerms.universalSearch)) ||
                              term.variations.some(v => normalizeText(v).includes(normalizeText(adminSearchTerms.universalSearch)))
                            )
                            .sort((a, b) => a.standard.localeCompare(b.standard));

                          if (filteredTerms.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                {adminSearchTerms.universalSearch ?
                                  `No ${selectedType.toLowerCase()}s found matching "${adminSearchTerms.universalSearch}"` :
                                  `No ${selectedType.toLowerCase()}s found`
                                }
                              </div>
                            );
                          }

                          return filteredTerms.map(term => (
                            <div key={term.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{term.standard}</div>
                                {term.variations.length > 0 && (
                                  <div className="text-sm text-gray-600 mt-1">
                                    Also called: {term.variations.join(', ')}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => handleEditTermClick(term, selectedType.toLowerCase())}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit Term"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={() => handleMergeTermClick(term, selectedType.toLowerCase())}
                                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Merge Term"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                  </svg>
                                </button>
                                <button 
                                  onClick={() => handleDeleteTermClick(term, selectedType.toLowerCase())}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Term"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                )}
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
              <input
                type="password"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminPasswordSubmit()}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                placeholder="Enter admin password"
                autoFocus
              />
              
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

      {/* Add System Modal */}
      {showAddSystemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Add Nomenclature System</h3>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={newSystemData.name}
                  onChange={(e) => setNewSystemData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="System name"
                  autoFocus
                />
                {newSystemData.name && (
                  <button
                    onClick={() => setNewSystemData(prev => ({ ...prev, name: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Clear input"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <textarea
                value={newSystemData.description}
                onChange={(e) => setNewSystemData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Description"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddSystemModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSystemSubmit}
                  disabled={!newSystemData.name.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit System Modal */}
      {showEditSystemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Edit Nomenclature System</h3>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={editSystemData.name}
                  onChange={(e) => setEditSystemData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="System name"
                  autoFocus
                />
                {editSystemData.name && (
                  <button
                    onClick={() => setEditSystemData(prev => ({ ...prev, name: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Clear input"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <textarea
                value={editSystemData.description}
                onChange={(e) => setEditSystemData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Description"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditSystemModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSystemSubmit}
                  disabled={!editSystemData.name.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:cursor-not-allowed"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete System Modal */}
      {showDeleteSystemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete System</h3>
              <p className="text-gray-600">Are you sure you want to delete this nomenclature system?</p>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="font-medium text-red-800 mb-2">"{deleteSystemData.name}"</p>
              <p className="text-red-700 text-sm">This action cannot be undone. All device types in this system will be permanently deleted.</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteSystemModal(false)}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSystemConfirm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700"
              >
                Delete System
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Term Modal */}
      {showEditTermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Edit Term</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Term Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editTermData.standard}
                    onChange={(e) => setEditTermData(prev => ({ ...prev, standard: e.target.value }))}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="Term name"
                    autoFocus
                  />
                  {editTermData.standard && (
                    <button
                      onClick={() => setEditTermData(prev => ({ ...prev, standard: '' }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear input"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Variations</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editTermData.variations}
                    onChange={(e) => setEditTermData(prev => ({ ...prev, variations: e.target.value }))}
                    className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                    placeholder="Variations (comma separated)"
                  />
                  {editTermData.variations && (
                    <button
                      onClick={() => setEditTermData(prev => ({ ...prev, variations: '' }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear input"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditTermModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditTermSubmit}
                  disabled={!editTermData.standard.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:cursor-not-allowed"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Term Modal */}
      {showDeleteTermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete Term</h3>
              <p className="text-gray-600">Are you sure you want to delete this term?</p>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <p className="font-medium text-red-800 mb-2">"{deleteTermData.standard}"</p>
              <p className="text-red-700 text-sm">This action cannot be undone.</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteTermModal(false)}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTermConfirm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700"
              >
                Delete Term
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Term Modal */}
      {showMergeTermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Merge Terms</h3>
              <p className="text-gray-600">Select the term to merge "{mergeTermData.sourceName}" into</p>
              
              {/* Help text for duplicate terms */}
              {(() => {
                let terms = [];
                if (mergeTermData.type === 'deviceType') {
                  const selectedSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
                  terms = selectedSystem?.deviceTypeTerms || [];
                } else {
                  terms = referenceDB[mergeTermData.type === 'manufacturer' ? 'Manufacturer' : 'Model'] || [];
                }
                
                const duplicateCount = terms.filter(t => t.standard === mergeTermData.sourceName).length;
                if (duplicateCount > 1) {
                  return (
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-blue-700 text-sm">
                        💡 Found {duplicateCount} terms with the same name. You can merge them to consolidate duplicates.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Merge into:</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search for terms to merge into..."
                    value={mergeTermData.searchTerm || ''}
                    onChange={(e) => setMergeTermData(prev => ({ ...prev, searchTerm: e.target.value, targetId: null }))}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  {mergeTermData.searchTerm && (
                    <button
                      onClick={() => setMergeTermData(prev => ({ ...prev, searchTerm: '', targetId: null }))}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                
                {/* Search Results */}
                {mergeTermData.searchTerm && (
                  <div className="mt-3 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {(() => {
                      let terms = [];
                      if (mergeTermData.type === 'deviceType') {
                        const selectedSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
                        terms = selectedSystem?.deviceTypeTerms || [];
                      } else {
                        terms = referenceDB[mergeTermData.type === 'manufacturer' ? 'Manufacturer' : 'Model'] || [];
                      }
                      
                      const filteredTerms = terms
                        .filter(term => {
                          // Don't show the source term itself
                          if (term.id === mergeTermData.sourceId) return false;
                          
                          // Filter by search term
                          return normalizeText(term.standard).includes(normalizeText(mergeTermData.searchTerm)) ||
                                 term.variations.some(v => normalizeText(v).includes(normalizeText(mergeTermData.searchTerm)));
                        })
                        .sort((a, b) => {
                          // Sort by name first, then by ID for stable ordering
                          const nameCompare = a.standard.localeCompare(b.standard);
                          if (nameCompare !== 0) return nameCompare;
                          return a.id - b.id;
                        })
                        .slice(0, 10); // Limit to 10 results
                      
                      if (filteredTerms.length === 0) {
                        return (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No terms found matching "{mergeTermData.searchTerm}"
                          </div>
                        );
                      }
                      
                      return filteredTerms.map(term => (
                        <div
                          key={term.id}
                          onClick={() => setMergeTermData(prev => ({ 
                            ...prev, 
                            targetId: term.id,
                            searchTerm: term.standard // Show selected term in search box
                          }))}
                          className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                            mergeTermData.targetId === term.id ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                        >
                          <div className="font-medium text-gray-900">{term.standard}</div>
                          {term.variations.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              Variations: {term.variations.slice(0, 3).join(', ')}
                              {term.variations.length > 3 && ` +${term.variations.length - 3} more`}
                            </div>
                          )}
                          {terms.filter(t => t.standard === term.standard).length > 1 && (
                            <div className="text-xs text-blue-600 mt-1 font-medium">(duplicate)</div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
                
                {/* Selected Term Display */}
                {mergeTermData.targetId && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="text-sm font-medium text-green-800 mb-1">Selected for merge:</div>
                    <div className="font-medium text-green-900">
                      {(() => {
                        let terms = [];
                        if (mergeTermData.type === 'deviceType') {
                          const selectedSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
                          terms = selectedSystem?.deviceTypeTerms || [];
                        } else {
                          terms = referenceDB[mergeTermData.type === 'manufacturer' ? 'Manufacturer' : 'Model'] || [];
                        }
                        const selectedTerm = terms.find(t => t.id === mergeTermData.targetId);
                        return selectedTerm ? selectedTerm.standard : 'Unknown term';
                      })()}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowMergeTermModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMergeTermSubmit}
                  disabled={!mergeTermData.targetId}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 disabled:from-gray-300 disabled:cursor-not-allowed"
                >
                  Merge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Confirmation Modal */}
      {showMergeConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-orange-600" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Merge</h3>
              <p className="text-gray-600">Are you sure you want to merge these terms?</p>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-medium text-orange-800">Source term (will keep its name):</p>
                  <p className="text-orange-700">"{mergeConfirmData.source?.standard}"</p>
                  {mergeConfirmData.source?.variations.length > 0 && (
                    <p className="text-orange-700">Current variations: {mergeConfirmData.source.variations.join(', ')}</p>
                  )}
                </div>
                <div>
                  <p className="font-medium text-orange-800">Target term (will be merged and deleted):</p>
                  <p className="text-orange-700">"{mergeConfirmData.target?.standard}"</p>
                  {mergeConfirmData.target?.variations.length > 0 && (
                    <p className="text-orange-700">Variations: {mergeConfirmData.target.variations.join(', ')}</p>
                  )}
                </div>
                <div className="pt-2 border-t border-orange-300">
                  <p className="font-medium text-orange-800">Final result will be:</p>
                  <p className="text-orange-700">"{mergeConfirmData.source?.standard}"</p>
                  <p className="text-orange-700">
                    All variations: {[...new Set([
                      ...(mergeConfirmData.source?.variations || []),
                      mergeConfirmData.target?.standard,
                      ...(mergeConfirmData.target?.variations || [])
                    ])].join(', ')}
                  </p>
                </div>
              </div>
              <p className="text-orange-700 text-sm mt-3 font-medium">⚠️ This action cannot be undone!</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowMergeConfirmModal(false)}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeConfirm}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {showBulkUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Bulk Upload {bulkUploadType === 'deviceType' ? 'Device Type Terms' : `${bulkUploadField} Terms`}</h3>
              <p className="text-gray-600">
                {bulkUploadType === 'deviceType' 
                  ? `Add multiple device type terms to ${nomenclatureSystems.find(s => s.id === bulkUploadSystem)?.name}`
                  : `Add multiple ${bulkUploadField} terms to the reference database`
                }
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Data Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste TSV data (tab-separated values)
                </label>
                <div className="relative">
                  <textarea
                    value={bulkUploadData}
                    onChange={(e) => handleBulkUploadDataChange(e.target.value)}
                    placeholder="Standard&#9;Variations&#10;Ventilator&#9;Vent, Ventilator&#10;Monitor&#9;Mon, Monitoring Device"
                    className="w-full h-32 px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    autoFocus
                  />
                  {bulkUploadData && (
                    <button
                      onClick={() => handleBulkUploadDataChange('')}
                      className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
                      title="Clear input"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  First row should contain headers. Use tabs to separate columns.
                </p>
              </div>

              {/* Column Mapping */}
              {Object.keys(bulkUploadColumnMapping).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Column Mapping
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(bulkUploadColumnMapping).map(([header, field]) => (
                      <div key={header} className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 min-w-0 flex-1">{header}</span>
                        <span className="text-xs text-gray-400">→</span>
                        <select
                          value={field}
                          onChange={(e) => setBulkUploadColumnMapping(prev => ({ ...prev, [header]: e.target.value }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="standard">Standard Term</option>
                          <option value="variations">Variations</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {bulkUploadPreview.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Preview ({bulkUploadPreview.length} rows)
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {bulkUploadPreview.map((row, index) => (
                        <div key={index} className="space-y-1">
                          <div className="font-medium text-gray-900">
                            {row[Object.keys(bulkUploadColumnMapping).find(h => bulkUploadColumnMapping[h] === 'standard')] || 'N/A'}
                          </div>
                          <div className="text-gray-600">
                            {row[Object.keys(bulkUploadColumnMapping).find(h => bulkUploadColumnMapping[h] === 'variations')] || 'No variations'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowBulkUploadModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUploadSubmit}
                  disabled={!bulkUploadData.trim() || bulkUploadPreview.length === 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-300 disabled:cursor-not-allowed"
                >
                  Upload {bulkUploadPreview.length > 0 ? `(${bulkUploadPreview.length} terms)` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Term Modal */}
      {showAddTermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Add New Term</h3>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  value={newTermData.standard}
                  onChange={(e) => setNewTermData(prev => ({ ...prev, standard: e.target.value }))}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Term name"
                  autoFocus
                />
                {newTermData.standard && (
                  <button
                    onClick={() => setNewTermData(prev => ({ ...prev, standard: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Clear input"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={newTermData.variations}
                  onChange={(e) => setNewTermData(prev => ({ ...prev, variations: e.target.value }))}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Variations (comma separated)"
                />
                {newTermData.variations && (
                  <button
                    onClick={() => setNewTermData(prev => ({ ...prev, variations: '' }))}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Clear input"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddTermModal(false)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTermSubmit}
                  disabled={!newTermData.standard.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:cursor-not-allowed"
                >
                  Add Term
                </button>
              </div>
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
