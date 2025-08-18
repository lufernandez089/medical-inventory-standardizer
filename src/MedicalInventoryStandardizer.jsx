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
  deleteDeviceTypeTerm
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
  const [mergeTermData, setMergeTermData] = useState({ sourceId: null, sourceName: '', targetId: null, type: '' });
  const [showMergeConfirmModal, setShowMergeConfirmModal] = useState(false);
  const [mergeConfirmData, setMergeConfirmData] = useState({ source: null, target: null, type: '' });
  const [adminSearchTerms, setAdminSearchTerms] = useState({
    deviceTypes: '',
    selectedUniversalType: 'Manufacturer',
    universalSearch: ''
  });

    // Load data from database on component mount
  useEffect(() => {
    const initializeData = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Check environment variables first
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          console.warn('Supabase environment variables missing');
          setSupabaseStatus({
            configured: false,
            canWrite: false
          });
          // Fallback to hardcoded defaults
          setNomenclatureSystems(defaultSystems);
          setReferenceDB(defaultData);
          setIsLoading(false);
          return;
        }
        
        // Check Supabase configuration and connectivity
        const connectivityTest = await canWriteToSupabase();
        setSupabaseStatus({
          configured: true,
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
    }
  };

  // Matching
  const findBestMatches = (originalValue, fieldTerms) => {
    const matches = [];
    const originalLower = originalValue.toLowerCase().trim();
    
    for (const term of fieldTerms) {
      if (term.standard.toLowerCase() === originalLower) {
        matches.push({ term, score: 1.0, reason: 'Exact match' });
        continue;
      }
      
      const exactVariation = term.variations.find(v => v.toLowerCase() === originalLower);
      if (exactVariation) {
        matches.push({ term, score: 1.0, reason: 'Exact variation match' });
        continue;
      }
      
      const standardLower = term.standard.toLowerCase();
      if (standardLower.includes(originalLower) && originalLower.length > 2) {
        const score = originalLower.length / standardLower.length * 0.7;
        if (score > 0.3) {
          matches.push({ term, score, reason: 'Partial match' });
        }
      }
    }
    
    return matches.sort((a, b) => b.score - a.score).slice(0, 5);
  };

  const analyzeData = () => {
    const mappedColumns = Object.keys(columnMapping).filter(k => columnMapping[k] && columnMapping[k] !== 'Reference Field');
    if (mappedColumns.length === 0) {
      showToast('Please map at least one column', 'error');
      return;
    }

    const activeSystem = nomenclatureSystems.find(s => s.id === activeNomenclatureSystem);
    const deviceTypeTerms = activeSystem?.deviceTypeTerms || [];
    const reviewQueue = [];

    importedRawData.forEach((row) => {
      Object.entries(columnMapping).forEach(([sourceCol, targetField]) => {
        const originalValue = row[sourceCol];
        if (!originalValue || targetField === 'Reference Field') return;

        let fieldTerms = [];
        if (targetField === 'Device Type') {
          fieldTerms = deviceTypeTerms;
        } else {
          fieldTerms = referenceDB[targetField] || [];
        }

        const matches = findBestMatches(originalValue, fieldTerms);
        const exactMatch = matches.find(match => match.score === 1.0);
        
        if (!exactMatch) {
          reviewQueue.push({
            rowIndex: row._rowIndex,
            field: targetField,
            originalValue,
            potentialMatches: matches
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
      setActiveTab('review');
      showToast(`${reviewQueue.length} terms need review`, 'info');
    }
  };

  // Review
  const acceptSuggestion = async (selectedMatch) => {
    const item = reviewItems[currentReviewIndex];
    
    try {
      if (item.field === 'Device Type') {
        // Persist to database
        await appendVariationToDeviceType(selectedMatch.term.id, item.originalValue);
        
        // Update local state
        setNomenclatureSystems(prev => 
          prev.map(system => 
            system.id === activeNomenclatureSystem
              ? { 
                  ...system, 
                  deviceTypeTerms: system.deviceTypeTerms.map(term => 
                    term.id === selectedMatch.term.id
                      ? { ...term, variations: [...new Set([...term.variations, item.originalValue])] }
                      : term
                  ),
                  lastUpdated: new Date().toISOString()
                }
              : system
          )
        );
      } else {
        // Persist to database
        await appendVariationToReference(selectedMatch.term.id, item.originalValue);
        
        // Update local state
        setReferenceDB(prev => ({
          ...prev,
          [item.field]: prev[item.field].map(term =>
            term.id === selectedMatch.term.id
              ? { ...term, variations: [...new Set([...term.variations, item.originalValue])] }
              : term
          )
        }));
      }
      
      showToast('Variation added successfully');
      moveToNextReview();
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
      if (item.field === 'Device Type') {
        // Persist to database
        const termId = await upsertDeviceTypeTerm(activeNomenclatureSystem, newStandardTerm, item.originalValue);
        
        // Update local state with the new term from database
        const newTerm = {
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
        const newTerm = {
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
      moveToNextReview();
    } catch (error) {
      console.error('Failed to create new term:', error);
      
      // Show the actual error message instead of generic text
      const errorMessage = error.message || 'Unknown error occurred';
      showToast(`Failed to create new term: ${errorMessage}`, 'error');
      
      // Don't advance to next review on failure - keep user on same item
      // moveToNextReview(); // Removed this line
    } finally {
      setIsCreatingTerm(false);
    }
  };

  const moveToNextReview = () => {
    if (currentReviewIndex < reviewItems.length - 1) {
      setCurrentReviewIndex(currentReviewIndex + 1);
      setCreateTerm(reviewItems[currentReviewIndex + 1]?.originalValue || '');
    } else {
      standardizeData();
    }
  };

  const standardizeData = () => {
    const activeSystem = nomenclatureSystems.find(s => s.id === activeNomenclatureSystem);
    const deviceTypeTerms = activeSystem?.deviceTypeTerms || [];
    
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
          result[`Original ${targetField}`] = '';
          result[`Standardized ${targetField}`] = '';
          return;
        }
        
        let fieldTerms = [];
        if (targetField === 'Device Type') {
          fieldTerms = deviceTypeTerms;
        } else {
          fieldTerms = referenceDB[targetField] || [];
        }
        
        let matchedTerm = null;
        for (const term of fieldTerms) {
          if (term.standard.toLowerCase() === originalValue.toLowerCase() ||
              term.variations.some(v => v.toLowerCase() === originalValue.toLowerCase())) {
            matchedTerm = term;
            break;
          }
        }
        
        result[`Original ${targetField}`] = originalValue;
        result[`Standardized ${targetField}`] = matchedTerm ? matchedTerm.standard : originalValue;
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

  const handleAddSystemSubmit = () => {
    if (!newSystemData.name.trim()) {
      showToast('System name required', 'error');
      return;
    }

    const newSystem = {
      id: Date.now().toString(),
      name: newSystemData.name.trim(),
      description: newSystemData.description.trim(),
      lastUpdated: new Date().toISOString(),
      deviceTypeTerms: []
    };

    setNomenclatureSystems(prev => [...prev, newSystem]);
    setAdminSelectedSystem(newSystem.id);
    setShowAddSystemModal(false);
    setNewSystemData({ name: '', description: '' });
    showToast(`System "${newSystem.name}" created!`);
  };

  const handleAddTermClick = (type) => {
    setAddTermType(type);
    setNewTermData({ standard: '', variations: '' });
    setShowAddTermModal(true);
  };

  const handleAddTermSubmit = () => {
    if (!newTermData.standard.trim()) {
      showToast('Term name required', 'error');
      return;
    }

    const variations = newTermData.variations
      .split(',')
      .map(v => v.trim())
      .filter(v => v);

    const newTerm = {
      id: Date.now(),
      standard: newTermData.standard.trim(),
      variations
    };

    if (addTermType === 'deviceType') {
      setNomenclatureSystems(prev => 
        prev.map(system => 
          system.id === adminSelectedSystem
            ? { 
                ...system, 
                deviceTypeTerms: [...system.deviceTypeTerms, newTerm],
                lastUpdated: new Date().toISOString()
              }
            : system
        )
      );
    } else {
      setReferenceDB(prev => ({
        ...prev,
        [addTermType === 'manufacturer' ? 'Manufacturer' : 'Model']: [
          ...(prev[addTermType === 'manufacturer' ? 'Manufacturer' : 'Model'] || []), 
          newTerm
        ]
      }));
    }

    setShowAddTermModal(false);
    setNewTermData({ standard: '', variations: '' });
    setAddTermType('');
    showToast(`${newTerm.standard} added!`);
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

  const handleEditSystemSubmit = () => {
    if (!editSystemData.name.trim()) {
      showToast('System name required', 'error');
      return;
    }

    const nameExists = nomenclatureSystems.some(system => 
      system.id !== editSystemData.id && 
      system.name.toLowerCase() === editSystemData.name.trim().toLowerCase()
    );

    if (nameExists) {
      showToast('System name already exists', 'error');
      return;
    }

    setNomenclatureSystems(prev => 
      prev.map(system => 
        system.id === editSystemData.id 
          ? { 
              ...system, 
              name: editSystemData.name.trim(), 
              description: editSystemData.description.trim(), 
              lastUpdated: new Date().toISOString() 
            }
          : system
      )
    );

    setShowEditSystemModal(false);
    setEditSystemData({ id: null, name: '', description: '' });
    showToast(`System "${editSystemData.name}" updated!`);
  };

  // Delete system functions
  const handleDeleteSystemClick = (system) => {
    setDeleteSystemData({
      id: system.id,
      name: system.name
    });
    setShowDeleteSystemModal(true);
  };

  const handleDeleteSystemConfirm = () => {
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

    setNomenclatureSystems(prev => prev.filter(system => system.id !== deleteSystemData.id));
    setShowDeleteSystemModal(false);
    setDeleteSystemData({ id: null, name: '' });
    showToast(`System "${deleteSystemData.name}" deleted!`);
  };

  // Term management functions
  const handleEditTermClick = (term, type) => {
    setEditTermData({
      id: term.id,
      standard: term.standard,
      variations: term.variations.join(', '),
      type: type
    });
    setShowEditTermModal(true);
  };

  const handleEditTermSubmit = () => {
    if (!editTermData.standard.trim()) {
      showToast('Term name required', 'error');
      return;
    }

    const variations = editTermData.variations
      .split(',')
      .map(v => v.trim())
      .filter(v => v);

    const updatedTerm = {
      id: editTermData.id,
      standard: editTermData.standard.trim(),
      variations: variations
    };

    if (editTermData.type === 'deviceType') {
      setNomenclatureSystems(prev => 
        prev.map(system => 
          system.id === adminSelectedSystem
            ? { 
                ...system, 
                deviceTypeTerms: system.deviceTypeTerms.map(term => 
                  term.id === editTermData.id ? updatedTerm : term
                ),
                lastUpdated: new Date().toISOString()
              }
            : system
        )
      );
    } else if (editTermData.type === 'manufacturer') {
      setReferenceDB(prev => ({
        ...prev,
        Manufacturer: prev.Manufacturer.map(term => 
          term.id === editTermData.id ? updatedTerm : term
        )
      }));
    } else if (editTermData.type === 'model') {
      setReferenceDB(prev => ({
        ...prev,
        Model: prev.Model.map(term => 
          term.id === editTermData.id ? updatedTerm : term
        )
      }));
    }

    setShowEditTermModal(false);
    setEditTermData({ id: null, standard: '', variations: '', type: '' });
    showToast(`${updatedTerm.standard} updated!`);
  };

  const handleDeleteTermClick = (term, type) => {
    setDeleteTermData({
      id: term.id,
      standard: term.standard,
      type: type
    });
    setShowDeleteTermModal(true);
  };

  const handleDeleteTermConfirm = () => {
    const { id, type } = deleteTermData;
    
    if (type === 'deviceType') {
      setNomenclatureSystems(prev => 
        prev.map(system => 
          system.id === adminSelectedSystem
            ? { 
                ...system, 
                deviceTypeTerms: system.deviceTypeTerms.filter(term => term.id !== id),
                lastUpdated: new Date().toISOString()
              }
            : system
        )
      );
    } else if (type === 'manufacturer') {
      setReferenceDB(prev => ({
        ...prev,
        Manufacturer: prev.Manufacturer.filter(term => term.id !== id)
      }));
    } else if (type === 'model') {
      setReferenceDB(prev => ({
        ...prev,
        Model: prev.Model.filter(term => term.id !== id)
      }));
    }

    setShowDeleteTermModal(false);
    setDeleteTermData({ id: null, standard: '', type: '' });
    showToast(`${deleteTermData.standard} deleted successfully!`);
  };

  const handleMergeTermClick = (term, type) => {
    setMergeTermData({
      sourceId: term.id,
      sourceName: term.standard,
      targetId: null,
      type: type
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
        // Handle device type terms - persist to database
        const selectedSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
        if (!selectedSystem) {
          showToast('No nomenclature system selected', 'error');
          return;
        }

        // Update the source term with combined variations
        await appendVariationToDeviceType(source.id, target.standard);
        // Add all target variations to source
        for (const variation of target.variations) {
          if (!combinedVariations.includes(variation)) {
            await appendVariationToDeviceType(source.id, variation);
          }
        }

        // Delete the target term from database
        await deleteDeviceTypeTerm(target.id);

        // Update local state
        setNomenclatureSystems(prev => 
          prev.map(system => 
            system.id === adminSelectedSystem
              ? {
                  ...system,
                  deviceTypeTerms: system.deviceTypeTerms
                    .map(term => term.id === source.id ? updatedSource : term)
                    .filter(term => term.id !== target.id), // Remove target term
                  lastUpdated: new Date().toISOString()
                }
              : system
          )
        );

        showToast(`${target.standard} merged into ${source.standard}!`);
      } else if (type === 'manufacturer') {
        // Handle manufacturer terms
        setReferenceDB(prev => ({
          ...prev,
          Manufacturer: prev.Manufacturer
            .map(term => term.id === source.id ? updatedSource : term)
            .filter(term => term.id !== target.id) // Remove target term
        }));
        showToast(`${target.standard} merged into ${source.standard}!`);
      } else if (type === 'model') {
        // Handle model terms
        setReferenceDB(prev => ({
          ...prev,
          Model: prev.Model
            .map(term => term.id === source.id ? updatedSource : term)
            .filter(term => term.id !== target.id) // Remove target term
        }));
        showToast(`${target.standard} merged into ${source.standard}!`);
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
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-600 mt-1" size={20} />
              <div>
                <h3 className="text-red-800 font-semibold">Supabase Environment Variables Missing (Preview/Prod)</h3>
                <p className="text-red-700 text-sm mt-1">
                  Database persistence is disabled. Create a <code className="bg-red-100 px-1 rounded">.env</code> file with 
                  <code className="bg-red-100 px-1 rounded">VITE_SUPABASE_URL</code> and 
                  <code className="bg-red-100 px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable data persistence.
                </p>
              </div>
            </div>
          </div>
        )}
        
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
                  <button
                    onClick={processImportData}
                    className="mt-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-indigo-700 flex items-center gap-2 shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <Upload size={20} />
                    Load Data
                  </button>
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
                              <h4 className="font-semibold text-blue-800 mb-3">🎯 Suggested Matches</h4>
                              <div className="space-y-2">
                                {reviewItems[currentReviewIndex].potentialMatches.slice(0, 3).map((match, index) => (
                                  <div key={index} className="bg-white border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="font-medium text-gray-900">{match.term.standard}</div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {Math.round(match.score * 100)}% confidence • {match.reason}
                                      </div>
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

                          <div className="bg-white border-2 border-gray-300 rounded-xl p-6">
                            <h4 className="font-semibold text-gray-800 mb-4">Create New Standard Term</h4>
                            
                            <input
                              type="text"
                              placeholder="Enter new standard term..."
                              value={createTerm}
                              onChange={(e) => setCreateTerm(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                            />

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
                                        Original {mapping}
                                      </th>,
                                      <th key={`std-${originalCol}`} className="px-4 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider">
                                        Standardized {mapping}
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
                                          {row[`Original ${mapping}`] || '-'}
                                        </td>,
                                        <td key={`std-${originalCol}`} className="px-4 py-3 text-sm font-medium text-blue-800">
                                          {row[`Standardized ${mapping}`] || '-'}
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
                                headers.push(`Original ${mapping}`, `Standardized ${mapping}`);
                                fieldGetters.push(
                                  (row) => row[`Original ${mapping}`] || '',
                                  (row) => row[`Standardized ${mapping}`] || ''
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
                          onChange={(e) => setAdminSelectedSystem(e.target.value)}
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
                        <button 
                          onClick={() => handleAddTermClick('deviceType')}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Add Term
                        </button>
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
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      
                      {/* Terms Table */}
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {nomenclatureSystems.find(s => s.id === adminSelectedSystem)?.deviceTypeTerms
                          ?.filter(term => 
                            term.standard.toLowerCase().includes(adminSearchTerms.deviceTypes.toLowerCase()) ||
                            term.variations.some(v => v.toLowerCase().includes(adminSearchTerms.deviceTypes.toLowerCase()))
                          )
                          ?.sort((a, b) => a.standard.localeCompare(b.standard))
                          ?.map(term => (
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
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
                        )) || (
                          <div className="text-center py-8 text-gray-500">
                            {adminSearchTerms.deviceTypes ? 
                              `No device types found matching "${adminSearchTerms.deviceTypes}"` : 
                              "No device types found in this system"
                            }
                          </div>
                        )}
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
                        <button 
                          onClick={() => handleAddTermClick(adminSearchTerms.selectedUniversalType?.toLowerCase() || 'manufacturer')}
                          className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all duration-200 flex items-center gap-2"
                        >
                          <Plus size={16} />
                          Add {adminSearchTerms.selectedUniversalType || 'Manufacturer'}
                        </button>
                      </div>
                      
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {(() => {
                          const selectedType = adminSearchTerms.selectedUniversalType || 'Manufacturer';
                          const terms = referenceDB[selectedType] || [];
                          
                          const filteredTerms = terms.sort((a, b) => a.standard.localeCompare(b.standard));

                          if (filteredTerms.length === 0) {
                            return (
                              <div className="text-center py-8 text-gray-500">
                                No {selectedType.toLowerCase()}s found
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
              <input
                type="text"
                value={newSystemData.name}
                onChange={(e) => setNewSystemData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                placeholder="System name"
                autoFocus
              />
              
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
              <input
                type="text"
                value={editSystemData.name}
                onChange={(e) => setEditSystemData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                placeholder="System name"
                autoFocus
              />
              
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
                <input
                  type="text"
                  value={editTermData.standard}
                  onChange={(e) => setEditTermData(prev => ({ ...prev, standard: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Term name"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Variations</label>
                <input
                  type="text"
                  value={editTermData.variations}
                  onChange={(e) => setEditTermData(prev => ({ ...prev, variations: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Variations (comma separated)"
                />
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
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Merge into:</label>
                <select
                  value={mergeTermData.targetId || ''}
                  onChange={(e) => setMergeTermData(prev => ({ ...prev, targetId: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a term...</option>
                  {(() => {
                    let terms = [];
                    if (mergeTermData.type === 'deviceType') {
                      // Get terms from the selected nomenclature system
                      const selectedSystem = nomenclatureSystems.find(s => s.id === adminSelectedSystem);
                      terms = selectedSystem?.deviceTypeTerms || [];
                    } else {
                      // Get terms from reference database
                      terms = referenceDB[mergeTermData.type === 'manufacturer' ? 'Manufacturer' : 'Model'] || [];
                    }
                    
                    return terms
                      .filter(term => term.id !== mergeTermData.sourceId)
                      .sort((a, b) => a.standard.localeCompare(b.standard))
                      .map(term => (
                        <option key={term.id} value={term.id}>
                          {term.standard}
                        </option>
                      ));
                  })()}
                </select>
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

      {/* Add Term Modal */}
      {showAddTermModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Add New Term</h3>
            </div>
            
            <div className="space-y-4">
              <input
                type="text"
                value={newTermData.standard}
                onChange={(e) => setNewTermData(prev => ({ ...prev, standard: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                placeholder="Term name"
                autoFocus
              />
              
              <input
                type="text"
                value={newTermData.variations}
                onChange={(e) => setNewTermData(prev => ({ ...prev, variations: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                placeholder="Variations (comma separated)"
              />
              
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
