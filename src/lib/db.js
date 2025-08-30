import { supabase } from './supabaseClient.js';

// Enhanced error logging helper
const logSupabaseError = (operation, error) => {
  console.error(`Supabase error in ${operation}:`, {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
    fullError: error
  });
};

// Validate environment variables
const validateEnvVars = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    const missing = [];
    if (!url) missing.push('VITE_SUPABASE_URL');
    if (!key) missing.push('VITE_SUPABASE_ANON_KEY');
    
    throw new Error(`Supabase environment variables missing: ${missing.join(', ')}`);
  }
  
  return { url, key };
};

// Load catalog data from Supabase
export const loadCatalog = async () => {
  try {
    validateEnvVars();

    // Load nomenclature systems with their device type terms
    const { data: systems, error: systemsError } = await supabase
      .from('nomenclature_systems')
      .select(`
        *,
        device_type_terms (*)
      `)
      .order('name');

    if (systemsError) {
      logSupabaseError('loadCatalog - systems', systemsError);
      throw new Error(`Load systems error: ${systemsError.message} ${systemsError.details ?? ''}`);
    }

    // Load reference database terms
    const { data: manufacturers, error: manufacturersError } = await supabase
      .from('reference_terms')
      .select('*')
      .eq('field', 'Manufacturer')
      .order('standard');

    if (manufacturersError) {
      logSupabaseError('loadCatalog - manufacturers', manufacturersError);
      throw new Error(`Load manufacturers error: ${manufacturersError.message} ${manufacturersError.details ?? ''}`);
    }

    const { data: models, error: modelsError } = await supabase
      .from('reference_terms')
      .select('*')
      .eq('field', 'Model')
      .order('standard');

    if (modelsError) {
      logSupabaseError('loadCatalog - models', modelsError);
      throw new Error(`Load models error: ${modelsError.message} ${modelsError.details ?? ''}`);
    }

    // Transform data to match expected format
    const nomenclatureSystems = systems?.map(system => ({
      id: system.id,
      name: system.name,
      description: system.description,
      lastUpdated: system.last_updated,
      deviceTypeTerms: system.device_type_terms?.map(term => ({
        id: term.id,
        standard: term.standard,
        variations: term.variations || []
      })) || []
    })) || [];

    const referenceDB = {
      Manufacturer: manufacturers?.map(term => ({
        id: term.id,
        standard: term.standard,
        variations: term.variations || []
      })) || [],
      Model: models?.map(term => ({
        id: term.id,
        standard: term.standard,
        variations: term.variations || []
      })) || []
    };

    return { nomenclatureSystems, referenceDB };
  } catch (error) {
    console.error('Error loading catalog:', error);
    throw error;
  }
};

// Upsert device type term
export const upsertDeviceTypeTerm = async (systemId, standard, variation = null) => {
  try {
    validateEnvVars();

    console.log(`Creating device type term: system=${systemId}, standard="${standard}", variation="${variation}"`);

    // Check if term already exists
    const { data: existingTerm, error: searchError } = await supabase
      .from('device_type_terms')
      .select('*')
      .eq('system_id', systemId)
      .eq('standard', standard)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      logSupabaseError('upsertDeviceTypeTerm - search', searchError);
      throw searchError;
    }

    if (existingTerm) {
      console.log(`Term already exists with ID: ${existingTerm.id}`);
      // Term exists, add variation if provided
      if (variation && !existingTerm.variations?.includes(variation)) {
        const updatedVariations = [...(existingTerm.variations || []), variation];
        const { error: updateError } = await supabase
          .from('device_type_terms')
          .update({ variations: updatedVariations })
          .eq('id', existingTerm.id);
        
        if (updateError) {
          logSupabaseError('upsertDeviceTypeTerm - update variations', updateError);
          throw updateError;
        }
        console.log(`Added variation "${variation}" to existing term ${existingTerm.id}`);
        return existingTerm.id;
      }
      return existingTerm.id;
    } else {
      console.log('Creating new device type term...');
      // Create new term
      const { data: newTerm, error: insertError } = await supabase
        .from('device_type_terms')
        .insert({
          system_id: systemId,
          standard,
          variations: variation ? [variation] : []
        })
        .select('id')
        .single();

      if (insertError) {
        logSupabaseError('upsertDeviceTypeTerm - insert', insertError);
        throw insertError;
      }

      console.log(`Successfully created device type term with ID: ${newTerm.id}`);

      // Update last_updated in nomenclature_systems
      const { error: updateSystemError } = await supabase
        .from('nomenclature_systems')
        .update({ last_updated: new Date().toISOString() })
        .eq('id', systemId);

      if (updateSystemError) {
        logSupabaseError('upsertDeviceTypeTerm - update system timestamp', updateSystemError);
        // Don't fail the whole operation for timestamp update failure
        console.warn('Failed to update system timestamp, but term was created successfully');
      }

      return newTerm.id;
    }
  } catch (error) {
    console.error('Error upserting device type term:', error);
    throw error;
  }
};

