const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Initialize Web Audio API
// We use a "lazy" initialization to comply with browser security
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Set canvas size
canvas.width = 800;
canvas.height = 600;

// Game State
const state = {
    speed: 0.02, // Slowed down from 0.05
    gridOffset: 0,
    playerX: canvas.width / 2,
    bullets: [],
    buildings: [],
    enemies: [],
    enemyBullets: [],
    powerups: [],
    explosions: [],
    lastBuildingTime: 0,
    lastEnemyTime: 0,
    lastFireTime: 0,
    keys: {},
    score: 0,
    health: 100,
    fireLevel: 1,
    bassStarted: false,
    shakeIntensity: 0,
    gameOver: false,
    // Pre-generate stars so they stay static
    stars: Array.from({ length: 80 }, () => ({
        x: Math.random() * 800,
        y: Math.random() * 300,
        size: Math.random() * 2,
        blinkOffset: Math.random() * Math.PI * 2
    }))
};

// Input Handling
window.addEventListener('keydown', e => {
    state.keys[e.code] = true;
    // Resume audio context on first interaction
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    playBassLoop();
});
window.addEventListener('keyup', e => state.keys[e.code] = false);

// Mobile Touch Handling
canvas.addEventListener('touchstart', handleTouch, { passive: false });
canvas.addEventListener('touchmove', handleTouch, { passive: false });
canvas.addEventListener('touchend', e => {
    // Clear movement keys when fingers are lifted
    state.keys['ArrowLeft'] = false;
    state.keys['ArrowRight'] = false;
    state.keys['Space'] = false;
    e.preventDefault();
}, { passive: false });

function handleTouch(e) {
    e.preventDefault(); // Prevents scrolling while playing
    
    // Resume audio on first touch
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    playBassLoop();

    const rect = canvas.getBoundingClientRect();
    // This translates screen pixels (e.g. 300px) to game pixels (800px)
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // Reset firing state
    state.keys['Space'] = false;

    for (let i = 0; i < e.touches.length; i++) {
        // Calculate exactly where the finger is inside the game coordinates
        const touchX = (e.touches[i].clientX - rect.left) * scaleX;
        const touchY = (e.touches[i].clientY - rect.top) * scaleY;

        // Dragging: The car follows the first finger horizontally
        if (i === 0) {
            state.playerX = Math.max(40, Math.min(canvas.width - 40, touchX));
        }
        
        // Firing: If any finger is touching the top 80% of the screen, shoot!
        if (touchY < canvas.height * 0.8) {
            state.keys['Space'] = true;
        }
    }
}

/**
 * Synthesizes a retro laser "pew" sound
 */
function playShootSound() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth'; // Gritty retro sound
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Start high
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1); // Slide down fast

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

/**
 * Synthesizes a low-fi explosion using white noise
 */
function playExplosionSound() {
    const bufferSize = audioCtx.sampleRate * 0.5; // 0.5 seconds
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill buffer with random noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start();
    noise.stop(audioCtx.currentTime + 0.4);
}

/**
 * Plays a continuous, low-volume synth bass pulse
 */
function playBassLoop() {
    if (state.bassStarted) return;
    state.bassStarted = true;

    // 120 BPM = 2 pulses per second (500ms per pulse)
    setInterval(() => {
        if (state.gameOver) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        // 'sawtooth' gives that aggressive retro feel, 
        // but we'll filter it to keep it smooth.
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(55, audioCtx.currentTime); // A1 note

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, audioCtx.currentTime);

        gain.gain.setValueAtTime(0.04, audioCtx.currentTime); // Very low volume
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }, 500);
}

// Restart Button Logic
document.getElementById('restart-btn').addEventListener('click', () => {
    resetGame();
});

function resetGame() {
    state.health = 100;
    state.score = 0;
    state.fireLevel = 1;
    state.gameOver = false;
    state.bullets = [];
    state.enemies = [];
    state.enemyBullets = [];
    state.buildings = [];
    state.powerups = [];
    state.explosions = [];
    state.playerX = canvas.width / 2;
    
    document.getElementById('game-over').classList.add('hidden');
}

/**
 * Draws static stars that twinkle slightly
 */
