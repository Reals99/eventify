// ── Color theme presets ───────────────────────────────────────────────────────
export const THEME_PRESETS = [
  {
    id: 'purple',
    label: 'Royal Purple',
    primary: '#7F77DD',
    secondary: '#EEEDFE',
    accent: '#3C3489',
    text: '#FFFFFF',
    preview: ['#7F77DD', '#EEEDFE', '#3C3489'],
  },
  {
    id: 'teal',
    label: 'Emerald',
    primary: '#1D9E75',
    secondary: '#E1F5EE',
    accent: '#085041',
    text: '#FFFFFF',
    preview: ['#1D9E75', '#E1F5EE', '#085041'],
  },
  {
    id: 'coral',
    label: 'Sunset Coral',
    primary: '#D85A30',
    secondary: '#FAECE7',
    accent: '#7A2810',
    text: '#FFFFFF',
    preview: ['#D85A30', '#FAECE7', '#7A2810'],
  },
  {
    id: 'amber',
    label: 'Golden Amber',
    primary: '#C4841A',
    secondary: '#FEF3DC',
    accent: '#6B4209',
    text: '#FFFFFF',
    preview: ['#C4841A', '#FEF3DC', '#6B4209'],
  },
  {
    id: 'dark',
    label: 'Midnight',
    primary: '#1A1A2E',
    secondary: '#16213E',
    accent: '#E94560',
    text: '#FFFFFF',
    preview: ['#1A1A2E', '#16213E', '#E94560'],
  },
  {
    id: 'rose',
    label: 'Rose Gold',
    primary: '#C9748F',
    secondary: '#FDEEF3',
    accent: '#7B2D45',
    text: '#FFFFFF',
    preview: ['#C9748F', '#FDEEF3', '#7B2D45'],
  },
  {
    id: 'ocean',
    label: 'Ocean Blue',
    primary: '#1A6EB5',
    secondary: '#E3F0FB',
    accent: '#0C3460',
    text: '#FFFFFF',
    preview: ['#1A6EB5', '#E3F0FB', '#0C3460'],
  },
  {
    id: 'custom',
    label: 'Custom',
    primary: '#7F77DD',
    secondary: '#EEEDFE',
    accent: '#3C3489',
    text: '#FFFFFF',
    preview: ['#7F77DD', '#EEEDFE', '#3C3489'],
    isCustom: true,
  },
];

// ── Frame / overlay design templates ─────────────────────────────────────────
export const FRAME_STYLES = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean text bar at the bottom',
    icon: '▬',
    // FFmpeg filter description (used server-side)
    ffmpegStyle: 'drawbox=y=ih-80:w=iw:h=80:color=black@0.55:t=fill,drawtext=...',
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Large full-width banner with accent color',
    icon: '█',
    ffmpegStyle: 'drawbox=y=0:w=iw:h=90:color={primary}@1:t=fill,...',
  },
  {
    id: 'elegant',
    label: 'Elegant',
    description: 'Serif font, thin gold-line border, soft overlay',
    icon: '◈',
    ffmpegStyle: 'drawbox=...',
  },
  {
    id: 'neon',
    label: 'Neon',
    description: 'Glowing outline text on dark background',
    icon: '◉',
    ffmpegStyle: 'drawbox=...',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Broadcast-style lower third with logo space',
    icon: '▤',
    ffmpegStyle: 'drawbox=...',
  },
];

// ── Font style options ────────────────────────────────────────────────────────
export const FONT_STYLES = [
  { id: 'modern',    label: 'Modern',    css: "'Inter', sans-serif" },
  { id: 'serif',     label: 'Serif',     css: "'Playfair Display', serif" },
  { id: 'playful',   label: 'Playful',   css: "'Pacifico', cursive" },
  { id: 'corporate', label: 'Corporate', css: "'Roboto', sans-serif" },
];

// ── Social platform meta ──────────────────────────────────────────────────────
export const SOCIAL_PLATFORMS = [
  { id: 'tiktok',    label: 'TikTok',    color: '#010101', icon: '🎵', ratio: '9:16' },
  { id: 'instagram', label: 'Instagram', color: '#E1306C', icon: '📸', ratio: '1:1'  },
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', icon: '👥', ratio: '16:9' },
  { id: 'twitter',   label: 'X (Twitter)', color: '#000000', icon: '𝕏', ratio: '16:9' },
  { id: 'youtube',   label: 'YouTube',   color: '#FF0000', icon: '▶️', ratio: '16:9' },
];