// Append variation to existing device type term
export const appendVariationToDeviceType = async (termId, variation) => {
  try {
    validateEnvVars();

    console.log(`Appending variation "${variation}" to device type term ID: ${termId}`);

    // Get current term to find system_id
    const { data: term, error: getError } = await supabase
      .from('device_type_terms')
      .select('*')
      .eq('id', termId)
      .single();

    if (getError) {
      logSupabaseError('appendVariationToDeviceType - get term', getError);
      throw new Error(`Get term error: ${getError.message} ${getError.details ?? ''}`);
    }
    if (!term) {
      throw new Error(`Term with ID ${termId} not found`);
    }

    console.log(`Found term:`, term);

    // Add variation if not already present
    const currentVariations = term.variations || [];
    if (!currentVariations.includes(variation)) {
      console.log(`Adding variation "${variation}" to existing variations:`, currentVariations);
      
      const { error: updateError } = await supabase
        .from('device_type_terms')
        .update({ variations: [...currentVariations, variation] })
        .eq('id', termId);

      if (updateError) {
        logSupabaseError('appendVariationToDeviceType - update variations', updateError);
        throw new Error(`Update variations error: ${updateError.message} ${updateError.details ?? ''}`);
      }

      console.log(`Successfully updated variations for term ${termId}`);

      // Update last_updated in nomenclature_systems using system_id
      if (term.system_id) {
        const { error: updateSystemError } = await supabase
          .from('nomenclature_systems')
          .update({ last_updated: new Date().toISOString() })
          .eq('id', term.system_id);

        if (updateSystemError) {
          logSupabaseError('appendVariationToDeviceType - update system timestamp', updateSystemError);
          console.warn('Failed to update system timestamp, but variation was added successfully');
        } else {
          console.log(`Updated system timestamp for system ${term.system_id}`);
        }
      } else {
        console.warn('No system_id found for term');
      }
    } else {
      console.log(`Variation "${variation}" already exists for term ${termId}`);
    }

    return true;
  } catch (error) {
    console.error('Error appending variation to device type:', error);
    throw error;
  }
};

// Upsert reference term
export const upsertReferenceTerm = async (field, standard, variation = null) => {
  try {
    validateEnvVars();

    console.log(`Creating reference term: field="${field}", standard="${standard}", variation="${variation}"`);

    // Validate field value to prevent CHECK constraint violations
    if (field === 'Device Type') {
      throw new Error('Device Type terms should use upsertDeviceTypeTerm, not upsertReferenceTerm');
    }

    if (!['Manufacturer', 'Model'].includes(field)) {
      throw new Error(`Invalid field value: "${field}". Must be 'Manufacturer' or 'Model'`);
    }

    // Check if term already exists
    const { data: existingTerm, error: searchError } = await supabase
      .from('reference_terms')
      .select('*')
      .eq('field', field)
      .eq('standard', standard)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      logSupabaseError('upsertReferenceTerm - search', searchError);
      throw searchError;
    }

    if (existingTerm) {
      console.log(`Term already exists with ID: ${existingTerm.id}`);
      // Term exists, add variation if provided
      if (variation && !existingTerm.variations?.includes(variation)) {
        const updatedVariations = [...(existingTerm.variations || []), variation];
        const { error: updateError } = await supabase
          .from('reference_terms')
          .update({ variations: updatedVariations })
          .eq('id', existingTerm.id);
        
        if (updateError) {
          logSupabaseError('upsertReferenceTerm - update variations', updateError);
          throw updateError;
        }
        console.log(`Added variation "${variation}" to existing term ${existingTerm.id}`);
        return existingTerm.id;
      }
      return existingTerm.id;
    } else {
      console.log('Creating new reference term...');
      // Create new term
      const { data: newTerm, error: insertError } = await supabase
        .from('reference_terms')
        .insert({
          field,
          standard,
          variations: variation ? [variation] : []
        })
        .select('id')
        .single();

      if (insertError) {
        logSupabaseError('upsertReferenceTerm - insert', insertError);
        throw insertError;
      }

      console.log(`Successfully created reference term with ID: ${newTerm.id}`);
      return newTerm.id;
    }
  } catch (error) {
    console.error('Error upserting reference term:', error);
    throw error;
  }
};

