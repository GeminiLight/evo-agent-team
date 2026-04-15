/**
 * Routes aggregation — mounts all sub-routers onto a single parent router.
 */
import { Router } from 'express';
import teamsRouter from './teams.js';
import messagesRouter from './messages.js';
import feedbackRouter from './feedback.js';
import memoryRouter from './memory.js';
import knowledgeRouter from './knowledge.js';
import hooksRouter from './hooks.js';

const router = Router();

/**
 * Path-traversal guard: reject any :id param containing path separators or '..'
 * Applied globally before any route handler.
 */
router.param('id', (req, res, next, id) => {
  if (typeof id !== 'string' || /[\/\\]|\.\./.test(id)) {
    res.status(400).json({ error: 'Invalid team ID' });
    return;
  }
  next();
});

router.use(teamsRouter);
router.use(messagesRouter);
router.use(feedbackRouter);
router.use(memoryRouter);
router.use(knowledgeRouter);
router.use(hooksRouter);

export default router;
