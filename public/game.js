// Game Controller for The DevCon Heist

// State variables
let config = null;
let activeFilterAddress = null;
let timerInterval = null;
let countdownDuration = 720; // Default 12 minutes, overwritten by config

// DOM Elements
const screenLanding = document.getElementById('screen-landing');
const screenGame = document.getElementById('screen-game');
const screenResult = document.getElementById('screen-result');

const teamNameInput = document.getElementById('team-name-input');
const startGameBtn = document.getElementById('start-game-btn');
const teamNameDisplay = document.getElementById('team-name-display');

const landingCountdown = document.getElementById('landing-countdown');
const gameCountdown = document.getElementById('game-countdown');
const gameTimerWrapper = document.getElementById('game-timer-wrapper');

const walletsGrid = document.getElementById('wallets-grid');
const cluesGrid = document.getElementById('clues-grid');
const explorerTbody = document.getElementById('explorer-tbody');
const explorerFilterDesc = document.getElementById('explorer-filter-desc');
const resetFilterBtn = document.getElementById('reset-filter-btn');

const openSubmitBtn = document.getElementById('open-submit-btn');
const submitOverlay = document.getElementById('submit-overlay');
const closeSubmitBtn = document.getElementById('close-submit-btn');
const transmitBtn = document.getElementById('transmit-btn');
const submitError = document.getElementById('submit-error');

const suspectThiefSelect = document.getElementById('suspect-thief-select');
const suspectClueSelect = document.getElementById('suspect-clue-select');

// Result Screen elements
const resultIcon = document.getElementById('result-icon');
const resultStatusTitle = document.getElementById('result-status-title');
const resultMsg = document.getElementById('result-msg');
const resultStatTeam = document.getElementById('result-stat-team');
const resultStatThief = document.getElementById('result-stat-thief');
const resultStatClue = document.getElementById('result-stat-clue');
const resultStatTime = document.getElementById('result-stat-time');

// Helper: Shorten Ethereum address (0x1234...abcd)
function shortenAddress(address) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Helper: Format ISO timestamp to hh:mm:ss
function formatTime(isoString) {
  try {
    if (isoString.includes('T')) {
      return isoString.split('T')[1].substring(0, 8);
    }
    return isoString;
  } catch (e) {
    return isoString;
  }
}

// 1. Fetch Game Configuration from server
async function fetchConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Failed to fetch config');
    config = await response.json();
    countdownDuration = config.timerDurationSeconds || 720;
    
    // Set landing timer display correctly
    const min = Math.floor(countdownDuration / 60);
    const sec = countdownDuration % 60;
    landingCountdown.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    gameCountdown.textContent = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    
    initializeGameUI();
  } catch (error) {
    console.error('Error fetching game configuration:', error);
    alert('Failed to connect to heist server. Please verify you are on the correct network.');
  }
}

// 2. Initialize Game UI components with static configuration
function initializeGameUI() {
  if (!config) return;

  // Suspects Grid
  walletsGrid.innerHTML = '';
  config.wallets.forEach(wallet => {
    const card = document.createElement('div');
    card.className = 'wallet-card';
    card.dataset.address = wallet.address;
    card.innerHTML = `
      <div class="wallet-card-header">
        <span class="wallet-alias">${wallet.alias}</span>
        <span class="wallet-balance">${wallet.balance}</span>
      </div>
      <div class="wallet-address mono">${shortenAddress(wallet.address)}</div>
      <p class="wallet-blurb">${wallet.blurb}</p>
      <div class="wallet-meta">
        <span>Seen: ${wallet.firstSeen}</span>
      </div>
    `;
    card.addEventListener('click', () => toggleWalletFilter(wallet.address));
    walletsGrid.appendChild(card);
  });

  // Clues Grid
  cluesGrid.innerHTML = '';
  config.clues.forEach(clue => {
    const card = document.createElement('div');
    card.className = 'clue-card';
    card.innerHTML = `
      <div class="clue-card-header">
        <span class="clue-title">${clue.title}</span>
        <span class="clue-type">${clue.type}</span>
      </div>
      <p class="clue-description">${clue.description}</p>
    `;
    cluesGrid.appendChild(card);
  });

  // Populate Submission Dropdowns
  suspectThiefSelect.innerHTML = '<option value="">-- SELECT SUSPECT WALLET --</option>';
  config.wallets.forEach(wallet => {
    const opt = document.createElement('option');
    opt.value = wallet.address;
    opt.textContent = `${wallet.alias} (${shortenAddress(wallet.address)})`;
    suspectThiefSelect.appendChild(opt);
  });

  suspectClueSelect.innerHTML = '<option value="">-- SELECT CONTRADICTORY CLUE --</option>';
  config.clues.forEach(clue => {
    const opt = document.createElement('option');
    opt.value = clue.id;
    opt.textContent = `${clue.title} (${clue.type})`;
    suspectClueSelect.appendChild(opt);
  });

  // Render explorer transactions
  renderExplorer();
}