function drawStars() {
    const now = Date.now() * 0.002;
    state.stars.forEach(s => {
        const twinkle = 0.4 + Math.sin(now + s.blinkOffset) * 0.6;
        ctx.fillStyle = `rgba(255, 255, 255, ${twinkle})`;
        ctx.fillRect(s.x, s.y, s.size, s.size);
    });
}

/**
 * Draws jagged mountain silhouettes on the horizon
 */
function drawMountains() {
    const vpy = canvas.height / 2;
    ctx.fillStyle = '#0a0015'; // Very dark purple
    ctx.strokeStyle = '#39ff14'; // Neon Green
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(0, vpy);
    // Recalculated peaks: Lowered in the center (300-500 range) to reveal the sun
    const peaks = [
        [0, 0], [100, -60], [200, -100], [300, -40], 
        [350, -10], [400, -5], [450, -10], [500, -30], 
        [600, -110], [700, -50], [800, 0]
    ];

    peaks.forEach(p => {
        ctx.lineTo(p[0], vpy + p[1]);
    });

    ctx.lineTo(canvas.width, vpy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/**
 * Draws the Synthwave Grid
 * This creates the illusion of moving forward.
 */
function drawGrid() {
    const vanishingPointY = canvas.height / 2;
    const vanishingPointX = canvas.width / 2;
    const numLines = 20;
    
    // 1. Update Grid Offset for animation
    state.gridOffset += state.speed;
    if (state.gridOffset > 1) state.gridOffset = 0;

    // 2. Draw Horizontal lines (Drawn FIRST so the road can cover them)
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const ratio = (i + state.gridOffset) / 10;
        const y = vanishingPointY + (ratio * ratio) * (canvas.height - vanishingPointY);
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
    }
    ctx.stroke();

    // 3. Draw the Road Surface (This acts as a "mask" to hide horizontal lines)
    ctx.fillStyle = '#0a0a1a'; // Dark asphalt
    ctx.beginPath();
    ctx.moveTo(vanishingPointX - 20, vanishingPointY);
    ctx.lineTo(vanishingPointX + 20, vanishingPointY);
    ctx.lineTo(canvas.width + 200, canvas.height);
    ctx.lineTo(-200, canvas.height);
    ctx.closePath();
    ctx.fill();

    // 4. Draw Dashed Center Line (Drawn AFTER road so it stays visible)
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#00ffff';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        // Calculate start and end of each dash using the grid offset
        const ratioStart = (i + state.gridOffset) / 10;
        const ratioEnd = (i + 0.4 + state.gridOffset) / 10; // 0.4 creates the "gap"
        
        const yStart = vanishingPointY + (ratioStart * ratioStart) * (canvas.height - vanishingPointY);
        const yEnd = vanishingPointY + (ratioEnd * ratioEnd) * (canvas.height - vanishingPointY);
        
        ctx.moveTo(vanishingPointX, yStart);
        ctx.lineTo(vanishingPointX, yEnd);
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // Reset glow

    // 5. Road Borders (Neon Cyan)
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vanishingPointX - 20, vanishingPointY); ctx.lineTo(-200, canvas.height);
    ctx.moveTo(vanishingPointX + 20, vanishingPointY); ctx.lineTo(canvas.width + 200, canvas.height);
    ctx.stroke();
}

/**
 * Draws the "Retro Sun" in the background
 */
function drawSun() {
    const vpy = canvas.height / 2;
    const x = canvas.width / 2;
    const y = vpy - 50;
    const radius = 80;

    ctx.save(); // Save state to apply clipping
    // Create a clipping region that only allows drawing ABOVE the horizon
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, vpy);
    ctx.clip();

    const gradient = ctx.createLinearGradient(x, y - radius, x, y + radius);
    gradient.addColorStop(0, '#ff00ff');
    gradient.addColorStop(1, '#ffff00');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add the "scanlines" to the sun
    ctx.fillStyle = '#20002c';
    for (let i = 0; i < 5; i++) {
        ctx.fillRect(x - radius, y + (i * 15), radius * 2, 4);
    }

    ctx.restore(); // Remove clipping so other things can draw on the bottom half
}

/**
 * Draws a retro-styled car at the player's position
 */
