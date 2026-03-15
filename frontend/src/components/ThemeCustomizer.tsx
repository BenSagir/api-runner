import { useTheme } from '../theme';

interface ThemeCustomizerProps {
  onClose: () => void;
}

export default function ThemeCustomizer({ onClose }: ThemeCustomizerProps) {
  const { activeThemeId, setTheme, presets } = useTheme();

  return (
    <div className="theme-customizer-overlay" onClick={onClose}>
      <div className="theme-customizer" onClick={e => e.stopPropagation()}>
        <div className="theme-customizer-header">
          <h3>🎨 Theme</h3>
          <button className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>

        <div className="theme-grid">
          {presets.map(preset => (
            <button
              key={preset.id}
              className={`theme-card ${activeThemeId === preset.id ? 'active' : ''}`}
              onClick={() => setTheme(preset.id)}
            >
              <div className="theme-preview">
                <div
                  className="theme-preview-bg"
                  style={{ background: preset.colors.bgPrimary }}
                >
                  <div
                    className="theme-preview-sidebar"
                    style={{ background: preset.colors.bgSecondary, borderRight: `1px solid ${preset.colors.border}` }}
                  />
                  <div className="theme-preview-main">
                    <div
                      className="theme-preview-header"
                      style={{ background: preset.colors.bgSecondary, borderBottom: `1px solid ${preset.colors.border}` }}
                    />
                    <div className="theme-preview-accent" style={{ background: preset.colors.accent }} />
                  </div>
                </div>
              </div>
              <div className="theme-card-label">
                <span className="theme-card-emoji">{preset.emoji}</span>
                <span className="theme-card-name">{preset.name}</span>
              </div>
              {activeThemeId === preset.id && (
                <div className="theme-card-check">✓</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
