import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { demoChallenges } from './data.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'civicbridge-development-only-secret');
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured in production.');
const roles = ['CITIZEN', 'STUDENT', 'RESEARCHER', 'INDUSTRY_PARTNER', 'GOVERNMENT_REPRESENTATIVE'];
let databaseAvailable = true;
const demoUsers = new Map();
const demoSolutions = [];
const demoComments = [];
const demoCollaborations = new Set();
const demoProgress = new Map();
const demoNotifications = new Map();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

async function withDatabase(action, fallback) {
  if (!databaseAvailable) return fallback();
  try { return await action(); } catch (error) {
    databaseAvailable = false;
    console.warn('Database unavailable; using clearly labelled demo fallback:', error.message);
    return fallback();
  }
}
const serialize = (item) => item && ({ ...item, status: item.status === 'in_progress' ? 'in-progress' : item.status, demo: String(item.id).startsWith('demo-') });
const tokenFor = (user) => jwt.sign({ sub: user.id, role: user.role, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '2h' });
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });
  try { req.user = jwt.verify(header.slice(7), JWT_SECRET); next(); } catch { return res.status(401).json({ error: 'Invalid or expired token.' }); }
}
function adminOnly(req, res, next) { return req.user.role === 'ADMINISTRATOR' ? next() : res.status(403).json({ error: 'Administrator access required.' }); }
function validateText(value, max = 5000) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
const categoryRules = [
  ['Healthcare', /\b(health|clinic|hospital|mental|doctor|care)\b/i],
  ['Education', /\b(school|student|teacher|library|learn|education)\b/i],
  ['Environment', /\b(tree|park|green|climate|water|recycl|pollution)\b/i],
  ["Women's Safety", /\b(safety|safe|harass|violence|lighting|crossing)\b/i],
  ['Employment', /\b(job|work|worker|employment|bus|transport)\b/i],
  ['Accessibility', /\b(access|wheelchair|disab|inclusive|ramp)\b/i],
  ['Public Infrastructure', /\b(road|bridge|street|sidewalk|infrastructure|traffic)\b/i]
];
function suggestCategory(text = '') {
  const found = categoryRules.find(([, rule]) => rule.test(text));
  return { category: found?.[0] || 'Other', explanation: found ? `Matched community keywords related to ${found[0].toLowerCase()}.` : 'No specific category keywords matched; choose the category that best fits.', confidence: found ? 0.82 : 0.25 };
}
function tokens(text = '') { return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(word => word.length > 3)); }
function similarity(left, right) { const a = tokens(left); const b = tokens(right); if (!a.size || !b.size) return 0; const intersection = [...a].filter(word => b.has(word)).length; return intersection / new Set([...a, ...b]).size; }
async function addNotification(recipientId, type, message, challengeId) {
  if (!recipientId) return;
  if (databaseAvailable) {
    try { await prisma.notification.create({ data: { recipientId, type, message, challengeId } }); return; } catch { databaseAvailable = false; }
  }
  const list = demoNotifications.get(recipientId) || [];
  list.unshift({ id: `demo-notification-${Date.now()}-${list.length}`, recipientId, type, message, challengeId, createdAt: new Date().toISOString(), readAt: null });
  demoNotifications.set(recipientId, list);
}
function paginate(items, page = 1, limit = 12) {
  const safePage = Math.max(1, Number(page) || 1); const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));
  return { data: items.slice((safePage - 1) * safeLimit, safePage * safeLimit), pagination: { page: safePage, limit: safeLimit, total: items.length, pages: Math.ceil(items.length / safeLimit) } };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, database: databaseAvailable ? 'connected' : 'demo-fallback' }));
