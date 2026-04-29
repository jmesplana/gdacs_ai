import {
  ADMIN_COLOR_PALETTES,
  ADMIN_CLASSIFICATION_METHODS,
  ADMIN_FILL_MODES,
  ADMIN_METRIC_MEANINGS,
  NO_DATA_STYLES,
  getPalettePreview
} from '../../utils/adminDatasetStyling';

const meaningLabels = {
  [ADMIN_METRIC_MEANINGS.WORSE_HIGH]: 'High = worse',
  [ADMIN_METRIC_MEANINGS.BETTER_HIGH]: 'High = better',
  [ADMIN_METRIC_MEANINGS.NEUTRAL]: 'Neutral'
};

const paletteLabels = {
  [ADMIN_COLOR_PALETTES.AUTO]: 'Auto',
  [ADMIN_COLOR_PALETTES.RED]: 'Red',
  [ADMIN_COLOR_PALETTES.GREEN]: 'Green',
  [ADMIN_COLOR_PALETTES.BLUE]: 'Blue',
  [ADMIN_COLOR_PALETTES.ORANGE]: 'Orange',
  [ADMIN_COLOR_PALETTES.PURPLE]: 'Purple',
  [ADMIN_COLOR_PALETTES.GRAY]: 'Gray'
};

const modeOptions = [
  { value: ADMIN_FILL_MODES.NONE, label: 'Off' },
  { value: ADMIN_FILL_MODES.RISK, label: 'Disaster / conflict' },
  { value: ADMIN_FILL_MODES.DATASET, label: 'Uploaded data' }
];

const buttonBaseStyle = {
  flex: 1,
  minHeight: '36px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#334155',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
  padding: '8px 10px',
  fontFamily: "'Inter', sans-serif"
};

const selectStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  backgroundColor: 'white',
  color: '#0f172a',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: "'Inter', sans-serif"
};

const smallLabelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '12px',
  fontWeight: 700,
  color: '#475569',
  fontFamily: "'Inter', sans-serif"
};

