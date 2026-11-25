import { Router, Request, Response } from 'express';
import { getDBStatus } from '../config/db';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  const dbInfo = getDBStatus();
  const uptimeSeconds = process.uptime();
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(uptimeSeconds)}s`,
    database: {
      status: dbInfo.status,
      readyState: dbInfo.readyState,
    },
    system: {
      nodeVersion: process.version,
      memory: {
        rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
    },
  });
});

export default router;
