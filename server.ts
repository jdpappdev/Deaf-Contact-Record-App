import express from 'express';
import { createServer as createViteServer } from 'vite';
import { onboardWithIdToken } from './src/server/onboarding';

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Health probe
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Secure server-side onboarding endpoint
  // Validates the caller's Firebase Auth ID token and provisions /workspaces/default/members/{uid}
  app.post('/api/onboard-member', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or malformed Authorization header.',
      });
    }

    const token = authHeader.split('Bearer ')[1].trim();
    const workspaceId = (req.body?.workspaceId as string) || 'default';

    try {
      const result = await onboardWithIdToken(token, undefined, workspaceId);
      if (!result.success) {
        return res.status(result.action === 'rejected' ? 403 : 500).json(result);
      }
      return res.status(200).json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({
        success: false,
        error: `Server onboarding error: ${message}`,
      });
    }
  });

  // In development, mount Vite's connect instance as middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static assets
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
