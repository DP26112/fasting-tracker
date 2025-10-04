// client/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  
  // The 'server' block must be a top-level property of the defineConfig object
  server: { 
    proxy: {
      // Key must match the prefix in your Axios call: '/api'
      '/api': {
        target: 'http://localhost:3001', // Target must be your backend port
        changeOrigin: true,
      },
    },
  }, // <--- Ensure a comma is not here if it's the last property
}); // <--- CRITICAL: Ensure this closing parenthesis and semicolon are present