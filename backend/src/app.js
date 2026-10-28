import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { demoChallenges } from './data.js';
import bcrypt from 'bcryptjs';

const app = express();
const prisma = new PrismaClient();
let databaseAvailable = true;
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

async function withDatabase(action, fallback) {
  if (!databaseAvailable) return fallback();
  try { return await action(); } catch (error) {
    databaseAvailable = false;
    console.warn('Database unavailable; using labelled demo fallback:', error.message);
    return fallback();
  }
}
const serialize = (item) => ({ ...item, status: item.status === 'in_progress' ? 'in-progress' : item.status, demo: String(item.id).startsWith('demo-') });

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
  const result = await withDatabase(() => prisma.challenge.findUnique({ where: { id: req.params.id } }), () => demoChallenges.find((c) => c.id === req.params.id));
  if (!result) return res.status(404).json({ error: 'Challenge not found' });
  res.json({ data: serialize(result), demo: !databaseAvailable });
});
app.post('/api/challenges', async (req, res) => {
  const { title, description, category, location, expectedImpact, supportingInformation, proposedSolutions } = req.body;
  const validCategories = ['Education', 'Healthcare', 'Environment', 'Public Infrastructure', "Women's Safety", 'Employment', 'Accessibility', 'Other'];
  if (!title || !description || !category || !location || !expectedImpact) return res.status(400).json({ error: 'Title, description, category, location, and expected impact are required.' });
  if (!validCategories.includes(category)) return res.status(400).json({ error: 'Please select a valid challenge category.' });
  const challenge = await withDatabase(() => prisma.challenge.create({ data: { title, description, category, location, expectedImpact, supportingInformation, proposedSolutions } }), () => ({ id: `demo-${Date.now()}`, title, description, category, location, expectedImpact, supportingInformation, proposedSolutions, status: 'open', votes: 0, createdAt: new Date().toISOString() }));
  res.status(201).json({ data: serialize(challenge), demo: !databaseAvailable });
});
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body;
  if (!name || !email || !password || password.length < 8 || password !== confirmPassword) return res.status(400).json({ error: 'Name, email, matching passwords of at least 8 characters are required.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await withDatabase(() => prisma.user.create({ data: { name, email, passwordHash } }), () => ({ id: 'demo-user', name, email, role: 'resident' }));
  res.status(201).json({ data: user, demo: !databaseAvailable });
});
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) return res.status(400).json({ error: 'Email and a password of at least 8 characters are required.' });
  const user = await withDatabase(async () => { const found = await prisma.user.findUnique({ where: { email } }); if (!found || !(await bcrypt.compare(password, found.passwordHash))) return null; return found; }, () => ({ id: 'demo-user', name: 'Demo Resident', email, role: 'resident' }));
  if (!user) return res.status(401).json({ error: 'Account not found.' });
  res.json({ data: { id: user.id, name: user.name, email: user.email, role: user.role }, demo: !databaseAvailable });
});
app.get('/api/dashboard/stats', async (_req, res) => {
  const stats = await withDatabase(async () => ({ challenges: await prisma.challenge.count(), open: await prisma.challenge.count({ where: { status: 'open' } }), inProgress: await prisma.challenge.count({ where: { status: 'in_progress' } }), resolved: await prisma.challenge.count({ where: { status: 'resolved' } }), participatingOrganizations: await prisma.organization.count(), votes: (await prisma.challenge.aggregate({ _sum: { votes: true } }))._sum.votes || 0 }), () => ({ challenges: demoChallenges.length, open: demoChallenges.filter((c) => c.status === 'open').length, inProgress: demoChallenges.filter((c) => c.status === 'in-progress').length, resolved: demoChallenges.filter((c) => c.status === 'resolved').length, participatingOrganizations: 0, votes: demoChallenges.reduce((sum, c) => sum + c.votes, 0) }));
  res.json({ data: stats, demo: !databaseAvailable });
});
export default app;