// Append variation to existing reference term
export const appendVariationToReference = async (termId, variation) => {
  try {
    validateEnvVars();

    console.log(`Appending variation "${variation}" to reference term ID: ${termId}`);
    console.log(`Variation details:`, {
      value: variation,
      type: typeof variation,
      length: variation.length,
      trimmed: variation.trim(),
      split: variation.split(/\s+/)
    });

    // Get current term
    const { data: term, error: getError } = await supabase
      .from('reference_terms')
      .select('*')
      .eq('id', termId)
      .single();

    if (getError) {
      logSupabaseError('appendVariationToReference - get term', getError);
      throw getError;
    }
    if (!term) {
      throw new Error(`Reference term with ID ${termId} not found`);
    }

    console.log(`Found reference term:`, term);

    // Add variation if not already present
    const currentVariations = term.variations || [];
    if (!currentVariations.includes(variation)) {
      console.log(`Adding variation "${variation}" to existing variations:`, currentVariations);
      
      const { error: updateError } = await supabase
        .from('reference_terms')
        .update({ variations: [...currentVariations, variation] })
        .eq('id', termId);

      if (updateError) {
        logSupabaseError('appendVariationToReference - update variations', updateError);
        throw updateError;
      }
      console.log(`Successfully updated variations for reference term ${termId}`);
    } else {
      console.log(`Variation "${variation}" already exists for reference term ${termId}`);
    }

    return true;
  } catch (error) {
    console.error('Error appending variation to reference term:', error);
    throw error;
  }
};

