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

app.get('/api/health', (_req, res) => res.json({ ok: true, database: databaseAvailable ? 'connected' : 'demo-fallback' }));
app.get('/api/challenges', async (req, res) => {
  const { search = '', category, status, location, sort = 'recent' } = req.query;
  const validStatuses = ['All', 'open', 'in-progress', 'resolved'];
  if (status && !validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid challenge status.' });
  const dbStatus = status === 'in-progress' ? 'in_progress' : status;
  const result = await withDatabase(
    () => prisma.challenge.findMany({ where: { ...(category && category !== 'All' ? { category } : {}), ...(dbStatus && dbStatus !== 'All' ? { status: dbStatus } : {}), ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}), ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] } : {}) }, orderBy: sort === 'popular' ? { votes: 'desc' } : { createdAt: 'desc' } }),
    () => demoChallenges.filter((c) => (!category || category === 'All' || c.category === category) && (!status || status === 'All' || c.status === status) && (!location || c.location.toLowerCase().includes(location.toLowerCase())) && (!search || `${c.title} ${c.description} ${c.location}`.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => sort === 'popular' ? b.votes - a.votes : new Date(b.createdAt) - new Date(a.createdAt))
  );
  res.json({ data: result.map(serialize), demo: !databaseAvailable });
});
app.get('/api/challenges/:id', async (req, res) => {
  const result = await withDatabase(() => prisma.challenge.findUnique({ where: { id: req.params.id }, include: { solutions: { include: { author: { select: { name: true, role: true } } } }, comments: { include: { user: { select: { name: true, role: true } } } }, collaborations: { include: { user: { select: { name: true, role: true } } } } } }), () => demoChallenges.find((c) => c.id === req.params.id));
  if (!result) return res.status(404).json({ error: 'Challenge not found' });
  res.json({ data: serialize(result), demo: !databaseAvailable });
});
app.post('/api/challenges', auth, async (req, res) => {
  const { title, description, category, location, expectedImpact, supportingInformation, proposedSolutions } = req.body;
  const validCategories = ['Education', 'Healthcare', 'Environment', 'Public Infrastructure', "Women's Safety", 'Employment', 'Accessibility', 'Other'];
  if (![title, description, category, location, expectedImpact].every(validateText) || !validCategories.includes(category)) return res.status(400).json({ error: 'Valid title, description, category, location, and expected impact are required.' });
  const challenge = await withDatabase(() => prisma.challenge.create({ data: { title, description, category, location, expectedImpact, supportingInformation, proposedSolutions, authorId: req.user.sub } }), () => ({ id: `demo-${Date.now()}`, title, description, category, location, expectedImpact, supportingInformation, proposedSolutions, status: 'open', votes: 0, authorId: req.user.sub, createdAt: new Date().toISOString() }));
  res.status(201).json({ data: serialize(challenge), demo: !databaseAvailable });
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
app.post('/api/solutions', auth, async (req, res) => {
  const { challengeId, title, description, proposedApproach, expectedImpact, requiredResources } = req.body;
  if (!challengeId || !validateText(title, 200) || !validateText(description) || !validateText(proposedApproach)) return res.status(400).json({ error: 'Challenge, title, description, and proposed approach are required.' });
  const solution = await withDatabase(() => prisma.solution.create({ data: { challengeId, title, description, proposedApproach, expectedImpact, requiredResources, authorId: req.user.sub } }), () => { const s = { id: `demo-solution-${Date.now()}`, challengeId, title, description, proposedApproach, expectedImpact, requiredResources, authorId: req.user.sub, status: 'proposed', createdAt: new Date().toISOString() }; demoSolutions.push(s); return s; });
  res.status(201).json({ data: serialize(solution), demo: !databaseAvailable });
});
app.get('/api/solutions/:id', async (req, res) => { const solution = await withDatabase(() => prisma.solution.findUnique({ where: { id: req.params.id }, include: { author: { select: { name: true, role: true } }, comments: true } }), () => demoSolutions.find((s) => s.id === req.params.id)); if (!solution) return res.status(404).json({ error: 'Solution not found.' }); res.json({ data: serialize(solution), demo: !databaseAvailable }); });
app.post('/api/challenges/:id/collaborate', auth, async (req, res) => {
  const key = `${req.user.sub}:${req.params.id}`;
  if (demoCollaborations.has(key)) return res.status(409).json({ error: 'You are already collaborating on this challenge.' });
  let result;
  if (databaseAvailable) {
    try { result = await prisma.collaboration.create({ data: { userId: req.user.sub, challengeId: req.params.id } }); }
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
app.post('/api/comments', auth, async (req, res) => { const { body, challengeId, solutionId } = req.body; if (!validateText(body, 2000) || (!challengeId && !solutionId)) return res.status(400).json({ error: 'Comment text and a challenge or solution are required.' }); const comment = await withDatabase(() => prisma.comment.create({ data: { body, challengeId, solutionId, userId: req.user.sub }, include: { user: { select: { name: true, role: true } } } }), () => ({ id: `demo-comment-${Date.now()}`, body, challengeId, solutionId, userId: req.user.sub, user: { name: req.user.name, role: req.user.role }, createdAt: new Date().toISOString() })); res.status(201).json({ data: comment, demo: !databaseAvailable }); });
app.get('/api/organizations', async (_req, res) => { const organizations = await withDatabase(() => prisma.organization.findMany({ include: { _count: { select: { users: true, challenges: true } } }, orderBy: { name: 'asc' } }), () => []); res.json({ data: organizations, demo: !databaseAvailable }); });
app.get('/api/admin/users', auth, adminOnly, async (_req, res) => { const users = await withDatabase(() => prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } }), () => [...demoUsers.values()].map(({ passwordHash, ...u }) => u)); res.json({ data: users, demo: !databaseAvailable }); });
export default app;
