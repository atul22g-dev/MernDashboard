import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: "https://mern-dashboard-atul22g-dev.vercel.app/",
  plugins: [react()],
})
