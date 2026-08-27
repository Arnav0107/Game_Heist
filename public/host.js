// Host View Logic for The DevCon Heist

// DOM Elements
const hostLockBtn = document.getElementById('host-lock-btn');
const hostRevealBtn = document.getElementById('host-reveal-btn');
const gameConnectionUrl = document.getElementById('game-connection-url');
const qrImg = document.getElementById('qr-img');

const podiumName1 = document.getElementById('podium-name-1');
const podiumTime1 = document.getElementById('podium-time-1');
const podiumName2 = document.getElementById('podium-name-2');
const podiumTime2 = document.getElementById('podium-time-2');
const podiumName3 = document.getElementById('podium-name-3');
const podiumTime3 = document.getElementById('podium-time-3');

const leaderboardTbody = document.getElementById('leaderboard-tbody');

const revealPanel = document.getElementById('reveal-panel');
const revealThiefAlias = document.getElementById('reveal-thief-alias');
const revealThiefAddress = document.getElementById('reveal-thief-address');
const revealClueTitle = document.getElementById('reveal-clue-title');

// State
let isSubmissionsLocked = false;
let isAnswersRevealed = false;

// Shorten Ethereum Address helper
function shortenAddress(address) {
  if (!address) return '';
  if (address.length <= 12) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// 1. Fetch connection details and QR code on startup
async function initializeHostView() {
  try {
    // Get status (IP and URL)
    const statusResp = await fetch('/api/host/status');
    const statusData = await statusResp.json();
    
    gameConnectionUrl.textContent = statusData.gameUrl;
    
    // Fetch QR Code image
    const qrResp = await fetch('/api/qr-code');
    const qrData = await qrResp.json();
    qrImg.src = qrData.qrCodeDataUrl;
    
    updateHostControlsState(statusData.isLocked, statusData.isRevealed);
  } catch (error) {
    console.error('Failed to initialize host connection parameters:', error);
  }
}

// 2. Lock/Unlock submissions
async function toggleSubmissionLock() {
  try {
    const response = await fetch('/api/host/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    updateHostControlsState(data.isLocked, isAnswersRevealed);
  } catch (error) {
    console.error('Error toggling submission lock:', error);
  }
}

// 3. Reveal/Hide Answers
async function toggleAnswersReveal() {
  try {
    const response = await fetch('/api/host/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    
    updateHostControlsState(isSubmissionsLocked, data.isRevealed);
    
    if (data.isRevealed) {
      revealThiefAlias.textContent = data.correctThiefAlias;
      revealThiefAddress.textContent = data.correctThiefWallet;
      revealClueTitle.textContent = data.correctFakeClueTitle;
      revealPanel.classList.add('active');
    } else {
      revealPanel.classList.remove('active');
    }
  } catch (error) {
    console.error('Error revealing mystery answers:', error);
  }
}

// 4. Update Lock and Reveal Button Classes/Text
function updateHostControlsState(locked, revealed) {
  isSubmissionsLocked = locked;
  isAnswersRevealed = revealed;

  if (locked) {
    hostLockBtn.innerHTML = '🔓 UNFREEZE ANSWERS';
    hostLockBtn.classList.add('active');
  } else {
    hostLockBtn.innerHTML = '🔒 FREEZE ANSWERS';
    hostLockBtn.classList.remove('active');
  }

  if (revealed) {
    hostRevealBtn.innerHTML = '🙈 HIDE REVEAL';
    hostRevealBtn.classList.add('active');
    revealPanel.classList.add('active');
  } else {
    hostRevealBtn.innerHTML = '👁️ REVEAL RESULTS';
    hostRevealBtn.classList.remove('active');
    revealPanel.classList.remove('active');
  }
}

// 5. Poll Leaderboard data
async function pollLeaderboard() {
  try {
    const response = await fetch('/api/leaderboard');
    if (!response.ok) throw new Error('Network error');
    const leaderboard = await response.json();
    
    renderLeaderboard(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard data:', error);
  }
}

// 6. Render Leaderboard Standings
function renderLeaderboard(submissions) {
  // Update Podium (Top 3)
  const top1 = submissions[0];
  const top2 = submissions[1];
  const top3 = submissions[2];

  // 1st place
  if (top1) {
    podiumName1.textContent = top1.teamName;
    podiumName1.classList.remove('podium-empty');
    podiumTime1.textContent = top1.isCorrect ? `Verified in ${formatDuration(top1.timeTakenSeconds)}` : 'Submitted';
  } else {
    podiumName1.textContent = 'Waiting for Solves';
    podiumName1.classList.add('podium-empty');
    podiumTime1.textContent = '-';
  }

  // 2nd place
  if (top2) {
    podiumName2.textContent = top2.teamName;
    podiumName2.classList.remove('podium-empty');
    podiumTime2.textContent = top2.isCorrect ? `Verified in ${formatDuration(top2.timeTakenSeconds)}` : 'Submitted';
  } else {
    podiumName2.textContent = '-';
    podiumName2.classList.add('podium-empty');
    podiumTime2.textContent = '-';
  }

  // 3rd place
  if (top3) {
    podiumName3.textContent = top3.teamName;
    podiumName3.classList.remove('podium-empty');
    podiumTime3.textContent = top3.isCorrect ? `Verified in ${formatDuration(top3.timeTakenSeconds)}` : 'Submitted';
  } else {
    podiumName3.textContent = '-';
    podiumName3.classList.add('podium-empty');
    podiumTime3.textContent = '-';
  }

  // Render Table
  leaderboardTbody.innerHTML = '';
  if (submissions.length === 0) {
    leaderboardTbody.innerHTML = '<tr><td colspan="6" class="tx-empty">Waiting for submissions to connect...</td></tr>';
    return;
  }

  submissions.forEach((sub, index) => {
    const tr = document.createElement('tr');
    if (sub.isCorrect) {
      tr.className = 'leaderboard-row-correct';
    }

    const rank = index + 1;
    let rankHtml = `<span class="rank-badge">${rank}</span>`;
    
    // Top 3 medals
    if (rank === 1) rankHtml = `<span class="rank-badge" style="color:#ffd700">🥇</span>`;
    else if (rank === 2) rankHtml = `<span class="rank-badge" style="color:#c0c0c0">🥈</span>`;
    else if (rank === 3) rankHtml = `<span class="rank-badge" style="color:#cd7f32">🥉</span>`;

    // Format results depending on host reveal status (optionally keep secret or display validation checkmarks)
    let thiefCell = 'Locked';
    let clueCell = 'Locked';
    let statusHtml = '<span class="status-badge">PENDING</span>';

    if (isAnswersRevealed) {
      thiefCell = shortenAddress(sub.thiefWallet);
      clueCell = sub.fakeClueId.toUpperCase().replace('_', ' ');
      
      if (sub.isCorrect) {
        statusHtml = '<span class="status-badge correct">VERIFIED</span>';
      } else {
        // Construct split details
        const details = [];
        if (sub.isThiefCorrect) details.push('Thief ✓');
        else details.push('Thief ✗');
        if (sub.isFakeClueCorrect) details.push('Clue ✓');
        else details.push('Clue ✗');
        
        statusHtml = `<span class="status-badge incorrect" title="${details.join(', ')}">INVALID</span>`;
      }
    } else {
      // If not revealed, we can show whether it's Correct/Incorrect to drive hype, or hide it.
      // Let's show correctness (so they know who solved it) but hide the exact answers!
      // This is perfect for driving competition and hackathon energy.
      if (sub.isCorrect) {
        statusHtml = '<span class="status-badge correct">SOLVED</span>';
      } else {
        statusHtml = '<span class="status-badge incorrect">FAILED</span>';
      }
      
      // Obfuscate choices to maintain secrecy of the puzzle
      thiefCell = '••••••••';
      clueCell = '••••••••';
    }

    tr.innerHTML = `
      <td>${rankHtml}</td>
      <td class="leaderboard-team-name">${sub.teamName}</td>
      <td class="mono">${thiefCell}</td>
      <td class="mono">${clueCell}</td>
      <td>${statusHtml}</td>
      <td class="leaderboard-time mono">${sub.submissionTimeStr}</td>
    `;
    leaderboardTbody.appendChild(tr);
  });
}

// Format duration in seconds to M:SS
function formatDuration(seconds) {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Event Listeners
hostLockBtn.addEventListener('click', toggleSubmissionLock);
hostRevealBtn.addEventListener('click', toggleAnswersReveal);

// Initial Load & Polling setup
window.addEventListener('load', () => {
  initializeHostView();
  pollLeaderboard();
  
  // Poll leaderboard every 2 seconds
  setInterval(pollLeaderboard, 2000);
});