app.get('/api/challenges', async (req, res) => {
  const { search = '', category, status, location, sort = 'recent', page = 1, limit = 12 } = req.query;
  const validStatuses = ['All', 'open', 'in-progress', 'resolved'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid challenge status.' });
  const dbStatus = status === 'in-progress' ? 'in_progress' : status;
  const result = await withDatabase(
    () => prisma.challenge.findMany({ where: { ...(category && category !== 'All' ? { category } : {}), ...(dbStatus && dbStatus !== 'All' ? { status: dbStatus } : {}), ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}), ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: sort === 'popular' ? { votes: 'desc' } : { createdAt: 'desc' } }),
    () => demoChallenges.filter((c) => (!category || category === 'All' || c.category === category) && (!status || status === 'All' || c.status === status) && (!location || c.location.toLowerCase().includes(location.toLowerCase())) && (!search || `${c.title} ${c.description} ${c.location}`.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => sort === 'popular' ? b.votes - a.votes : new Date(b.createdAt) - new Date(a.createdAt))
  );
  let items = result.map(serialize);
  if (sort === 'oldest') items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (sort === 'relevant' && search) items.sort((a, b) => `${b.title} ${b.description}`.toLowerCase().split(search.toLowerCase()).length - `${a.title} ${a.description}`.toLowerCase().split(search.toLowerCase()).length);
  res.json({ ...paginate(items, page, limit), demo: !databaseAvailable });
});
app.get('/api/challenges/suggest-category', (req, res) => res.json({ data: suggestCategory(`${req.query.title || ''} ${req.query.description || ''}`) }));
app.get('/api/challenges/duplicates', async (req, res) => {
  const text = `${req.query.title || ''} ${req.query.description || ''}`.toLowerCase();
  const matches = await withDatabase(() => prisma.challenge.findMany({ take: 10, orderBy: { createdAt: 'desc' } }), () => demoChallenges);
  const scored = matches.map(c => ({ ...serialize(c), similarity: similarity(text, `${c.title} ${c.description}`) })).filter(c => c.similarity >= 0.2).sort((a, b) => b.similarity - a.similarity);
  res.json({ data: scored.slice(0, 5), demo: !databaseAvailable });
});
app.get('/api/challenges/:id', async (req, res) => {
  const result = await withDatabase(() => prisma.challenge.findUnique({ where: { id: req.params.id }, include: { solutions: { include: { author: { select: { name: true, role: true } } } }, comments: { include: { user: { select: { name: true, role: true } } } }, collaborations: { include: { user: { select: { name: true, role: true } } } }, timeline: { include: { author: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } } } }), () => ({ ...demoChallenges.find((c) => c.id === req.params.id), timeline: demoProgress.get(req.params.id) || [] }));
  if (!result) return res.status(404).json({ error: 'Challenge not found' });
  res.json({ data: serialize(result), demo: !databaseAvailable });
});
app.post('/api/challenges/preview', auth, async (req, res) => {
  const suggestion = suggestCategory(`${req.body.title || ''} ${req.body.description || ''}`);
  const text = `${req.body.title || ''} ${req.body.description || ''}`.toLowerCase();
  const all = await withDatabase(() => prisma.challenge.findMany({ take: 100, orderBy: { createdAt: 'desc' } }), () => demoChallenges);
  const similar = all.map(c => ({ ...serialize(c), similarity: similarity(text, `${c.title} ${c.description}`) })).filter(c => c.similarity >= 0.2).sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  res.json({ data: { suggestion, similar }, demo: !databaseAvailable });
});
app.post('/api/challenges', auth, async (req, res) => {
  const { title, description, category, location, expectedImpact, supportingInformation, proposedSolutions } = req.body;
  const validCategories = ['Education', 'Healthcare', 'Environment', 'Public Infrastructure', "Women's Safety", 'Employment', 'Accessibility', 'Other'];
  if (![title, description, category, location, expectedImpact].every(validateText) || !validCategories.includes(category)) return res.status(400).json({ error: 'Valid title, description, category, location, and expected impact are required.' });
  const challenge = await withDatabase(() => prisma.challenge.create({ data: { title, description, category, location, expectedImpact, supportingInformation, proposedSolutions, authorId: req.user.sub } }), () => ({ id: `demo-${Date.now()}`, title, description, category, location, expectedImpact, supportingInformation, proposedSolutions, status: 'open', votes: 0, authorId: req.user.sub, createdAt: new Date().toISOString() }));
  res.status(201).json({ data: { ...serialize(challenge), suggestion: suggestCategory(`${title} ${description}`) }, demo: !databaseAvailable });
});
app.patch('/api/challenges/:id/status', auth, async (req, res) => {
  const status = req.body.status === 'in-progress' ? 'in_progress' : req.body.status;
  if (!['open', 'in_progress', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const current = await withDatabase(() => prisma.challenge.findUnique({ where: { id: req.params.id }, select: { authorId: true } }), () => demoChallenges.find(c => c.id === req.params.id));
  if (current && current.authorId && current.authorId !== req.user.sub && req.user.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Only the challenge author or an administrator can update status.' });
  const updated = await withDatabase(() => prisma.challenge.update({ where: { id: req.params.id }, data: { status }, }), () => ({ ...(demoChallenges.find(c => c.id === req.params.id) || {}), id: req.params.id, status }));
  res.json({ data: serialize(updated), demo: !databaseAvailable });
});
app.post('/api/challenges/:id/progress', auth, async (req, res) => {
  if (!validateText(req.body.body, 3000)) return res.status(400).json({ error: 'Progress update text is required.' });
  const status = req.body.status ? (req.body.status === 'in-progress' ? 'in_progress' : req.body.status) : undefined;
  const owner = await withDatabase(() => prisma.challenge.findUnique({ where: { id: req.params.id }, select: { authorId: true, title: true } }), () => demoChallenges.find(c => c.id === req.params.id));
  if (!owner) return res.status(404).json({ error: 'Challenge not found.' });
  if (owner.authorId && owner.authorId !== req.user.sub && req.user.role !== 'ADMINISTRATOR') return res.status(403).json({ error: 'Only the challenge author or an administrator can post progress updates.' });
  const update = await withDatabase(() => prisma.progressUpdate.create({ data: { challengeId: req.params.id, authorId: req.user.sub, body: req.body.body, status, type: status ? 'STATUS' : 'UPDATE' }, include: { author: { select: { name: true, role: true } } } }), () => ({ id: `demo-progress-${Date.now()}`, challengeId: req.params.id, authorId: req.user.sub, body: req.body.body, status, createdAt: new Date().toISOString(), author: { name: req.user.name, role: req.user.role } }));
  if (!demoProgress.has(req.params.id)) demoProgress.set(req.params.id, []); demoProgress.get(req.params.id).push(update);
  if (owner.authorId && owner.authorId !== req.user.sub) await addNotification(owner.authorId, 'PROGRESS_UPDATE', `A progress update was posted on "${owner.title}".`, req.params.id);
  res.status(201).json({ data: serialize(update), demo: !databaseAvailable });
});
app.get('/api/challenges/:id/timeline', async (req, res) => {
  const timeline = await withDatabase(() => prisma.progressUpdate.findMany({ where: { challengeId: req.params.id }, include: { author: { select: { name: true, role: true } } }, orderBy: { createdAt: 'asc' } }), () => demoProgress.get(req.params.id) || []);
  res.json({ data: timeline.map(serialize), demo: !databaseAvailable });
});
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, confirmPassword, role = 'CITIZEN' } = req.body;
  if (!validateText(name, 100) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') || !password || password.length < 8 || password !== confirmPassword || !roles.includes(role)) return res.status(400).json({ error: 'Name, valid email, matching passwords of at least 8 characters, and a valid role are required.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const normalizedEmail = email.toLowerCase();
  if (demoUsers.has(normalizedEmail)) return res.status(409).json({ error: 'An account with this email already exists.' });
  let user;
  if (databaseAvailable) {
    try { user = await prisma.user.create({ data: { name, email: normalizedEmail, passwordHash, role } }); }
    catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'An account with this email already exists.' });
      databaseAvailable = false;
    }
  }
  if (!user) { user = { id: `demo-user-${Date.now()}`, name, email: normalizedEmail, role, passwordHash }; demoUsers.set(user.email, user); }
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.status(201).json({ data: { ...safe, token: tokenFor(safe) }, demo: !databaseAvailable });
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = await withDatabase(async () => { const found = await prisma.user.findUnique({ where: { email: email.toLowerCase() } }); return found && await bcrypt.compare(password, found.passwordHash) ? found : null; }, async () => { const found = demoUsers.get(email.toLowerCase()); return found && await bcrypt.compare(password, found.passwordHash) ? found : null; });
  if (!user) return res.status(401).json({ error: 'Account not found or password is incorrect.' });
  const safe = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ data: { ...safe, token: tokenFor(safe) }, demo: !databaseAvailable });
});
app.post('/api/auth/logout', auth, (_req, res) => res.json({ data: { loggedOut: true } }));
app.get('/api/profile', auth, async (req, res) => {
  const user = await withDatabase(() => prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, name: true, email: true, role: true, createdAt: true } }), () => ({ id: req.user.sub, name: req.user.name, email: req.user.email, role: req.user.role }));
  res.json({ data: user, demo: !databaseAvailable });
});
app.patch('/api/profile', auth, async (req, res) => {
  const { name } = req.body;
  if (!validateText(name, 100)) return res.status(400).json({ error: 'A valid name is required.' });
  const user = await withDatabase(() => prisma.user.update({ where: { id: req.user.sub }, data: { name: name.trim() }, select: { id: true, name: true, email: true, role: true } }), () => ({ id: req.user.sub, name: name.trim(), email: req.user.email, role: req.user.role }));
  res.json({ data: user, demo: !databaseAvailable });
});
app.get('/api/dashboard', auth, async (req, res) => {
  const data = await withDatabase(async () => ({ profile: await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, name: true, email: true, role: true } }), myChallenges: await prisma.challenge.findMany({ where: { authorId: req.user.sub }, orderBy: { createdAt: 'desc' }, take: 10 }), mySolutions: await prisma.solution.findMany({ where: { authorId: req.user.sub }, include: { challenge: { select: { id: true, title: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }), collaborations: await prisma.collaboration.findMany({ where: { userId: req.user.sub }, include: { challenge: { select: { id: true, title: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 10 }), comments: await prisma.comment.findMany({ where: { userId: req.user.sub }, orderBy: { createdAt: 'desc' }, take: 10 }) }), () => ({ profile: { id: req.user.sub, name: req.user.name, email: req.user.email, role: req.user.role }, myChallenges: [], mySolutions: [], collaborations: [], comments: [] }));
  res.json({ data, demo: !databaseAvailable });
});
app.get('/api/dashboard/stats', async (_req, res) => {
  const stats = await withDatabase(async () => ({ challenges: await prisma.challenge.count(), open: await prisma.challenge.count({ where: { status: 'open' } }), inProgress: await prisma.challenge.count({ where: { status: 'in_progress' } }), resolved: await prisma.challenge.count({ where: { status: 'resolved' } }), participatingOrganizations: await prisma.organization.count(), votes: (await prisma.challenge.aggregate({ _sum: { votes: true } }))._sum.votes || 0 }), () => ({ challenges: demoChallenges.length, open: demoChallenges.filter((c) => c.status === 'open').length, inProgress: demoChallenges.filter((c) => c.status === 'in-progress').length, resolved: demoChallenges.filter((c) => c.status === 'resolved').length, participatingOrganizations: 0, votes: demoChallenges.reduce((sum, c) => sum + c.votes, 0) }));
  res.json({ data: stats, demo: !databaseAvailable });
});
app.get('/api/recommendations', auth, async (req, res) => {
  const activity = await withDatabase(async () => { const [submitted, solutions, collaborations] = await Promise.all([prisma.challenge.findMany({ where: { authorId: req.user.sub }, select: { category: true, location: true } }), prisma.solution.findMany({ where: { authorId: req.user.sub }, include: { challenge: { select: { category: true, location: true } } } }), prisma.collaboration.findMany({ where: { userId: req.user.sub }, include: { challenge: { select: { category: true, location: true } } } })]); return { submitted, solutions, collaborations }; }, () => ({ submitted: [], solutions: [], collaborations: [] }));
  const interests = [...activity.submitted, ...activity.solutions.map(item => item.challenge), ...activity.collaborations.map(item => item.challenge)].filter(Boolean);
  const categoriesOfInterest = new Set(interests.map(item => item.category));
  const locationsOfInterest = new Set(interests.map(item => item.location));
  const challenges = await withDatabase(() => prisma.challenge.findMany({ where: { authorId: { not: req.user.sub }, status: { not: 'resolved' } }, orderBy: { createdAt: 'desc' }, take: 100 }), () => demoChallenges.filter(c => c.status !== 'resolved'));
  const ranked = challenges.map(c => { const categoryMatch = categoriesOfInterest.has(c.category); const locationMatch = locationsOfInterest.has(c.location); return { ...serialize(c), score: (categoryMatch ? 3 : 0) + (locationMatch ? 2 : 0) + c.votes / 1000, reason: categoryMatch ? `Matches your activity in ${c.category}.` : locationMatch ? `Located near ${c.location}, where you have participated.` : 'Recently submitted and open for community support.' }; }).sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
  res.json({ data: ranked, demo: !databaseAvailable });
});
app.get('/api/admin/analytics', auth, adminOnly, async (_req, res) => {
  const data = await withDatabase(async () => {
    const [total, byStatus, byCategory, recent, solutions, collaborations] = await Promise.all([prisma.challenge.count(), prisma.challenge.groupBy({ by: ['status'], _count: true }), prisma.challenge.groupBy({ by: ['category'], _count: true }), prisma.challenge.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }), prisma.solution.count(), prisma.collaboration.count()]);
    return { total, byStatus, byCategory, recent, solutions, collaborations };
  }, () => ({ total: demoChallenges.length, byStatus: ['open', 'in-progress', 'resolved'].map(status => ({ status, _count: demoChallenges.filter(c => c.status === status).length })), byCategory: [...new Set(demoChallenges.map(c => c.category))].map(category => ({ category, _count: demoChallenges.filter(c => c.category === category).length })), recent: demoChallenges.length }));
  res.json({ data, demo: !databaseAvailable });
});
app.get('/api/notifications', auth, async (req, res) => {
  const unreadOnly = req.query.unread === 'true';
  const list = await withDatabase(() => prisma.notification.findMany({ where: { recipientId: req.user.sub, ...(unreadOnly ? { readAt: null } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 }), () => (demoNotifications.get(req.user.sub) || []).filter(n => !unreadOnly || !n.readAt));
  res.json({ data: list, unread: list.filter(n => !n.readAt).length, demo: !databaseAvailable });
});
app.patch('/api/notifications/:id/read', auth, async (req, res) => {
  const result = await withDatabase(() => prisma.notification.updateMany({ where: { id: req.params.id, recipientId: req.user.sub }, data: { readAt: new Date() } }), () => {
    const list = demoNotifications.get(req.user.sub) || []; const item = list.find(n => n.id === req.params.id); if (item) item.readAt = new Date().toISOString(); return item;
  });
  if (!result || (result.count !== undefined && result.count === 0)) return res.status(404).json({ error: 'Notification not found.' });
  res.json({ data: { read: true }, demo: !databaseAvailable });
});
app.post('/api/solutions', auth, async (req, res) => {
  const { challengeId, title, description, proposedApproach, expectedImpact, requiredResources } = req.body;
  if (!challengeId || !validateText(title, 200) || !validateText(description) || !validateText(proposedApproach)) return res.status(400).json({ error: 'Challenge, title, description, and proposed approach are required.' });
  const solution = await withDatabase(() => prisma.solution.create({ data: { challengeId, title, description, proposedApproach, expectedImpact, requiredResources, authorId: req.user.sub } }), () => { const s = { id: `demo-solution-${Date.now()}`, challengeId, title, description, proposedApproach, expectedImpact, requiredResources, authorId: req.user.sub, status: 'proposed', createdAt: new Date().toISOString() }; demoSolutions.push(s); return s; });
  const challenge = await withDatabase(() => prisma.challenge.findUnique({ where: { id: challengeId }, select: { authorId: true, title: true } }), () => demoChallenges.find(c => c.id === challengeId));
  if (challenge?.authorId && challenge.authorId !== req.user.sub) await addNotification(challenge.authorId, 'SOLUTION_SUBMITTED', `A new solution was proposed for "${challenge.title}".`, challengeId);
  res.status(201).json({ data: serialize(solution), demo: !databaseAvailable });
});
app.get('/api/solutions/:id', async (req, res) => { const solution = await withDatabase(() => prisma.solution.findUnique({ where: { id: req.params.id }, include: { author: { select: { name: true, role: true } }, comments: true } }), () => demoSolutions.find((s) => s.id === req.params.id)); if (!solution) return res.status(404).json({ error: 'Solution not found.' }); res.json({ data: serialize(solution), demo: !databaseAvailable }); });
app.post('/api/challenges/:id/collaborate', auth, async (req, res) => {
  const key = `${req.user.sub}:${req.params.id}`;
  if (demoCollaborations.has(key)) return res.status(409).json({ error: 'You are already collaborating on this challenge.' });
  let result;
  if (databaseAvailable) {
    try {
      const existing = await prisma.collaboration.findFirst({ where: { userId: req.user.sub, challengeId: req.params.id, solutionId: null } });
      if (existing) return res.status(409).json({ error: 'You are already collaborating on this challenge.' });
      result = await prisma.collaboration.create({ data: { userId: req.user.sub, challengeId: req.params.id } });
    }
    catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'You are already collaborating on this challenge.' });
      if (error.code === 'P2003' || error.code === 'P2025') return res.status(404).json({ error: 'Challenge not found.' });
      databaseAvailable = false;
    }
  }
  if (!result) { demoCollaborations.add(key); result = { id: `demo-collab-${Date.now()}`, userId: req.user.sub, challengeId: req.params.id }; }
  res.status(201).json({ data: result, demo: !databaseAvailable });
});
app.delete('/api/challenges/:id/collaborate', auth, async (req, res) => { await withDatabase(() => prisma.collaboration.delete({ where: { userId_challengeId_solutionId: { userId: req.user.sub, challengeId: req.params.id, solutionId: null } } }), () => demoCollaborations.delete(`${req.user.sub}:${req.params.id}`)); res.json({ data: { withdrawn: true }, demo: !databaseAvailable }); });
app.post('/api/comments', auth, async (req, res) => { const { body, challengeId, solutionId } = req.body; if (!validateText(body, 2000) || (!challengeId && !solutionId) || (challengeId && solutionId)) return res.status(400).json({ error: 'Comment text and exactly one challenge or solution are required.' }); const comment = await withDatabase(() => prisma.comment.create({ data: { body, challengeId, solutionId, userId: req.user.sub }, include: { user: { select: { name: true, role: true } } } }), () => ({ id: `demo-comment-${Date.now()}`, body, challengeId, solutionId, userId: req.user.sub, user: { name: req.user.name, role: req.user.role }, createdAt: new Date().toISOString() })); if (challengeId) { const challenge = await withDatabase(() => prisma.challenge.findUnique({ where: { id: challengeId }, select: { authorId: true, title: true } }), () => demoChallenges.find(c => c.id === challengeId)); if (challenge?.authorId && challenge.authorId !== req.user.sub) await addNotification(challenge.authorId, 'COMMENT', `A new discussion message was posted on "${challenge.title}".`, challengeId); } res.status(201).json({ data: comment, demo: !databaseAvailable }); });
app.get('/api/organizations', async (_req, res) => { const organizations = await withDatabase(() => prisma.organization.findMany({ include: { _count: { select: { memberships: true, challenges: true, projects: true } } }, orderBy: { name: 'asc' } }), () => []); res.json({ data: organizations, demo: !databaseAvailable }); });
app.get('/api/admin/users', auth, adminOnly, async (_req, res) => { const users = await withDatabase(() => prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } }), () => [...demoUsers.values()].map(({ passwordHash, ...u }) => u)); res.json({ data: users, demo: !databaseAvailable }); });
app.post('/api/projects/:projectId/milestones', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Project membership required.' }); if (!validateText(req.body.name, 180)) return res.status(400).json({ error: 'Milestone name is required.' }); try { const m = await withDatabase(() => prisma.milestone.create({ data: { projectId: req.params.projectId, name: req.body.name, description: req.body.description, dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined } }), () => { const x = { id: `demo-milestone-${Date.now()}`, projectId: req.params.projectId, name: req.body.name, description: req.body.description, status: 'planned', dueDate: req.body.dueDate }; demoMilestones.push(x); return x; }); await activity(req.params.projectId, req, 'MILESTONE_CREATED', `Milestone "${m.name}" was created.`); res.status(201).json({ data: m, demo: !databaseAvailable }); } catch { res.status(400).json({ error: 'Invalid milestone date.' }); } });
app.patch('/api/milestones/:id', auth, async (req, res) => { const m = await withDatabase(() => prisma.milestone.findUnique({ where: { id: req.params.id } }), () => demoMilestones.find(x => x.id === req.params.id)); if (!m) return res.status(404).json({ error: 'Milestone not found.' }); if (!await isProjectMember(req, m.projectId)) return res.status(403).json({ error: 'Project membership required.' }); if (req.body.status && !['planned', 'in_progress', 'completed', 'blocked'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid milestone status.' }); const updated = await withDatabase(() => prisma.milestone.update({ where: { id: m.id }, data: { ...(req.body.name ? { name: req.body.name } : {}), ...(req.body.status ? { status: req.body.status } : {}) } }), () => Object.assign(m, req.body)); res.json({ data: updated, demo: !databaseAvailable }); });
app.post('/api/projects/:projectId/tasks', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Project membership required.' }); if (!validateText(req.body.title, 180)) return res.status(400).json({ error: 'Task title is required.' }); try { const t = await withDatabase(() => prisma.task.create({ data: { projectId: req.params.projectId, milestoneId: req.body.milestoneId, assigneeId: req.body.assigneeId, creatorId: req.user.sub, title: req.body.title, description: req.body.description, dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined } }), () => { const x = { id: `demo-task-${Date.now()}`, projectId: req.params.projectId, milestoneId: req.body.milestoneId, assigneeId: req.body.assigneeId, creatorId: req.user.sub, title: req.body.title, description: req.body.description, status: 'todo' }; demoTasks.push(x); return x; }); await activity(req.params.projectId, req, 'TASK_CREATED', `Task "${t.title}" was created.`); res.status(201).json({ data: t, demo: !databaseAvailable }); } catch (e) { res.status(statusConflict(e)).json({ error: 'Invalid task assignment or milestone.' }); } });
app.patch('/api/tasks/:id', auth, async (req, res) => { const t = await withDatabase(() => prisma.task.findUnique({ where: { id: req.params.id } }), () => demoTasks.find(x => x.id === req.params.id)); if (!t) return res.status(404).json({ error: 'Task not found.' }); if (!await isProjectMember(req, t.projectId)) return res.status(403).json({ error: 'Project membership required.' }); if (req.body.status && !['todo', 'in_progress', 'blocked', 'done'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid task status.' }); const updated = await withDatabase(() => prisma.task.update({ where: { id: t.id }, data: { ...(req.body.status ? { status: req.body.status } : {}), ...(req.body.assigneeId !== undefined ? { assigneeId: req.body.assigneeId } : {}) } }), () => Object.assign(t, req.body)); res.json({ data: updated, demo: !databaseAvailable }); });
app.post('/api/projects/:projectId/evaluations', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Evaluator must be a project team member.' }); const criteria = ['impact', 'feasibility', 'sustainability', 'equity', 'innovation']; if (!validId(req.body.solutionId) || criteria.some(k => !Number.isInteger(req.body[k]) || req.body[k] < 1 || req.body[k] > 5)) return res.status(400).json({ error: 'Solution and five criteria scored 1-5 are required.' }); try { const e = await withDatabase(() => prisma.solutionEvaluation.create({ data: { projectId: req.params.projectId, solutionId: req.body.solutionId, evaluatorId: req.user.sub, ...Object.fromEntries(criteria.map(k => [k, req.body[k]])), comments: req.body.comments } }), () => { const x = { id: `demo-evaluation-${Date.now()}`, projectId: req.params.projectId, solutionId: req.body.solutionId, evaluatorId: req.user.sub, ...Object.fromEntries(criteria.map(k => [k, req.body[k]])), comments: req.body.comments }; demoEvaluations.push(x); return x; }); res.status(201).json({ data: e, demo: !databaseAvailable }); } catch (e) { res.status(statusConflict(e)).json({ error: e.code === 'P2002' ? 'You already evaluated this solution.' : 'Solution not found.' }); } });
app.get('/api/projects/:projectId/evaluations', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Project membership required.' }); const items = await withDatabase(() => prisma.solutionEvaluation.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: 'desc' } }), () => demoEvaluations.filter(x => x.projectId === req.params.projectId)); res.json({ data: items, demo: !databaseAvailable }); });
app.post('/api/projects/:projectId/deliverables', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Project membership required.' }); const parsed = safeUrl(req.body.externalUrl); if (!validateText(req.body.title, 180) || !parsed) return res.status(400).json({ error: 'Title and a valid http(s) external URL are required.' }); const d = await withDatabase(() => prisma.deliverable.create({ data: { projectId: req.params.projectId, submittedById: req.user.sub, title: req.body.title, description: req.body.description, externalUrl: parsed.toString(), urlHost: parsed.hostname } }), () => { const x = { id: `demo-deliverable-${Date.now()}`, projectId: req.params.projectId, submittedById: req.user.sub, title: req.body.title, description: req.body.description, externalUrl: parsed.toString(), urlHost: parsed.hostname, status: 'draft' }; demoDeliverables.push(x); return x; }); res.status(201).json({ data: d, demo: !databaseAvailable }); });
app.patch('/api/deliverables/:id', auth, async (req, res) => { const d = await withDatabase(() => prisma.deliverable.findUnique({ where: { id: req.params.id } }), () => demoDeliverables.find(x => x.id === req.params.id)); if (!d) return res.status(404).json({ error: 'Deliverable not found.' }); if (!await isProjectMember(req, d.projectId)) return res.status(403).json({ error: 'Project membership required.' }); if (req.body.status && !['draft', 'submitted', 'approved', 'changes_requested', 'rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid deliverable status.' }); const updated = await withDatabase(() => prisma.deliverable.update({ where: { id: d.id }, data: { ...(req.body.status ? { status: req.body.status } : {}), ...(req.body.reviewerFeedback ? { reviewerFeedback: req.body.reviewerFeedback, reviewerId: req.user.sub } : {}) } }), () => Object.assign(d, req.body)); res.json({ data: updated, demo: !databaseAvailable }); });
app.get('/api/projects/:projectId/activity', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Project membership required.' }); const items = await withDatabase(() => prisma.activityRecord.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: 'desc' } }), () => demoActivities.filter(x => x.projectId === req.params.projectId)); res.json({ ...paginate(items, req.query.page, req.query.limit), demo: !databaseAvailable }); });
app.get('/api/projects/:projectId/dashboard', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Project membership required.' }); const data = await withDatabase(async () => { const [project, tasks, milestones, deliverables, evaluations] = await Promise.all([prisma.project.findUnique({ where: { id: req.params.projectId } }), prisma.task.groupBy({ by: ['status'], where: { projectId: req.params.projectId }, _count: true }), prisma.milestone.groupBy({ by: ['status'], where: { projectId: req.params.projectId }, _count: true }), prisma.deliverable.groupBy({ by: ['status'], where: { projectId: req.params.projectId }, _count: true }), prisma.solutionEvaluation.count({ where: { projectId: req.params.projectId } })]); return { project, tasks, milestones, deliverables, evaluations }; }, () => ({ project: demoProjects.get(req.params.projectId), tasks: ['todo', 'in_progress', 'blocked', 'done'].map(status => ({ status, _count: demoTasks.filter(t => t.projectId === req.params.projectId && t.status === status).length })), milestones: [], deliverables: [], evaluations: demoEvaluations.filter(e => e.projectId === req.params.projectId).length })); if (!data.project) return res.status(404).json({ error: 'Project not found.' }); res.json({ data, demo: !databaseAvailable }); });

// Phase 4 organization and project collaboration APIs.
const demoOrganizations = new Map(), demoProjects = new Map(), demoMemberships = [], demoMembershipRequests = [], demoTeamRequests = [], demoMilestones = [], demoTasks = [], demoEvaluations = [], demoDeliverables = [], demoActivities = [];
const manager = (req) => ['ADMINISTRATOR', 'GOVERNMENT_REPRESENTATIVE'].includes(req.user.role);
const projectId = (req) => req.params.projectId || req.params.id;
async function projectFor(id) { return withDatabase(() => prisma.project.findUnique({ where: { id }, include: { team: true } }), () => demoProjects.get(id)); }
async function isProjectMember(req, id) { const p = await projectFor(id); return p && (p.ownerId === req.user.sub || p.team?.some(m => m.userId === req.user.sub) || manager(req)); }
async function canManageOrganization(req, id) {
  if (manager(req)) return true;
  const membership = await withDatabase(
    () => prisma.organizationMembership.findUnique({ where: { organizationId_userId: { organizationId: id, userId: req.user.sub } } }),
    () => demoMemberships.find(item => item.organizationId === id && item.userId === req.user.sub)
  );
  return ['owner', 'manager', 'admin'].includes(membership?.role);
}
function validId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 100; }
function safeUrl(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u : null; } catch { return null; } }
async function activity(projectIdValue, req, type, message, metadata = {}) {
  return withDatabase(() => prisma.activityRecord.create({ data: { projectId: projectIdValue, actorId: req.user.sub, type, message, metadata } }), () => { const item = { id: `demo-activity-${Date.now()}`, projectId: projectIdValue, actorId: req.user.sub, type, message, metadata, createdAt: new Date().toISOString() }; demoActivities.unshift(item); return item; });
}
function statusConflict(error) { return error?.code === 'P2002' ? 409 : error?.code === 'P2025' ? 404 : 500; }

app.get('/api/organizations/:id', async (req, res) => {
  const org = await withDatabase(() => prisma.organization.findUnique({ where: { id: req.params.id }, include: { memberships: { include: { user: { select: { id: true, name: true, role: true } } } }, projects: true } }), () => demoOrganizations.get(req.params.id));
  if (!org) return res.status(404).json({ error: 'Organization not found.' }); res.json({ data: org, demo: !databaseAvailable });
});
app.post('/api/organizations', auth, async (req, res) => {
  if (!manager(req)) return res.status(403).json({ error: 'Organization manager access required.' });
  if (!validateText(req.body.name, 160)) return res.status(400).json({ error: 'Organization name is required.' });
  try {
    const org = await withDatabase(() => prisma.organization.create({ data: { name: req.body.name.trim(), description: req.body.description } }), () => { const o = { id: `demo-org-${Date.now()}`, name: req.body.name.trim(), description: req.body.description, memberships: [], projects: [] }; demoOrganizations.set(o.id, o); return o; });
    res.status(201).json({ data: org, demo: !databaseAvailable });
  } catch (e) { res.status(statusConflict(e)).json({ error: e.code === 'P2002' ? 'Organization name already exists.' : 'Unable to create organization.' }); }
});
app.post('/api/organizations/:id/membership-requests', auth, async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid organization id.' });
  try {
    const request = await withDatabase(() => prisma.organizationMembershipRequest.create({ data: { organizationId: req.params.id, requesterId: req.user.sub, message: req.body.message } }), () => { if (demoMembershipRequests.some(r => r.organizationId === req.params.id && r.requesterId === req.user.sub && r.status === 'pending')) { const error = new Error('Duplicate membership request'); error.code = 'P2002'; throw error; } const r = { id: `demo-org-request-${Date.now()}`, organizationId: req.params.id, requesterId: req.user.sub, message: req.body.message, status: 'pending', createdAt: new Date().toISOString() }; demoMembershipRequests.push(r); return r; });
    res.status(201).json({ data: request, demo: !databaseAvailable });
  } catch (e) { res.status(statusConflict(e)).json({ error: e.code === 'P2002' ? 'A request with this status already exists.' : 'Organization not found.' }); }
});
app.get('/api/organizations/:id/membership-requests', auth, async (req, res) => {
  if (!await canManageOrganization(req, req.params.id)) return res.status(403).json({ error: 'Organization manager access required.' });
  const items = await withDatabase(() => prisma.organizationMembershipRequest.findMany({ where: { organizationId: req.params.id }, orderBy: { createdAt: 'desc' }, include: { requester: { select: { id: true, name: true, email: true } } } }), () => demoMembershipRequests.filter(r => r.organizationId === req.params.id));
  res.json({ ...paginate(items, req.query.page, req.query.limit), demo: !databaseAvailable });
});
app.patch('/api/organization-membership-requests/:id', auth, async (req, res) => {
  if (!['approved', 'rejected', 'withdrawn'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid membership request status.' });
  try {
    const current = await withDatabase(() => prisma.organizationMembershipRequest.findUnique({ where: { id: req.params.id } }), () => demoMembershipRequests.find(r => r.id === req.params.id));
    if (!current) return res.status(404).json({ error: 'Membership request not found.' });
    if (current.status !== 'pending') return res.status(409).json({ error: 'Request has already been resolved.' });
    if (req.body.status === 'withdrawn' && current.requesterId !== req.user.sub) return res.status(403).json({ error: 'You can only withdraw your own request.' });
    if (req.body.status !== 'withdrawn' && !await canManageOrganization(req, current.organizationId)) return res.status(403).json({ error: 'Organization manager access required.' });
    const updated = await withDatabase(() => prisma.$transaction(async tx => { const r = await tx.organizationMembershipRequest.update({ where: { id: req.params.id }, data: { status: req.body.status, reviewedById: req.user.sub } }); if (req.body.status === 'approved') await tx.organizationMembership.create({ data: { organizationId: r.organizationId, userId: r.requesterId } }); return r; }), () => { current.status = req.body.status; return current; });
    res.json({ data: updated, demo: !databaseAvailable });
  } catch (e) { res.status(statusConflict(e)).json({ error: 'Unable to update membership request.' }); }
});

app.get('/api/projects', async (req, res) => {
  const items = await withDatabase(() => prisma.project.findMany({ where: req.query.organizationId ? { organizationId: req.query.organizationId } : {}, orderBy: { createdAt: 'desc' }, include: { organization: true, _count: { select: { team: true, milestones: true, tasks: true } } } }), () => [...demoProjects.values()].filter(p => !req.query.organizationId || p.organizationId === req.query.organizationId));
  res.json({ ...paginate(items, req.query.page, req.query.limit), demo: !databaseAvailable });
});
app.post('/api/projects', auth, async (req, res) => {
  if (!validId(req.body.organizationId) || !validateText(req.body.name, 180) || !validateText(req.body.description)) return res.status(400).json({ error: 'Organization, project name, and description are required.' });
  if (!await canManageOrganization(req, req.body.organizationId)) return res.status(403).json({ error: 'Organization membership or manager access required.' });
  try {
    const p = await withDatabase(() => prisma.project.create({ data: { organizationId: req.body.organizationId, ownerId: req.user.sub, challengeId: validId(req.body.challengeId) ? req.body.challengeId : undefined, solutionId: validId(req.body.solutionId) ? req.body.solutionId : undefined, name: req.body.name.trim(), description: req.body.description }, include: { team: true } }), () => { const item = { id: `demo-project-${Date.now()}`, organizationId: req.body.organizationId, ownerId: req.user.sub, challengeId: req.body.challengeId, solutionId: req.body.solutionId, name: req.body.name.trim(), description: req.body.description, status: 'proposed', team: [], createdAt: new Date().toISOString() }; demoProjects.set(item.id, item); return item; });
    await activity(p.id, req, 'PROJECT_CREATED', `Project "${p.name}" was created.`);
    res.status(201).json({ data: p, demo: !databaseAvailable });
  } catch (e) { res.status(statusConflict(e)).json({ error: 'Organization not found.' }); }
});
app.get('/api/projects/:id', auth, async (req, res) => { const p = await projectFor(req.params.id); if (!p) return res.status(404).json({ error: 'Project not found.' }); if (!await isProjectMember(req, req.params.id)) return res.status(403).json({ error: 'Project membership required.' }); const data = await withDatabase(() => prisma.project.findUnique({ where: { id: req.params.id }, include: { organization: true, team: { include: { user: { select: { id: true, name: true, role: true } } } }, milestones: { include: { tasks: true } }, tasks: true, evaluations: true, deliverables: true } }), () => p); res.json({ data, demo: !databaseAvailable }); });
app.post('/api/projects/:projectId/team-requests', auth, async (req, res) => {
  if (!await projectFor(req.params.projectId)) return res.status(404).json({ error: 'Project not found.' });
  try { const r = await withDatabase(() => prisma.projectTeamRequest.create({ data: { projectId: req.params.projectId, requesterId: req.user.sub, message: req.body.message } }), () => { if (demoTeamRequests.some(x => x.projectId === req.params.projectId && x.requesterId === req.user.sub && x.status === 'pending')) { const error = new Error('Duplicate team request'); error.code = 'P2002'; throw error; } const x = { id: `demo-team-request-${Date.now()}`, projectId: req.params.projectId, requesterId: req.user.sub, message: req.body.message, status: 'pending', createdAt: new Date().toISOString() }; demoTeamRequests.push(x); return x; }); res.status(201).json({ data: r, demo: !databaseAvailable }); } catch (e) { res.status(statusConflict(e)).json({ error: e.code === 'P2002' ? 'A pending team request already exists.' : 'Project not found.' }); }
});
app.get('/api/projects/:projectId/team-requests', auth, async (req, res) => { if (!await isProjectMember(req, req.params.projectId)) return res.status(403).json({ error: 'Project membership required.' }); const items = await withDatabase(() => prisma.projectTeamRequest.findMany({ where: { projectId: req.params.projectId }, orderBy: { createdAt: 'desc' } }), () => demoTeamRequests.filter(r => r.projectId === req.params.projectId)); res.json({ data: items, demo: !databaseAvailable }); });
app.patch('/api/project-team-requests/:id', auth, async (req, res) => { if (!['approved', 'rejected', 'withdrawn'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid team request status.' }); const current = await withDatabase(() => prisma.projectTeamRequest.findUnique({ where: { id: req.params.id } }), () => demoTeamRequests.find(r => r.id === req.params.id)); if (!current) return res.status(404).json({ error: 'Team request not found.' }); if (current.status !== 'pending') return res.status(409).json({ error: 'Request has already been resolved.' }); if (req.body.status !== 'withdrawn' && !await isProjectMember(req, current.projectId)) return res.status(403).json({ error: 'Project manager access required.' }); const updated = await withDatabase(() => prisma.$transaction(async tx => { const r = await tx.projectTeamRequest.update({ where: { id: req.params.id }, data: { status: req.body.status, reviewedById: req.user.sub } }); if (req.body.status === 'approved') await tx.projectTeamMembership.create({ data: { projectId: r.projectId, userId: r.requesterId } }); return r; }), () => { current.status = req.body.status; return current; }); res.json({ data: updated, demo: !databaseAvailable }); });
app.delete('/api/projects/:projectId/team-requests/:id', auth, async (req, res) => { const r = await withDatabase(() => prisma.projectTeamRequest.updateMany({ where: { id: req.params.id, requesterId: req.user.sub, status: 'pending' }, data: { status: 'withdrawn' } }), () => { const x = demoTeamRequests.find(v => v.id === req.params.id && v.requesterId === req.user.sub && v.status === 'pending'); if (x) x.status = 'withdrawn'; return x; }); if (!r || (r.count !== undefined && !r.count)) return res.status(404).json({ error: 'Pending request not found.' }); res.json({ data: { withdrawn: true }, demo: !databaseAvailable }); });
export default app;
