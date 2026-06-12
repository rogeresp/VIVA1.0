import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { router } from './routes.js';

const app = express();
const PORT = process.env.PORT || 3001;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../../dist');

app.use(cors());
app.use(express.json());

app.use('/api', router);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve fotos directory for property photos
const fotosPath = path.resolve(__dirname, '../../../fotos');
app.use('/fotos', express.static(fotosPath));

// Serve built frontend
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Broker Importer running on http://localhost:${PORT}`);
  console.log(`Static files served from: ${distPath}`);
});