// 3. Render Blockchain Explorer
function renderExplorer() {
  if (!config) return;
  
  explorerTbody.innerHTML = '';
  
  // Filter transactions if activeFilterAddress is set
  const filteredTxs = activeFilterAddress 
    ? config.transactions.filter(tx => 
        tx.from.toLowerCase() === activeFilterAddress.toLowerCase() || 
        tx.to.toLowerCase() === activeFilterAddress.toLowerCase()
      )
    : config.transactions;

  if (filteredTxs.length === 0) {
    explorerTbody.innerHTML = '<tr><td colspan="6" class="tx-empty">No transactions found on-chain for this wallet.</td></tr>';
    return;
  }

  // Sort transactions by timestamp ascending (shows chain order)
  const sortedTxs = [...filteredTxs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  sortedTxs.forEach(tx => {
    const tr = document.createElement('tr');
    
    // Check if addresses match selected filter
    const isFromFilter = activeFilterAddress && tx.from.toLowerCase() === activeFilterAddress.toLowerCase();
    const isToFilter = activeFilterAddress && tx.to.toLowerCase() === activeFilterAddress.toLowerCase();
    
    // Build short forms
    const shortFrom = shortenAddress(tx.from);
    const shortTo = shortenAddress(tx.to);
    
    // Direction column indicator
    let directionHtml = '';
    if (activeFilterAddress) {
      if (isFromFilter && isToFilter) {
        directionHtml = '<span class="tx-direction out">SELF</span>';
      } else if (isFromFilter) {
        directionHtml = '<span class="tx-direction out">OUT</span>';
      } else if (isToFilter) {
        directionHtml = '<span class="tx-direction in">IN</span>';
      }
    } else {
      directionHtml = '<span class="mono" style="color: var(--text-muted);">&rarr;</span>';
    }

    // Large amount flag
    const amountVal = parseFloat(tx.amount);
    const amountClass = amountVal >= 100 ? 'tx-amount large' : 'tx-amount';

    // Highlight from/to labels if active
    const fromClass = isFromFilter ? 'tx-address highlight' : 'tx-address';
    const toClass = isToFilter ? 'tx-address highlight' : 'tx-address';

    tr.innerHTML = `
      <td class="tx-hash mono">${shortenAddress(tx.hash)}</td>
      <td class="mono">${formatTime(tx.timestamp)}</td>
      <td class="mono"><span class="${fromClass}" title="${tx.from}">${shortFrom}</span></td>
      <td>${directionHtml}</td>
      <td class="mono"><span class="${toClass}" title="${tx.to}">${shortTo}</span></td>
      <td class="${amountClass} mono">${tx.amount} ${tx.token}</td>
    `;
    explorerTbody.appendChild(tr);
  });
}

// 4. Handle Wallet Filtering Selection
function toggleWalletFilter(address) {
  if (activeFilterAddress === address) {
    // Toggle off
    activeFilterAddress = null;
    explorerFilterDesc.innerHTML = 'Showing <strong>all transactions</strong>. Click a wallet profile to filter.';
    resetFilterBtn.style.display = 'none';
    
    document.querySelectorAll('.wallet-card').forEach(c => c.classList.remove('active'));
  } else {
    // Toggle on
    activeFilterAddress = address;
    const wallet = config.wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    const alias = wallet ? wallet.alias : shortenAddress(address);
    explorerFilterDesc.innerHTML = `Filter active: showing transactions for <strong>${alias}</strong> (${shortenAddress(address)}).`;
    resetFilterBtn.style.display = 'inline-block';
    
    document.querySelectorAll('.wallet-card').forEach(c => {
      if (c.dataset.address === address) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }
  renderExplorer();
}

// 5. Timer Implementation using absolute target timestamp to survive page backgrounding
function startTimer() {
  let targetTime = localStorage.getItem('heist_target_time');
  
  if (!targetTime) {
    // Generate new target time
    targetTime = Date.now() + (countdownDuration * 1000);
    localStorage.setItem('heist_target_time', targetTime);
  } else {
    targetTime = parseInt(targetTime, 10);
  }

  updateTimer(targetTime);
  timerInterval = setInterval(() => updateTimer(targetTime), 1000);
}

function updateTimer(targetTime) {
  const now = Date.now();
  const diff = targetTime - now;

  if (diff <= 0) {
    clearInterval(timerInterval);
    landingCountdown.textContent = '00:00';
    gameCountdown.textContent = '00:00';
    gameTimerWrapper.classList.add('warning');
    // Lock submit button
    openSubmitBtn.disabled = true;
    openSubmitBtn.textContent = '⏱ TIME EXPIRED - COORDINATES LOCK';
    return;
  }

  const secondsTotal = Math.floor(diff / 1000);
  const min = Math.floor(secondsTotal / 60);
  const sec = secondsTotal % 60;

  const timeStr = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  landingCountdown.textContent = timeStr;
  gameCountdown.textContent = timeStr;

  // Add hazard color warning at 3 minutes (180s)
  if (secondsTotal <= 180) {
    gameTimerWrapper.classList.add('warning');
  } else {
    gameTimerWrapper.classList.remove('warning');
  }
}

// 6. Navigation: Start Game Play Screen
function startGame() {
  const teamName = teamNameInput.value.trim();
  if (!teamName) {
    alert('Please enter a team name before starting the case file.');
    return;
  }

  localStorage.setItem('heist_team_name', teamName);
  teamNameDisplay.textContent = `Team: ${teamName}`;
  
  // Transition Screens
  screenLanding.classList.remove('active');
  screenGame.classList.add('active');
  
  startTimer();
}

// 7. Answer Submission Logic
async function submitAnswers() {
  const teamName = localStorage.getItem('heist_team_name') || 'Unknown Team';
  const thiefWallet = suspectThiefSelect.value;
  const fakeClueId = suspectClueSelect.value;

  if (!thiefWallet || !fakeClueId) {
    showSubmitError('Please select both a Suspected Thief Wallet and a Fake Evidence Clue.');
    return;
  }

  transmitBtn.disabled = true;
  transmitBtn.textContent = 'TRANSMITTING SIGNAL...';
  submitError.style.display = 'none';

  // Calculate elapsed time taken by team
  const targetTime = parseInt(localStorage.getItem('heist_target_time') || '0', 10);
  const originalStart = targetTime - (countdownDuration * 1000);
  const timeTakenSeconds = Math.max(0, Math.floor((Date.now() - originalStart) / 1000));

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        teamName,
        thiefWallet,
        fakeClueId,
        timeTakenSeconds
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Coordinates transmission failed.');
    }

    // Save submission results locally
    localStorage.setItem('heist_submitted', 'true');
    localStorage.setItem('heist_is_correct', data.isCorrect ? 'true' : 'false');
    localStorage.setItem('heist_is_thief_correct', data.isThiefCorrect ? 'true' : 'false');
    localStorage.setItem('heist_is_clue_correct', data.isFakeClueCorrect ? 'true' : 'false');
    localStorage.setItem('heist_submit_time', new Date().toLocaleTimeString());

    showResults(data.isCorrect, data.isThiefCorrect, data.isFakeClueCorrect, new Date().toLocaleTimeString());

  } catch (error) {
    showSubmitError(error.message);
    transmitBtn.disabled = false;
    transmitBtn.textContent = '📡 TRANSMIT COORDINATES';
  }
}

function showSubmitError(msg) {
  submitError.textContent = msg;
  submitError.style.display = 'block';
}

// 8. Renders Results screen
function showResults(isCorrect, isThiefCorrect, isClueCorrect, submitTimeStr) {
  const teamName = localStorage.getItem('heist_team_name') || 'Team';
  
  // Close Modal
  submitOverlay.classList.remove('active');
  
  // Update Results Page details
  resultStatTeam.textContent = teamName;
  resultStatThief.textContent = isThiefCorrect ? '✅ CORRECT' : '❌ INCORRECT';
  resultStatThief.className = isThiefCorrect ? 'stat-value success' : 'stat-value fail';
  
  resultStatClue.textContent = isClueCorrect ? '✅ CORRECT' : '❌ INCORRECT';
  resultStatClue.className = isClueCorrect ? 'stat-value success' : 'stat-value fail';
  
  resultStatTime.textContent = submitTimeStr;

  if (isCorrect) {
    resultIcon.textContent = '✅';
    resultStatusTitle.textContent = 'TRANSMISSION VERIFIED';
    resultStatusTitle.className = 'result-status-title status-correct';
    resultMsg.textContent = 'Congratulations, detective! Your signal successfully intercepted the stolen funds. You have been ranked on the Host View projector. Wait for the host to unlock the final podium.';
  } else {
    resultIcon.textContent = '❌';
    resultStatusTitle.textContent = 'TRANSMISSION FAILED';
    resultStatusTitle.className = 'result-status-title status-incorrect';
    resultMsg.textContent = 'The heist coordinates were incorrect. The security grid detected your signal and locked you out. Keep checking the presenter screen for final results!';
  }

  // Active Screen
  screenLanding.classList.remove('active');
  screenGame.classList.remove('active');
  screenResult.classList.add('active');
}

// 9. Check state on boot (helps recover from lock screen / refresh)
function checkStateOnBoot() {
  const hasSubmitted = localStorage.getItem('heist_submitted') === 'true';
  const teamName = localStorage.getItem('heist_team_name');

  if (hasSubmitted) {
    const isCorrect = localStorage.getItem('heist_is_correct') === 'true';
    const isThiefCorrect = localStorage.getItem('heist_is_thief_correct') === 'true';
    const isClueCorrect = localStorage.getItem('heist_is_clue_correct') === 'true';
    const submitTime = localStorage.getItem('heist_submit_time') || '00:00';
    showResults(isCorrect, isThiefCorrect, isClueCorrect, submitTime);
  } else if (teamName) {
    // Restore active game session
    teamNameDisplay.textContent = `Team: ${teamName}`;
    screenLanding.classList.remove('active');
    screenGame.classList.add('active');
    startTimer();
  }
}

// Event Listeners
startGameBtn.addEventListener('click', startGame);
teamNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') startGame();
});

openSubmitBtn.addEventListener('click', () => {
  submitOverlay.classList.add('active');
  submitError.style.display = 'none';
});

closeSubmitBtn.addEventListener('click', () => {
  submitOverlay.classList.remove('active');
});

transmitBtn.addEventListener('click', submitAnswers);

resetFilterBtn.addEventListener('click', () => {
  activeFilterAddress = null;
  explorerFilterDesc.innerHTML = 'Showing <strong>all transactions</strong>. Click a wallet profile to filter.';
  resetFilterBtn.style.display = 'none';
  document.querySelectorAll('.wallet-card').forEach(c => c.classList.remove('active'));
  renderExplorer();
});

// Click outside submit modal content to close it
submitOverlay.addEventListener('click', (e) => {
  if (e.target === submitOverlay) {
    submitOverlay.classList.remove('active');
  }
});

// Boot operations
window.addEventListener('load', () => {
  fetchConfig();
  checkStateOnBoot();
});
