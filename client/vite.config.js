import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: "https://merndashboard-n4db.onrender.com/",
  plugins: [react()],
})