export default function AdminStyleControls({
  districts = [],
  facilities = [],
  numericFields = [],
  adminFillMode,
  setAdminFillMode,
  adminMetricField,
  setAdminMetricField,
  adminMetricMeaning,
  setAdminMetricMeaning,
  adminClassification,
  setAdminClassification,
  adminClassCount,
  setAdminClassCount,
  adminColorPalette,
  setAdminColorPalette,
  adminReverseColors,
  setAdminReverseColors,
  adminNoDataStyle,
  setAdminNoDataStyle,
  datasetJoinSummary = null,
  legend = [],
  scaleInfo = null
}) {
  const hasDistricts = districts.length > 0;
  const hasRows = facilities.length > 0;
  const hasNumericFields = numericFields.length > 0;
  const selectedField = numericFields.find((item) => item.field === adminMetricField);
  const suggestedMeaning = selectedField?.suggestedMeaning;
  const palettePreview = getPalettePreview(adminColorPalette, adminMetricMeaning);
  const quantileClassLimitReached = adminClassification === ADMIN_CLASSIFICATION_METHODS.QUANTILE
    && scaleInfo
    && scaleInfo.appliedClassCount < scaleInfo.requestedClassCount;

  const activateSuggestedMeaning = () => {
    if (suggestedMeaning) setAdminMetricMeaning(suggestedMeaning);
  };

  return (
    <div style={{
      marginTop: '20px',
      padding: '14px',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      background: '#f8fafc',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--aidstack-navy)' }}>
          Admin Fill
        </div>
        {datasetJoinSummary && adminFillMode === ADMIN_FILL_MODES.DATASET && (
          <div style={{ fontSize: '11px', color: '#475569', fontWeight: 700 }}>
            {datasetJoinSummary.matchedDistricts} of {districts.length} matched
          </div>
        )}
      </div>

      <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: '12px' }}>
        Boundary styling is available once admin areas are loaded.
        {` `}
        <strong>Disaster / conflict</strong> uses the current operational context.
        {` `}
        <strong>Uploaded data</strong> is only needed when you want to color admin areas from site or activity fields.
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {modeOptions.map((option) => {
          const active = adminFillMode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setAdminFillMode(option.value)}
              disabled={!hasDistricts && option.value !== ADMIN_FILL_MODES.NONE}
              style={{
                ...buttonBaseStyle,
                background: active ? 'var(--aidstack-navy)' : '#ffffff',
                borderColor: active ? 'var(--aidstack-navy)' : '#cbd5e1',
                color: active ? '#ffffff' : '#334155',
                opacity: !hasDistricts && option.value !== ADMIN_FILL_MODES.NONE ? 0.5 : 1
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {adminFillMode === ADMIN_FILL_MODES.DATASET && (
        <>
          {!hasRows && (
            <div style={{ fontSize: '12px', color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
              Upload a CSV or Excel file with latitude, longitude, and numeric fields to color admin areas by uploaded data.
            </div>
          )}

          {hasRows && !hasNumericFields && (
            <div style={{ fontSize: '12px', color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
              No numeric data columns were detected beyond coordinates.
            </div>
          )}

          {hasNumericFields && (
            <>
              <div style={{ marginBottom: '12px' }}>
                <label style={smallLabelStyle}>Field</label>
                <select
                  value={adminMetricField || ''}
                  onChange={(event) => setAdminMetricField(event.target.value)}
                  style={selectStyle}
                >
                  {numericFields.map((item) => (
                    <option key={item.field} value={item.field}>
                      {item.field}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={smallLabelStyle}>Meaning</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {Object.values(ADMIN_METRIC_MEANINGS).map((meaning) => {
                    const active = adminMetricMeaning === meaning;
                    return (
                      <button
                        key={meaning}
                        type="button"
                        onClick={() => setAdminMetricMeaning(meaning)}
                        style={{
                          ...buttonBaseStyle,
                          background: active ? '#0f766e' : '#ffffff',
                          borderColor: active ? '#0f766e' : '#cbd5e1',
                          color: active ? '#ffffff' : '#334155'
                        }}
                      >
                        {meaningLabels[meaning]}
                      </button>
                    );
                  })}
                </div>
                {suggestedMeaning && suggestedMeaning !== adminMetricMeaning && (
                  <button
                    type="button"
                    onClick={activateSuggestedMeaning}
                    style={{
                      marginTop: '8px',
                      border: 'none',
                      background: 'transparent',
                      color: '#0f766e',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Use suggested meaning: {meaningLabels[suggestedMeaning]}
                  </button>
                )}
              </div>

              <details style={{ marginBottom: '12px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '12px', fontWeight: 800, color: '#475569' }}>
                  Scale options
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 92px', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label style={smallLabelStyle}>Classification</label>
                    <select
                      value={adminClassification}
                      onChange={(event) => setAdminClassification(event.target.value)}
                      style={selectStyle}
                    >
                      <option value={ADMIN_CLASSIFICATION_METHODS.QUANTILE}>Quantile</option>
                      <option value={ADMIN_CLASSIFICATION_METHODS.EQUAL_INTERVAL}>Equal interval</option>
                    </select>
                  </div>
                  <div>
                    <label style={smallLabelStyle}>Classes</label>
                    <input
                      type="number"
                      min="3"
                      max="7"
                      value={adminClassCount}
                      onChange={(event) => setAdminClassCount(Math.min(7, Math.max(3, Number(event.target.value) || 5)))}
                      style={selectStyle}
                    />
                    {quantileClassLimitReached && (
                      <div style={{ marginTop: '6px', fontSize: '11px', color: '#9a3412', lineHeight: 1.5 }}>
                        Quantile is showing {scaleInfo.appliedClassCount} class{scaleInfo.appliedClassCount === 1 ? '' : 'es'} because the matched data only has {scaleInfo.distinctValueCount} distinct value{scaleInfo.distinctValueCount === 1 ? '' : 's'}.
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={smallLabelStyle}>Color palette</label>
                  <select
                    value={adminColorPalette}
                    onChange={(event) => setAdminColorPalette(event.target.value)}
                    style={selectStyle}
                  >
                    {Object.values(ADMIN_COLOR_PALETTES).map((palette) => (
                      <option key={palette} value={palette}>
                        {paletteLabels[palette]}
                      </option>
                    ))}
                  </select>
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    {palettePreview.map((color) => (
                      <span
                        key={`${adminColorPalette}-${adminMetricMeaning}-${color}`}
                        style={{ flex: 1, height: '10px', borderRadius: '999px', background: color, border: '1px solid rgba(15,23,42,0.08)' }}
                      />
                    ))}
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                    Auto uses red for worse, green for better, and blue for neutral. Manual palettes stay constrained to accessible sequential ramps.
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={adminReverseColors}
                      onChange={(event) => setAdminReverseColors(event.target.checked)}
                    />
                    Reverse color direction
                  </label>
                  <div style={{ marginTop: '6px', fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>
                    Use reverse when the visual direction should flip, such as moving from light-to-dark or dark-to-light within the same palette.
                  </div>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <label style={smallLabelStyle}>No data</label>
                  <select
                    value={adminNoDataStyle}
                    onChange={(event) => setAdminNoDataStyle(event.target.value)}
                    style={selectStyle}
                  >
                    <option value={NO_DATA_STYLES.TRANSPARENT}>Transparent</option>
                    <option value={NO_DATA_STYLES.GRAY}>Gray</option>
                  </select>
                </div>
              </details>

              {datasetJoinSummary && (
                <div style={{ fontSize: '12px', color: '#475569', marginBottom: legend.length ? '10px' : 0, lineHeight: 1.5 }}>
                  {datasetJoinSummary.matchedRows} of {datasetJoinSummary.totalRows} uploaded rows matched admin areas.
                  {datasetJoinSummary.unmatchedRows > 0 ? ` ${datasetJoinSummary.unmatchedRows} row${datasetJoinSummary.unmatchedRows === 1 ? '' : 's'} had no polygon match.` : ''}
                </div>
              )}

              {legend.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {legend.map((item) => (
                    <div key={`${item.color}-${item.label}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155' }}>
                      <span style={{ width: '18px', height: '14px', borderRadius: '3px', background: item.color, border: '1px solid rgba(15,23,42,0.16)' }} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
