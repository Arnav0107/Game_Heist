const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Global state
let gameConfig = null;
let submissions = [];
let isLocked = false;
let isRevealed = false;

const SUBMISSIONS_FILE = path.join(__dirname, 'submissions.json');

// Load config.json
function loadConfig() {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
    gameConfig = JSON.parse(data);
    console.log('✅ Configuration loaded successfully.');
  } catch (error) {
    console.error('❌ Failed to load config.json:', error);
    process.exit(1);
  }
}

// Load existing submissions if any
function loadSubmissions() {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const data = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
      submissions = JSON.parse(data);
      console.log(`✅ Loaded ${submissions.length} existing submissions.`);
    }
  } catch (error) {
    console.error('⚠️ Could not load existing submissions.json:', error);
  }
}

// Save submissions to disk
function saveSubmissions() {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(submissions, null, 2), 'utf8');
  } catch (error) {
    console.error('❌ Failed to save submissions.json:', error);
  }
}

// Get the local IPv4 address
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Look for IPv4 and skip loopback/internal interfaces
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();
const GAME_URL = `http://${LOCAL_IP}:${PORT}`;

// --- API Endpoints ---

// Get safe config for client (without correct answers)
app.get('/api/config', (req, res) => {
  if (!gameConfig) return res.status(500).json({ error: 'Config not loaded' });
  
  // Clone config and redact correct answers
  const clientConfig = {
    timerDurationSeconds: gameConfig.timerDurationSeconds,
    wallets: gameConfig.wallets,
    transactions: gameConfig.transactions,
    clues: gameConfig.clues
  };
  res.json(clientConfig);
});

// Submit team answers
app.post('/api/submit', (req, res) => {
  if (isLocked) {
    return res.status(403).json({ error: 'Submissions are frozen by the host.' });
  }

  const { teamName, thiefWallet, fakeClueId, timeTakenSeconds } = req.body;

  if (!teamName || !teamName.trim()) {
    return res.status(400).json({ error: 'Team name is required.' });
  }
  if (!thiefWallet || !fakeClueId) {
    return res.status(400).json({ error: 'suspected Thief Wallet and suspected Fake Clue are required.' });
  }

  // Check if teamName already submitted
  const normalizedTeamName = teamName.trim().toLowerCase();
  const alreadySubmitted = submissions.some(s => s.teamName.trim().toLowerCase() === normalizedTeamName);
  if (alreadySubmitted) {
    return res.status(400).json({ error: 'This team name has already submitted answers.' });
  }

  const isThiefCorrect = thiefWallet.toLowerCase() === gameConfig.correctThiefWallet.toLowerCase();
  const isFakeClueCorrect = fakeClueId === gameConfig.correctFakeClueId;
  const isCorrect = isThiefCorrect && isFakeClueCorrect;

  const newSubmission = {
    teamName: teamName.trim(),
    thiefWallet,
    fakeClueId,
    isCorrect,
    isThiefCorrect,
    isFakeClueCorrect,
    timestamp: Date.now(),
    timeTakenSeconds: timeTakenSeconds || 0,
    submissionTimeStr: new Date().toLocaleTimeString()
  };

  submissions.push(newSubmission);
  saveSubmissions();

  res.json({
    success: true,
    isCorrect,
    isThiefCorrect,
    isFakeClueCorrect
  });
});

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
  // Sorting rules:
  // 1. Correct submissions first
  // 2. Then ordered by submission timestamp (ascending)
  const sorted = [...submissions].sort((a, b) => {
    if (a.isCorrect && !b.isCorrect) return -1;
    if (!a.isCorrect && b.isCorrect) return 1;
    return a.timestamp - b.timestamp;
  });
  res.json(sorted);
});

// Host status control
app.get('/api/host/status', (req, res) => {
  res.json({
    isLocked,
    isRevealed,
    localIp: LOCAL_IP,
    port: PORT,
    gameUrl: GAME_URL
  });
});

// Lock submissions
app.post('/api/host/lock', (req, res) => {
  const { lock } = req.body;
  isLocked = lock !== undefined ? !!lock : !isLocked;
  res.json({ success: true, isLocked });
});

// Reveal correct answers
app.post('/api/host/reveal', (req, res) => {
  const { reveal } = req.body;
  isRevealed = reveal !== undefined ? !!reveal : !isRevealed;
  
  const responseData = { success: true, isRevealed };
  if (isRevealed) {
    responseData.correctThiefWallet = gameConfig.correctThiefWallet;
    responseData.correctFakeClueId = gameConfig.correctFakeClueId;
    
    // Find matching wallet details to send alias
    const thiefDetails = gameConfig.wallets.find(w => w.address.toLowerCase() === gameConfig.correctThiefWallet.toLowerCase());
    const clueDetails = gameConfig.clues.find(c => c.id === gameConfig.correctFakeClueId);
    
    responseData.correctThiefAlias = thiefDetails ? thiefDetails.alias : 'Unknown';
    responseData.correctFakeClueTitle = clueDetails ? clueDetails.title : 'Unknown';
  }
  res.json(responseData);
});

// Generate and serve QR code
app.get('/api/qr-code', async (req, res) => {
  try {
    const dataUrl = await QRCode.toDataURL(GAME_URL);
    res.json({ qrCodeDataUrl: dataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Fallback to serving public/index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
loadConfig();
loadSubmissions();

app.listen(PORT, () => {
  console.log('\n=============================================');
  console.log(`🚀 DEVCON HEIST SERVER RUNNING`);
  console.log(`🔗 Local view: http://localhost:${PORT}`);
  console.log(`🌐 Network view: ${GAME_URL}`);
  console.log(`🖥️  Host interface: http://localhost:${PORT}/host.html`);
  console.log('=============================================\n');
});