function drawCar(x, y, fireLevel) {
    // Car Body (Trapezoid for perspective)
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = fireLevel > 1 ? '#39ff14' : '#00ffff'; // Green glow if powered up
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x - 40, y + 20); // Bottom Left
    ctx.lineTo(x + 40, y + 20); // Bottom Right
    ctx.lineTo(x + 25, y - 10); // Top Right
    ctx.lineTo(x - 25, y - 10); // Top Left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Windshield
    ctx.fillStyle = '#00ffff';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 5);
    ctx.lineTo(x + 20, y - 5);
    ctx.lineTo(x + 15, y - 15);
    ctx.lineTo(x - 15, y - 15);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Energy Wings (Visual Power-up indicator)
    if (fireLevel > 2) {
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff00ff';
        
        // Left Wing
        ctx.beginPath();
        ctx.moveTo(x - 40, y + 10);
        ctx.lineTo(x - 60, y + 5);
        ctx.lineTo(x - 45, y - 5);
        ctx.stroke();
        
        // Right Wing
        ctx.beginPath();
        ctx.moveTo(x + 40, y + 10);
        ctx.lineTo(x + 60, y + 5);
        ctx.lineTo(x + 45, y - 5);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Guns
    ctx.fillStyle = fireLevel > 1 ? '#39ff14' : '#ff00ff';
    if (fireLevel >= 2) {
        ctx.fillRect(x - 35, y - 5, 10, 15); // Left Gun
        ctx.fillRect(x + 25, y - 5, 10, 15); // Right Gun
    }
    if (fireLevel % 2 !== 0) {
        ctx.fillRect(x - 5, y - 20, 10, 15); // Center Gun
    }
    
    // Tail Lights (Glow)
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff0000';
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(x - 35, y + 15, 15, 5);
    ctx.fillRect(x + 20, y + 15, 15, 5);
    ctx.shadowBlur = 0; // Reset shadow for other drawings
}

function drawBullets() {
    ctx.fillStyle = '#ffff00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffff00';
    
    state.bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - bullet.size / 2, bullet.y, bullet.size, bullet.size * 2);
    });
    
    ctx.shadowBlur = 0;
}

/**
 * Draws glowing power-up items on the road
 */
