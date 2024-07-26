import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server:{
    port:3001,
    //get rid of the CORS error 
    proxy:{
      '/api':{
        target:'http://localhost:3000',
        changeOrigin:true,
        secure:false,
        
      } 
    }
  }
})
