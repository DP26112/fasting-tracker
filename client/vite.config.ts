// client/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Remove: import path from 'path'; 

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-virtuoso'], 
  },
  // Ensure there are no 'resolve' or 'alias' blocks here!
});