/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme base (Google Opal style)
        'canvas': '#0d0d0d',
        'surface': '#1a1a1a',
        'surface-hover': '#262626',
        'border': '#333333',

        // Node colors (matching screenshots)
        'node-input': '#fef3c7',       // 노란색 (Input)
        'node-input-border': '#f59e0b',
        'node-generate': '#4f46e5',    // 보라색 (Generate/Subagent)
        'node-generate-bg': '#1e1b4b',
        'node-skill': '#06b6d4',       // 시안색 (Skill)
        'node-skill-bg': '#164e63',
        'node-mcp': '#ec4899',         // 핑크색 (MCP)
        'node-mcp-bg': '#831843',
        'node-output': '#10b981',      // 민트색 (Output)
        'node-output-bg': '#064e3b',

        // Status colors
        'status-pending': '#6b7280',
        'status-running': '#3b82f6',
        'status-completed': '#22c55e',
        'status-error': '#ef4444',

        // UI accents
        'accent': '#8b5cf6',
        'accent-hover': '#7c3aed',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flow': 'flow 1.5s ease-in-out infinite',
      },
      keyframes: {
        flow: {
          '0%, 100%': { strokeDashoffset: '0' },
          '50%': { strokeDashoffset: '10' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