function drawPowerups() {
    state.powerups.forEach(p => {
        const scale = p.z * p.z;
        const vpy = canvas.height / 2;
        const vpx = canvas.width / 2;
        const x = vpx + p.xOffset * scale;
        const y = vpy + scale * (canvas.height - vpy);
        const size = 25 * p.z;

        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

/**
 * Draws the buildings on the sides
 */
function drawBuildings() {
    const vpy = canvas.height / 2;
    const vpx = canvas.width / 2;

    const sortedBuildings = [...state.buildings].sort((a, b) => a.z - b.z);

    sortedBuildings.forEach(b => {
        // 1. Atmospheric Fade-in: Buildings are transparent near the horizon
        // They become fully opaque by the time they reach z = 0.3
        const opacity = Math.min(1, b.z * 3.3);
        ctx.globalAlpha = opacity;

        // --- WINDOW CONFIGURATION ---
        // Higher numbers = smaller, more realistic windows
        const rows = Math.max(4, Math.floor(10 * b.hMult)); 
        const cols = Math.max(2, Math.floor(5 * b.wMult));

        // --- FRONT FACE CALCULATIONS ---
        // We use a slightly different scale for size to prevent the "pop-up" look
        const scale = b.z * b.z;
        const screenY = vpy + scale * (canvas.height - vpy);
        // Use the random multipliers assigned at spawn
        const bWidth = 150 * b.z * b.wMult;
        const bHeight = 400 * b.z * b.hMult;
        const roadEdgeX = 20 + 580 * scale; 
        const screenX = vpx + (b.side * (roadEdgeX + bWidth / 2 + 20));

        // --- SIDE FACE CALCULATIONS (The 3D part) ---
        // We calculate a "back" position slightly further away (90% of current depth)
        const backZ = b.z * 0.9;
        const backScale = backZ * backZ;
        const backY = vpy + backScale * (canvas.height - vpy);
        const backWidth = 150 * backZ * b.wMult;
        const backHeight = 400 * backZ * b.hMult;
        const backRoadEdgeX = 20 + 580 * backScale;
        const backX = vpx + (b.side * (backRoadEdgeX + backWidth / 2 + 20));

        const innerX = screenX - (b.side * bWidth / 2);
        const innerBackX = backX - (b.side * backWidth / 2);
        const outerX = screenX + (b.side * bWidth / 2);
        const outerBackX = backX + (b.side * backWidth / 2);

        // --- DRAW FACES IN DEPTH ORDER (Back to Front) ---
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1;

        // 1. Back Face (The "Plug" that prevents hollowness)
        ctx.fillStyle = '#050510';
        ctx.beginPath();
        ctx.moveTo(innerBackX, backY);
        ctx.lineTo(innerBackX, backY - backHeight);
        ctx.lineTo(outerBackX, backY - backHeight);
        ctx.lineTo(outerBackX, backY);
        ctx.closePath();
        ctx.fill();

        // 2. Top Face (The Roof)
        ctx.fillStyle = '#151525';
        ctx.beginPath();
        ctx.moveTo(innerX, screenY - bHeight);
        ctx.lineTo(outerX, screenY - bHeight);
        ctx.lineTo(outerBackX, backY - backHeight);
        ctx.lineTo(innerBackX, backY - backHeight);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3. Side Face (Facing the road)
        ctx.fillStyle = '#0d0d1a';
        ctx.beginPath();
        ctx.moveTo(innerX, screenY);
        ctx.lineTo(innerX, screenY - bHeight);
        ctx.lineTo(innerBackX, backY - backHeight);
        ctx.lineTo(innerBackX, backY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 4. Front Face (Facing the player)
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.moveTo(screenX - bWidth/2, screenY);
        ctx.lineTo(screenX - bWidth/2, screenY - bHeight);
        ctx.lineTo(screenX + bWidth/2, screenY - bHeight);
        ctx.lineTo(screenX + bWidth/2, screenY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // --- 5. WINDOWS (Perspective-Correct Logic) ---
        if (b.z > 0.1) {
            const originalAlpha = ctx.globalAlpha;
            ctx.fillStyle = '#ff00ff';
            
            // Window spacing (as a percentage of the building face)
            const margin = 0.2; // 20% margin around windows

            // --- FRONT WINDOWS ---
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    // Use seed to decide if window is "on"
                    if ((r * 3 + c + b.windowSeed) % 5 === 0) {
                        ctx.globalAlpha = originalAlpha * 0.7;
                        ctx.shadowBlur = 5 * b.z;
                        ctx.shadowColor = '#ff00ff';

                        // Calculate normalized coordinates (0 to 1)
                        const xRel = (c + margin) / cols;
                        const yRel = (r + margin) / rows;
                        const wRel = (1 - margin * 2) / cols;
                        const hRel = (1 - margin * 2) / rows;

                        const wx = (screenX - bWidth / 2) + xRel * bWidth;
                        const wy = (screenY - bHeight) + yRel * bHeight;
                        const ww = wRel * bWidth;
                        const wh = hRel * bHeight;

                        if (ww > 0.5 && wh > 0.5) ctx.fillRect(wx, wy, ww, wh);
                    }
                }
            }

            // --- SIDE WINDOWS (Skewed to match perspective) ---
            const sideCols = Math.max(2, Math.floor(cols / 2));
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < sideCols; c++) {
                    if ((r * 2 + c + b.windowSeed + 2) % 5 === 0) {
                        ctx.globalAlpha = originalAlpha * 0.7;
                        ctx.shadowBlur = 5 * b.z;
                        
                        // Horizontal interpolation (u) and Vertical interpolation (v)
                        const u1 = (c + margin) / sideCols;
                        const u2 = (c + 1 - margin) / sideCols;
                        const v1 = (r + margin) / rows;
                        const v2 = (r + 1 - margin) / rows;
                        
                        // Calculate the 4 corners of the window on the slanted side wall
                        const getSidePos = (u, v) => {
                            const x = innerX + (innerBackX - innerX) * u;
                            const yTop = (screenY - bHeight) + ((backY - backHeight) - (screenY - bHeight)) * u;
                            const yBottom = screenY + (backY - screenY) * u;
                            const y = yTop + (yBottom - yTop) * v;
                            return { x, y };
                        };

                        const p1 = getSidePos(u1, v1);
                        const p2 = getSidePos(u2, v1);
                        const p3 = getSidePos(u2, v2);
                        const p4 = getSidePos(u1, v2);

                        ctx.beginPath();
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.lineTo(p3.x, p3.y);
                        ctx.lineTo(p4.x, p4.y);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
            }
            ctx.globalAlpha = originalAlpha;
            ctx.shadowBlur = 0;
        }
    });
}

/**
 * Draws enemy cars
 */
function drawEnemies() {
    state.enemies.forEach(enemy => {
        const isHeavy = enemy.type === 'heavy';
        const scale = enemy.z * enemy.z;
        const vpy = canvas.height / 2;
        const vpx = canvas.width / 2;
        const x = vpx + enemy.xOffset * scale;
        const y = vpy + scale * (canvas.height - vpy);
        
        const opacity = Math.min(1, enemy.z * 4);
        ctx.globalAlpha = opacity;
        
        const w = (isHeavy ? 120 : 80) * enemy.z;
        const h = (isHeavy ? 45 : 30) * enemy.z;
        
        ctx.fillStyle = isHeavy ? '#1a0505' : '#2e1a1a';
        ctx.strokeStyle = isHeavy ? '#ff0000' : '#ff4400';
        ctx.lineWidth = isHeavy ? 3 : 2;
        
        ctx.beginPath();
        ctx.moveTo(x - w/2, y);
        ctx.lineTo(x + w/2, y);
        ctx.lineTo(x + w/3, y - h);
        ctx.lineTo(x - w/3, y - h);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.globalAlpha = 1.0;
    });
}

/**
 * Draws bullets fired by enemies
 */
function drawEnemyBullets() {
    ctx.fillStyle = '#ff4400';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff4400';
    state.enemyBullets.forEach(eb => {
        if (eb.damage > 20) ctx.fillStyle = '#ff0000'; // Red bullets for heavy enemies
        ctx.fillRect(eb.x - eb.size/2, eb.y, eb.size, eb.size * 2);
        ctx.fillStyle = '#ff4400';
    });
    ctx.shadowBlur = 0;
}

/**
 * Creates a burst of neon particles
 */
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        state.explosions.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            life: 1.0,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
    playExplosionSound();
}

/**
 * Draws active explosion particles
 */
function drawExplosions() {
    state.explosions.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 15 * p.life;
        ctx.shadowColor = p.color;
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function update() {
    // --- ALWAYS RUNNING LOGIC (Even if Game Over) ---
    
    // 1. Decay screen shake intensity
    state.shakeIntensity *= 0.9;
    if (state.shakeIntensity < 0.1) state.shakeIntensity = 0;

    // 2. Update UI Elements
    const scoreElement = document.getElementById('score');
    if (scoreElement) scoreElement.innerText = `SCORE: ${Math.floor(state.score).toString().padStart(6, '0')}`;

    const healthBar = document.getElementById('health-bar');
    if (healthBar) {
        healthBar.style.width = `${state.health}%`;
        // Change color to red when low
        healthBar.style.background = state.health < 30 ? '#ff0000' : '#39ff14';
    }

    // --- GAMEPLAY LOGIC ---

    // Stop all logic if the game is over
    if (state.gameOver) return;

    // Move player
    const carHalfWidth = 40; 
    if (state.keys['ArrowLeft'] && state.playerX > carHalfWidth) state.playerX -= 5;
    if (state.keys['ArrowRight'] && state.playerX < canvas.width - carHalfWidth) state.playerX += 5;

    const now = Date.now();

    // Shooting logic
    if (state.keys['Space'] && now - state.lastFireTime > 200) {
        playShootSound();
        if (state.fireLevel === 1) {
            state.bullets.push({ x: state.playerX, y: canvas.height - 70, size: 6, vx: 0 });
        } else if (state.fireLevel === 2) {
            state.bullets.push({ x: state.playerX - 30, y: canvas.height - 70, size: 6, vx: 0 });
            state.bullets.push({ x: state.playerX + 30, y: canvas.height - 70, size: 6, vx: 0 });
        } else if (state.fireLevel === 3) {
            state.bullets.push({ x: state.playerX, y: canvas.height - 70, size: 6, vx: 0 });
            state.bullets.push({ x: state.playerX - 30, y: canvas.height - 70, size: 6, vx: 0 });
            state.bullets.push({ x: state.playerX + 30, y: canvas.height - 70, size: 6, vx: 0 });
        } else {
            // Level 4+: 3 forward, 2 diagonal
            state.bullets.push({ x: state.playerX, y: canvas.height - 70, size: 6, vx: 0 });
            state.bullets.push({ x: state.playerX - 30, y: canvas.height - 70, size: 6, vx: 0 });
            state.bullets.push({ x: state.playerX + 30, y: canvas.height - 70, size: 6, vx: 0 });
            state.bullets.push({ x: state.playerX - 30, y: canvas.height - 70, size: 6, vx: -3 });
            state.bullets.push({ x: state.playerX + 30, y: canvas.height - 70, size: 6, vx: 3 });
        }
        state.lastFireTime = now;
    }

    // Update player bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        const bullet = state.bullets[i];
        bullet.y -= 8; // Move toward horizon
        bullet.x += bullet.vx; // Apply sideways velocity
        bullet.size *= 0.98; // Shrink to simulate distance
        
        const centerX = canvas.width / 2;
        bullet.x += (centerX - bullet.x) * 0.02;

        if (bullet.y < canvas.height / 2 || bullet.size < 1) {
            state.bullets.splice(i, 1);
        }
    }

    // Enemy Spawning
    if (now - state.lastEnemyTime > 2500) {
        const isHeavy = Math.random() > 0.8; // 20% chance for a heavy enemy
        state.enemies.push({ 
            z: 0, 
            xOffset: (Math.random() - 0.5) * 600, 
            lastFireTime: now + Math.random() * 1000,
            type: isHeavy ? 'heavy' : 'scout',
            health: isHeavy ? 2 : 1
        });
        state.lastEnemyTime = now;
    }

    // Update Enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        enemy.z += state.speed / 8; // Enemies move slightly faster than buildings
        
        // Enemy shooting logic
        if (now - enemy.lastFireTime > 2000 && enemy.z > 0.1 && enemy.z < 0.7) {
            const scale = enemy.z * enemy.z;
            const ex = (canvas.width / 2) + enemy.xOffset * scale;
            const ey = (canvas.height / 2) + scale * (canvas.height / 2);
            
            if (enemy.type === 'heavy') {
                // Heavy enemies fire two bullets from the sides
                const offset = 15 * enemy.z;
                state.enemyBullets.push({ x: ex - offset, y: ey, size: 8 * enemy.z, damage: 40 });
                state.enemyBullets.push({ x: ex + offset, y: ey, size: 8 * enemy.z, damage: 40 });
            } else {
                // Scouts fire one central bullet
                state.enemyBullets.push({ x: ex, y: ey, size: 5 * enemy.z, damage: 20 });
            }
            enemy.lastFireTime = now;
        }

        if (enemy.z > 1.5) state.enemies.splice(i, 1);
    }

    // Update Enemy Bullets
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const eb = state.enemyBullets[i];
        eb.y += 4;
        eb.size *= 1.01;
        if (eb.y > canvas.height) state.enemyBullets.splice(i, 1);
    }

    // Update Explosions
    for (let i = state.explosions.length - 1; i >= 0; i--) {
        const p = state.explosions[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03; // Fade out speed
        if (p.life <= 0) state.explosions.splice(i, 1);
    }

    // Building Spawning
    if (now - state.lastBuildingTime > 1200) {
        // Add a building on either left (-1) or right (1) side
        state.buildings.push({ 
            z: 0, 
            side: Math.random() > 0.5 ? 1 : -1,
            wMult: 0.7 + Math.random() * 0.6, // Random width between 70% and 130%
            hMult: 0.5 + Math.random() * 1.5, // Random height between 50% and 200%
            windowSeed: Math.floor(Math.random() * 10) // Stable seed for windows
        });
        state.lastBuildingTime = now;
    }

    // Update buildings
    state.buildings.forEach((b, index) => {
        // Sync speed: Since the grid has 10 segments, we move at 1/10th the offset speed
        b.z += state.speed / 10; 
        if (b.z > 1.5) state.buildings.splice(index, 1); // Remove when passed
    });

    // Collision Detection
    // 1. Player Bullets vs Enemies
    for (let i = state.bullets.length - 1; i >= 0; i--) {
        let bulletHit = false;
        for (let j = state.enemies.length - 1; j >= 0; j--) {
            const enemy = state.enemies[j];
            const scale = enemy.z * enemy.z;
            const ex = (canvas.width / 2) + enemy.xOffset * scale;
            const ey = (canvas.height / 2) + scale * (canvas.height / 2);
            const eWidth = 80 * enemy.z;
            const eHeight = 30 * enemy.z;

            if (state.bullets[i].x > ex - eWidth/2 && state.bullets[i].x < ex + eWidth/2 &&
                state.bullets[i].y > ey - eHeight && state.bullets[i].y < ey) {
                
                enemy.health--;
                bulletHit = true;

                if (enemy.health <= 0) {
                    createExplosion(ex, ey - eHeight/2, '#ff4400');
                    state.enemies.splice(j, 1);
                    state.score += 500;
                    
                    // 40% chance to drop a power-up
                    if (Math.random() < 0.4) {
                        state.powerups.push({ z: enemy.z, xOffset: enemy.xOffset });
                    }
                } else {
                    // Visual feedback for a non-lethal hit
                    createExplosion(ex, ey - eHeight/2, '#ffffff');
                }
                break;
            }
        }
        if (bulletHit) state.bullets.splice(i, 1);
    }

    // 3. Power-up Collection
    for (let i = state.powerups.length - 1; i >= 0; i--) {
        const p = state.powerups[i];
        p.z += state.speed / 10;
        const scale = p.z * p.z;
        const px = (canvas.width / 2) + p.xOffset * scale;
        const py = (canvas.height / 2) + scale * (canvas.height / 2);

        if (py > canvas.height - 100 && py < canvas.height && Math.abs(px - state.playerX) < 50) {
            state.fireLevel++;
            state.powerups.splice(i, 1);
            state.score += 1000;
            state.shakeIntensity = 5; // Little nudge when collecting
        } else if (p.z > 1.5) {
            state.powerups.splice(i, 1);
        }
    }

    // 2. Enemy Bullets vs Player
    for (let i = state.enemyBullets.length - 1; i >= 0; i--) {
        const eb = state.enemyBullets[i];
        if (eb.x > state.playerX - 40 && eb.x < state.playerX + 40 &&
            eb.y > canvas.height - 70 && eb.y < canvas.height - 40) {
            state.enemyBullets.splice(i, 1);
            state.health = Math.max(0, state.health - (eb.damage || 20));
            state.shakeIntensity = 15; // Start the screen shake
            state.fireLevel = 1; // Reset power-up on hit
        }
    }

    // Game Over Check
    if (state.health <= 0 && !state.gameOver) {
        state.gameOver = true;
        const gameOverEl = document.getElementById('game-over');
        if (gameOverEl) gameOverEl.classList.remove('hidden');
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.innerText = Math.floor(state.score);
    }

    // Update Score based on movement
    state.score += 1;
}

function draw() {
    // 1. Clear screen (Always clear the whole canvas first)
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Apply Screen Shake
    ctx.save(); // Save the clean state
    if (state.shakeIntensity > 0) {
        const dx = (Math.random() - 0.5) * state.shakeIntensity;
        const dy = (Math.random() - 0.5) * state.shakeIntensity;
        ctx.translate(dx, dy);
    }

    drawStars();
    drawSun();
    drawMountains();
    drawGrid();
    drawBuildings();
    drawEnemies();
    drawPowerups();
    drawExplosions();
    drawBullets();
    drawEnemyBullets();
    drawCar(state.playerX, canvas.height - 60, state.fireLevel);

    ctx.restore(); // Restore to clean state for the next frame

    requestAnimationFrame(() => {
        update();
        draw();
    });
}

draw(); // Start the game