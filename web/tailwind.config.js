import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        discord: {
          dark: '#313338',      // Background
          darker: '#2b2d31',    // Sidebar
          darkest: '#1e1f22',   // Left channel list / Grid base
          light: '#dbdee1',     // Text
          muted: '#949ba4',     // Muted text
          cyan: '#00aff4',      // CodeHive Accent
          green: '#23a559',     // Success
          yellow: '#f0b232',    // Warning
          red: '#f23f42',       // Danger
        }
      },
    },
  },
  plugins: [],
} satisfies Config;
