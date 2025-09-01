# Bulk Upload Guide for Medical Inventory Standardizer

## Overview

The Bulk Upload feature allows Admin Users to upload substantial amounts of terms and variations into the Device Type, Manufacturer, and Model fields. This feature integrates with the database and becomes part of the reference process under the selected nomenclature system.

## Access

1. **Admin Access Required**: Use password `TINCTester` to access the Admin Tab
2. **Navigate to Bulk Upload**: Click on the "📤 Bulk Upload" section in the Admin Tab
3. **Quick Access**: Use the "Bulk Upload" button in Device Types or Universal Terms sections

## Supported Upload Types

### 1. Device Type Terms
- **Target**: Nomenclature Systems (UMDNS, GMDN, etc.)
- **Purpose**: Standardize medical device type terminology
- **Example**: Electrocautery Unit, Defibrillator, Ventilator

### 2. Manufacturer Terms
- **Target**: Universal reference database
- **Purpose**: Standardize manufacturer names and abbreviations
- **Example**: Philips Healthcare, GE Healthcare, Siemens Healthineers

### 3. Model Terms
- **Target**: Universal reference database
- **Purpose**: Standardize model numbers and names
- **Example**: M3046A, CARESCAPE R860, V60

## Data Format

### Format: Tab-Separated Values (TSV) or CSV

### All Upload Types (No Header Required)
For all upload types, no header row is needed:

#### Format:
- **First column**: Standard term name
- **Second column**: Optional comma-separated variations

#### Example TSV Format (Device Types):
```tsv
Electrocautery Unit	ESU, Cautery Unit, Electrocauterio
Defibrillator	AED, Desfibrilador, Defib
Ventilator	Mechanical Ventilator, Ventilador
```

#### Example TSV Format (Manufacturers):
```tsv
Philips Healthcare	Philips, Phillips, Philips Medical
GE Healthcare	GE, General Electric, GE Medical
Siemens Healthineers	Siemens, Siemens Medical, Siemens Healthcare
```

#### Example TSV Format (Models):
```tsv
M3046A	M3046, M-3046A, M3046A Monitor
CARESCAPE R860	R860, Carescape R860, GE R860
V60	V60 Ventilator, Respironics V60
```

#### Example CSV Format:
```csv
Electrocautery Unit,ESU, Cautery Unit, Electrocauterio
Defibrillator,AED, Desfibrilador, Defib
Ventilator,Mechanical Ventilator, Ventilador
```

## Upload Process

### 1. **Configure Upload Settings**
   - Select upload type (Device Type, Manufacturer, or Model)
   - Choose nomenclature system (for Device Types)
   - Select delimiter (Tab, Comma, or Semicolon)

### 2. **Prepare Data**
   - No header row needed for any upload type
   - First column: Standard term name
   - Second column: Optional comma-separated variations
   - Separate variations with commas
   - Use consistent formatting

### 3. **Preview Data**
   - Click "Preview Data" to validate format
   - Review parsed terms and variations
   - Check for any parsing errors

### 4. **Upload Terms**
   - Click "Upload Terms" to process
   - Monitor progress and results
   - Review success/error statistics

## Database Integration

### Smart Merging
- **New Terms**: Creates new entries in the database
- **Existing Terms**: Merges variations with existing terms
- **Duplicate Prevention**: Avoids creating duplicate standard terms

### Batch Processing
- **Efficient Uploads**: Processes terms in batches of 50
- **Database Optimization**: Prevents overwhelming the database
- **Error Handling**: Continues processing even if individual terms fail

### Timestamp Updates
- **System Timestamps**: Updates last_updated for nomenclature systems
- **Audit Trail**: Maintains record of when terms were added/modified

## Best Practices

### 1. **Data Preparation**
   - Use consistent terminology
   - Include common abbreviations and variations
   - Validate data before upload
   - Test with small datasets first

### 2. **Term Standardization**
   - Use official medical terminology when possible
   - Include both formal and informal names
   - Consider regional variations and languages
   - Maintain consistency across uploads

### 3. **Quality Control**
   - Review preview data carefully
   - Check for typos and formatting issues
   - Verify variations are meaningful
   - Monitor error reports after upload

## Error Handling

### Common Issues
- **Missing Headers**: Ensure `standard` column is present
- **Invalid Format**: Check delimiter and data structure
- **Empty Terms**: Standard terms cannot be empty
- **Database Errors**: Network or permission issues

### Error Reporting
- **Detailed Logs**: Each error includes term and reason
- **Error Count**: Summary of failed uploads
- **Success Metrics**: Count of created and updated terms

## Sample Data Files

### Device Types Sample
See `sample_bulk_upload_data.tsv` for a comprehensive example of medical device types with variations (header format).

### Manufacturers Sample
See `sample_manufacturers.tsv` for manufacturer terms in no-header format:
```tsv
Philips Healthcare	Philips, Phillips, Philips Medical
GE Healthcare	GE, General Electric, GE Medical
Siemens Healthineers	Siemens, Siemens Medical, Siemens Healthcare
```

### Models Sample
See `sample_models.tsv` for model terms in no-header format:
```tsv
M3046A	M3046, M-3046A, M3046A Monitor
CARESCAPE R860	R860, Carescape R860, GE R860
V60	V60 Ventilator, Respironics V60
```

### Format Summary
- **Device Type Terms**: Use `sample_bulk_upload_data.tsv` (no header row)
- **Manufacturer Terms**: Use `sample_manufacturers.tsv` (no header row)
- **Model Terms**: Use `sample_models.tsv` (no header row)

**Note**: All sample files now use the same no-header format for consistency.

## Integration with Standardization Process

### Reference Process
- **Immediate Availability**: Uploaded terms are immediately available for standardization
- **Search Integration**: Terms appear in search results during data review
- **Variation Matching**: Both standard terms and variations are used for matching
- **Consistent Results**: Maintains standardization quality across all uploaded terms

### Workflow Integration
1. **Upload Terms**: Admin uploads terminology via bulk upload
2. **Data Import**: Users import medical inventory data
3. **Automatic Matching**: System uses uploaded terms for standardization
4. **Manual Review**: Users review any unmatched terms
5. **Export Results**: Standardized data with consistent terminology

## Performance Considerations

### Large Uploads
- **Batch Processing**: Handles thousands of terms efficiently
- **Progress Tracking**: Real-time feedback during upload
- **Memory Management**: Optimized for large datasets
- **Error Recovery**: Continues processing despite individual failures

### Database Performance
- **Indexed Queries**: Fast term lookups during standardization
- **Efficient Storage**: Optimized data structure for medical terminology
- **Scalability**: Designed to handle growing terminology databases

## Support and Troubleshooting

### Common Questions
- **Q**: How many terms can I upload at once?
- **A**: The system can handle thousands of terms efficiently through batch processing.

- **Q**: What happens if a term already exists?
- **A**: Existing terms are updated with new variations, preventing duplicates.

- **Q**: Can I upload terms in different languages?
- **A**: Yes, variations can include terms in multiple languages.

### Getting Help
- Check the preview functionality for format validation
- Review error messages for specific issues
- Use the sample data files as templates
- Contact system administrators for technical support

---

**Note**: This bulk upload feature is designed for administrative use and requires proper authorization. Always validate data before uploading to maintain terminology quality and consistency.
