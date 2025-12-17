import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'run-script-middleware',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/__run-export' && req.method === 'GET') {
            const { exec } = await import('child_process');
            exec('./scripts/export_query.sh', (error, stdout, stderr) => {
              if (error) {
                console.error(`exec error: ${error}`);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message, stderr }));
                return;
              }
              console.log(`stdout: ${stdout}`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, stdout }));
            });
          } else {
            next();
          }
        });
      },
    },
  ],
  base: '/text2sql_pilotreport/',
  build: {
    outDir: 'docs',
  },
})
