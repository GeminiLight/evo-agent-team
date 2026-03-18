/**
 * Routes aggregation — mounts all sub-routers onto a single parent router.
 */
import { Router } from 'express';
import teamsRouter from './teams.js';
import messagesRouter from './messages.js';
import feedbackRouter from './feedback.js';
import memoryRouter from './memory.js';
import knowledgeRouter from './knowledge.js';

const router = Router();

router.use(teamsRouter);
router.use(messagesRouter);
router.use(feedbackRouter);
router.use(memoryRouter);
router.use(knowledgeRouter);

export default router;