// Seed default data if database is empty
export const seedDefaultData = async () => {
  try {
    validateEnvVars();

    // Check if we already have data
    const { data: existingSystems, error: checkError } = await supabase
      .from('nomenclature_systems')
      .select('id')
      .limit(1);

    if (checkError) {
      logSupabaseError('seedDefaultData - check existing', checkError);
      throw checkError;
    }

    if (existingSystems && existingSystems.length > 0) {
      return; // Already seeded
    }

    // Create default nomenclature systems
    const { data: umdnsSystem, error: umdnsError } = await supabase
      .from('nomenclature_systems')
      .insert({
        id: 'umdns',
        name: 'UMDNS',
        description: 'Universal Medical Device Nomenclature System',
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (umdnsError) {
      logSupabaseError('seedDefaultData - create UMDNS system', umdnsError);
      throw umdnsError;
    }

    const { data: gmdnSystem, error: gmdnError } = await supabase
      .from('nomenclature_systems')
      .insert({
        id: 'gmdn',
        name: 'GMDN',
        description: 'Global Medical Device Nomenclature',
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (gmdnError) {
      logSupabaseError('seedDefaultData - create GMDN system', gmdnError);
      throw gmdnError;
    }

    // Create default device type terms
    const defaultDeviceTypes = [
      { system_id: 'umdns', standard: 'Electrocautery Unit', variations: ['Electrocauterio', 'ESU', 'Cautery Unit'] },
      { system_id: 'umdns', standard: 'Defibrillator', variations: ['Desfibrilador', 'AED'] },
      { system_id: 'gmdn', standard: 'Ventilator', variations: ['Ventilador', 'Mechanical Ventilator'] }
    ];

    for (const term of defaultDeviceTypes) {
      await supabase
        .from('device_type_terms')
        .insert(term);
    }

    // Create default reference terms
    const defaultManufacturers = [
      { field: 'Manufacturer', standard: 'Philips Healthcare', variations: ['Philips', 'Phillips', 'Philips Medical'] },
      { field: 'Manufacturer', standard: 'GE Healthcare', variations: ['GE', 'General Electric', 'GE Medical'] }
    ];

    const defaultModels = [
      { field: 'Model', standard: 'M3046A', variations: ['M3046', 'M-3046A'] },
      { field: 'Model', standard: 'CARESCAPE R860', variations: ['R860', 'Carescape R860'] }
    ];

    for (const term of [...defaultManufacturers, ...defaultModels]) {
      await supabase
        .from('reference_terms')
        .insert(term);
    }

    console.log('Default data seeded successfully');
  } catch (error) {
    console.error('Error seeding default data:', error);
    throw error;
  }
};

// Delete device type term
export const deleteDeviceTypeTerm = async (termId) => {
  try {
    validateEnvVars();

    console.log(`Deleting device type term: ${termId}`);

    // Get the term to find its system_id before deletion
    const { data: term, error: getError } = await supabase
      .from('device_type_terms')
      .select('system_id')
      .eq('id', termId)
      .single();

    if (getError) {
      logSupabaseError('deleteDeviceTypeTerm - get term', getError);
      throw getError;
    }

    // Delete the term
    const { error: deleteError } = await supabase
      .from('device_type_terms')
      .delete()
      .eq('id', termId);

    if (deleteError) {
      logSupabaseError('deleteDeviceTypeTerm - delete', deleteError);
      throw deleteError;
    }

    // Update last_updated in nomenclature_systems
    const { error: updateSystemError } = await supabase
      .from('nomenclature_systems')
      .update({ last_updated: new Date().toISOString() })
      .eq('id', term.system_id);

    if (updateSystemError) {
      logSupabaseError('deleteDeviceTypeTerm - update system timestamp', updateSystemError);
      // Don't fail the whole operation for timestamp update failure
      console.warn('Failed to update system timestamp, but term was deleted successfully');
    }

    console.log(`Successfully deleted device type term: ${termId}`);
    return true;
  } catch (error) {
    console.error('Error deleting device type term:', error);
    throw error;
  }
};

// Test Supabase connectivity and write permissions
export const canWriteToSupabase = async () => {
  try {
    validateEnvVars();
  
  // Try to insert a test record into a temporary table or use a simple query
  const { data, error } = await supabase
    .from('nomenclature_systems')
    .select('id')
    .limit(1);
  
  if (error) {
    logSupabaseError('canWriteToSupabase - test query', error);
    return { canWrite: false, error: error.message, code: error.code };
  }
  
  return { canWrite: true, error: null, code: null };
} catch (error) {
  return { canWrite: false, error: error.message, code: null };
}
};

// Update device type term variations (for merging)
export const updateDeviceTypeTermVariations = async (termId, variations) => {
  try {
    validateEnvVars();

    const { error } = await supabase
      .from('device_type_terms')
      .update({ variations })
      .eq('id', termId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    logSupabaseError('updateDeviceTypeTermVariations', error);
    throw error;
  }
};

// Update nomenclature system last_updated timestamp
export const updateNomenclatureSystemTimestamp = async (systemId) => {
  try {
    validateEnvVars();

    const { error } = await supabase
      .from('nomenclature_systems')
      .update({ last_updated: new Date().toISOString() })
      .eq('id', systemId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    logSupabaseError('updateNomenclatureSystemTimestamp', error);
    throw error;
  }
};

// Update device type term (standard name and variations)
export const updateDeviceTypeTerm = async (termId, standard, variations) => {
  try {
    validateEnvVars();

    // Prepare update data without updated_at to avoid schema issues
    const updateData = { 
      standard,
      variations
    };

    const { error } = await supabase
      .from('device_type_terms')
      .update(updateData)
      .eq('id', termId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    logSupabaseError('updateDeviceTypeTerm', error);
    throw error;
  }
};

// Update reference term (standard name and variations)
export const updateReferenceTerm = async (termId, standard, variations) => {
  try {
    validateEnvVars();

    const updateData = { 
      standard,
      variations
    };

    const { error } = await supabase
      .from('reference_terms')
      .update(updateData)
      .eq('id', termId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    logSupabaseError('updateReferenceTerm', error);
    throw error;
  }
};

// Delete reference term (manufacturer or model)
export const deleteReferenceTerm = async (termId) => {
  try {
    validateEnvVars();

    const { error } = await supabase
      .from('reference_terms')
      .delete()
      .eq('id', termId);

    if (error) throw error;

    console.log(`Successfully deleted reference term: ${termId}`);
    return true;
  } catch (error) {
    logSupabaseError('deleteReferenceTerm', error);
    throw error;
  }
};

// Create new nomenclature system
export const createNomenclatureSystem = async (name, description) => {
  try {
    validateEnvVars();

    const { data, error } = await supabase
      .from('nomenclature_systems')
      .insert({
        name: name.trim(),
        description: description.trim(),
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Successfully created nomenclature system: ${name}`);
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      lastUpdated: data.last_updated
    };
  } catch (error) {
    logSupabaseError('createNomenclatureSystem', error);
    throw error;
  }
};

// Update nomenclature system
export const updateNomenclatureSystem = async (systemId, name, description) => {
  try {
    validateEnvVars();

    const { data, error } = await supabase
      .from('nomenclature_systems')
      .update({
        name: name.trim(),
        description: description.trim(),
        last_updated: new Date().toISOString()
      })
      .eq('id', systemId)
      .select()
      .single();

    if (error) throw error;

    console.log(`Successfully updated nomenclature system: ${name}`);
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      lastUpdated: data.last_updated
    };
  } catch (error) {
    logSupabaseError('updateNomenclatureSystem', error);
    throw error;
  }
};

// Delete nomenclature system
export const deleteNomenclatureSystem = async (systemId) => {
  try {
    validateEnvVars();

    // First, delete all device type terms in this system
    const { error: deleteTermsError } = await supabase
      .from('device_type_terms')
      .delete()
      .eq('system_id', systemId);

    if (deleteTermsError) {
      logSupabaseError('deleteNomenclatureSystem - delete terms', deleteTermsError);
      throw deleteTermsError;
    }

    // Then delete the system itself
    const { error: deleteSystemError } = await supabase
      .from('nomenclature_systems')
      .delete()
      .eq('id', systemId);

    if (deleteSystemError) {
      logSupabaseError('deleteNomenclatureSystem - delete system', deleteSystemError);
      throw deleteSystemError;
    }

    console.log(`Successfully deleted nomenclature system: ${systemId}`);
    return true;
  } catch (error) {
    logSupabaseError('deleteNomenclatureSystem', error);
    throw error;
  }
};

// Bulk upload device type terms
export const bulkUploadDeviceTypeTerms = async (systemId, terms) => {
  try {
    validateEnvVars();

    let created = 0;
    let updated = 0;
    let errors = [];

    for (const term of terms) {
      try {
        if (term.standard && term.standard.trim()) {
          // Check if term already exists
          const { data: existingTerm } = await supabase
            .from('device_type_terms')
            .select('id, variations')
            .eq('system_id', systemId)
            .eq('standard', term.standard.trim())
            .single();

          if (existingTerm) {
            // Update existing term with new variations
            const updatedVariations = [...new Set([
              ...(existingTerm.variations || []),
              ...(term.variations || [])
            ])];

            const { error: updateError } = await supabase
              .from('device_type_terms')
              .update({ 
                variations: updatedVariations
              })
              .eq('id', existingTerm.id);

            if (updateError) throw updateError;
            updated++;
          } else {
            // Create new term
            const { error: insertError } = await supabase
              .from('device_type_terms')
              .insert({
                system_id: systemId,
                standard: term.standard.trim(),
                variations: term.variations || []
              });

            if (insertError) throw insertError;
            created++;
          }
        }
      } catch (termError) {
        console.error(`Error processing term "${term.standard}":`, termError);
        errors.push({
          term: term.standard,
          error: termError.message
        });
      }
    }

    // Update system timestamp
    await updateNomenclatureSystemTimestamp(systemId);

    console.log(`Bulk upload completed: ${created} created, ${updated} updated, ${errors.length} errors`);
    return { created, updated, errors };
  } catch (error) {
    logSupabaseError('bulkUploadDeviceTypeTerms', error);
    throw error;
  }
};
