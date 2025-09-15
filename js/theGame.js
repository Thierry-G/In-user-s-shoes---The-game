import { game, Ui } from './Ui.js';
import Board from './Board.js';
import Levels from './Levels.js';
import Player, { setBoardInstance } from './Player.js';
export const board = new Board();
const player = new Player();
// Set the board instance in Player to avoid circular dependency
setBoardInstance(board);
export class theGame {
    constructor() {
        this.pict = null;
        this.isDragging = false;
        this.playerCol = 0; // left-most grid column for player
        this.playerRow = 0; // target row (within reserved rows)
        // Touch hint pulse state
        this.hintPulseStart = null;
        this.currentTs = 0;
        // Game Over UI: clickable button bounds
        this.playAgainBtn = null;
        // Start Game button bounds
        this.startGameBtn = null;
        // Game state
        this.gameStarted = false;
        // Start screen state
        this.showingStartScreen = true;
        // Button pulse animation
        this.pulseAmount = 0;
        this.pulseDirection = 1;
        // Explosion state before Game Over overlay
        this.exploding = false;
        this.explosionStart = null;
        this.explosionDone = false;
        this.roundExplosion = false; // Track if explosion is for round end vs game over
        this.hidePlayerShoes = false; // Flag to temporarily hide player shoes after explosion
        this.lastTs = 0;
        this.rafId = null;
        // Round start waiting state
        this.waitingForRoundStart = false;
        this.roundStartMessage = '';
        this.roundStartTime = 0;
        this.ignoreInputUntil = 0; // Timestamp to ignore input until
        this.game = new Ui("cnv"); // Instantiate Ui to ensure all properties exist
        this.setupInput();
        this.setupKeyboardInput(); // <-- Add keyboard support
        // Load persisted level if available
        try {
            const savedLevel = Number(localStorage.getItem('theGame.level'));
            if (Number.isFinite(savedLevel) && savedLevel > 0) {
                // We'll seed the board with this later via Levels.get
            }
        }
        catch ( /* noop */_a) { /* noop */ }
        // Place player one row lower (allowing it to enter the bottom reserved area)
        this.playerRow = game.topReserved + game.rows;
        // Center player horizontally (player is 2 tiles wide, so max start is cols-2)
        const maxCol = Math.max(0, game.cols - 2);
        this.playerCol = Math.floor(maxCol / 2);
        this.loadImage();
    }
    loadImage() {
        // Use a relative path to the image instead of an absolute path
        const url = 'img/SpriteShoes.png';
        const img = new Image();
        img.onload = () => {
            console.log("Image loaded successfully:", img.width, "x", img.height);
            // Set the image in player and board
            player.setImage(img);
            board.setImage(img);
            // IMPORTANT: Set the global game.pict AND the instance pict properties
            game.pict = img;
            this.game.pict = img;
            this.pict = url;
            // Place player one row lower (allowing it to enter the bottom reserved area)
            this.playerRow = game.topReserved + game.rows;
            // Init board streams for current grid using a level configuration
            const initialLevel = (() => {
                try {
                    const saved = Number(localStorage.getItem('theGame.level'));
                    return (Number.isFinite(saved) && saved > 0) ? saved : 1;
                }
                catch (_a) {
                    return 1;
                }
            })();
            const level = Levels.get(initialLevel, game.cols);
            board.init(game.cols, game.rows, level);
            // Show the start screen instead of immediately starting the game
            this.showStartScreen();
            this.startMinimalLoop();
        };
        img.onerror = (err) => {
            console.error("Failed to load image", err);
        };
        img.src = url;
        console.log("Loading image from:", url);
    }
    theGame() {
        // Keep method for compatibility; ensure player can move one row lower
        this.playerRow = game.topReserved + game.rows;
    }
    // Public method to force a render (used by fullscreen canvas recalculation)
    render() {
        this.renderFrame();
    }
    renderFrame() {
        const ctx = game.ctx;
        if (!ctx || !game.pict) {
            console.log("Render skipped - context or image not ready");
            return;
        }
        // Clear full canvas
        ctx.clearRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        // Sync player position to board for collision checks
        board.setPlayerPosition(this.playerCol, this.playerRow);
        // Draw falling shoes and HUD
        board.draw();
        // Draw player unless we're playing the explosion
        if (!this.exploding) {
            // Draw player at current column on the last playable row (no extra offset)
            player.renderPlayer(ctx, this.playerCol, this.playerRow, this.hidePlayerShoes);
        }
        else {
            // Explosion overlay at player's location
            this.drawExplosion(ctx);
        }
        // Draw overlays/effects only if not exploding
        if (!this.exploding) {
            // Draw persistent kept overlays (replacements) on top of the player
            board.drawKeptOverlays();
            // Draw transient collision effects above everything
            board.drawEffectsOnTop();
        }
        // Draw touch hint circle centered below the player
        this.drawTouchHint(ctx);
        // Draw score popups on top of everything else
        board.drawScorePopups(ctx);
    }
    drawTouchHint(ctx) {
        const block = game.block;
        const totalRowsAbs = game.topReserved + game.rows + game.bottomReserved;
        const hintRow = Math.min(this.playerRow + 1, totalRowsAbs - 1);
        // Apply centering transform
        ctx.save();
        ctx.translate(game.offsetX, game.offsetY);
        const halfBlock = game.block * 0.5;
        const cx = (this.playerCol * block) + block + halfBlock; // center of 2-tile player with half-block offset
        const cy = (hintRow * block) + (block / 2);
        const baseR = Math.max(12, Math.floor(block * 0.42));
        ctx.beginPath();
        ctx.arc(cx + 0.5, cy + 0.5, baseR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fill();
        ctx.lineWidth = Math.max(2, Math.floor(block * 0.08));
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 0.5, cy + 0.5, Math.max(6, baseR - Math.max(3, Math.floor(block * 0.12))), 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, Math.floor(block * 0.03));
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.stroke();
        if (this.hintPulseStart != null) {
            const t = Math.min(1, Math.max(0, (this.currentTs - this.hintPulseStart) / 500));
            const easeOut = 1 - Math.pow(1 - t, 3);
            const pulseR = baseR * (1 + 0.9 * easeOut);
            const alpha = 0.9 * (1 - t);
            const grad = ctx.createRadialGradient(cx + 0.5, cy + 0.5, Math.max(1, baseR * 0.2), cx + 0.5, cy + 0.5, pulseR);
            grad.addColorStop(0, `rgba(255,255,255,${0.24 * alpha})`);
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy + 0.5, pulseR, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.shadowColor = `rgba(255,255,255,${0.8 * alpha})`;
            ctx.shadowBlur = Math.max(4, Math.floor(block * 0.28));
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy + 0.5, pulseR, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(3, Math.floor(block * 0.14));
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy + 0.5, pulseR + Math.max(2, Math.floor(block * 0.06)), 0, Math.PI * 2);
            ctx.lineWidth = Math.max(2, Math.floor(block * 0.08));
            ctx.strokeStyle = `rgba(18,108,227,${0.6 * alpha})`;
            ctx.stroke();
            if (t >= 1)
                this.hintPulseStart = null;
        }
        ctx.restore();
    }
    // Display the start screen with game instructions and a Start Game button at the bottom
    showStartScreen() {
        const ctx = this.game.ctx;
        if (!ctx || !game.pict)
            return;
        ctx.clearRect(0, 0, this.game.canvas.width, this.game.canvas.height);
        // Responsive sizing - adjusted for better fit
        const W = this.game.canvas.width;
        const H = this.game.canvas.height;
        const padding = Math.max(12, Math.floor(W * 0.025));
        const sectionGap = Math.max(16, Math.floor(H * 0.025));
        const titleFontSize = Math.max(20, Math.min(36, Math.floor(H * 0.06)));
        const headingFontSize = Math.max(14, Math.min(24, Math.floor(H * 0.035)));
        const textFontSize = Math.max(10, Math.min(16, Math.floor(H * 0.025)));
        const lineHeight = Math.floor(textFontSize * 1.4);
        const centerX = W / 2;
        // Title
        ctx.save();
        ctx.font = `bold ${titleFontSize}px 'Press Start 2P', monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#3498db';
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 6;
        ctx.fillText('In User\'s Shoes', centerX, padding + titleFontSize);
        ctx.restore();
        // Instructions area
        let y = padding + titleFontSize + sectionGap;
        ctx.font = `bold ${headingFontSize}px 'Roboto', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f39c12';
        ctx.fillText('Scoring:', centerX, y);
        y += lineHeight + 4;
        ctx.font = `${textFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#fff';
        // Illustrations - smaller and more compact
        const shoeSize = Math.max(24, Math.floor(W * 0.05));
        const img = game.pict;
        // Center illustrations
        let illusX = centerX - shoeSize * 1.1;
        ctx.drawImage(img, 0, 44, 44, 44, illusX, y, shoeSize, shoeSize); // matching
        ctx.drawImage(img, 44, 44, 44, 44, illusX + shoeSize * 1.1, y, shoeSize, shoeSize);
        ctx.fillText('+100 pts: Matching shoes', centerX, y + shoeSize + lineHeight / 2);
        y += shoeSize + lineHeight + 4;
        ctx.drawImage(img, 0, 88, 44, 44, illusX, y, shoeSize, shoeSize); // same type
        ctx.drawImage(img, 44, 0, 44, 44, illusX + shoeSize * 1.1, y, shoeSize, shoeSize);
        ctx.fillText('+50 pts: Same type replacement', centerX, y + shoeSize + lineHeight / 2);
        y += shoeSize + lineHeight + 4;
        ctx.drawImage(img, 0, 132, 44, 44, illusX, y, shoeSize, shoeSize); // different type
        ctx.drawImage(img, 44, 0, 44, 44, illusX + shoeSize * 1.1, y, shoeSize, shoeSize);
        ctx.fillText('-50 pts: Different shoe replacement', centerX, y + shoeSize + lineHeight / 2);
        y += shoeSize + lineHeight + sectionGap;
        ctx.font = `bold ${headingFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#f39c12';
        ctx.fillText('Level Up:', centerX, y);
        y += lineHeight;
        ctx.font = `${textFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText('Score higher to advance levels!', centerX, y);
        y += lineHeight + sectionGap;
        // Game Structure section
        ctx.font = `bold ${headingFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#f39c12';
        ctx.fillText('Game Structure:', centerX, y);
        y += lineHeight;
        ctx.font = `${textFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText('3 rounds per game. Score & level persist!', centerX, y);
        y += lineHeight;
        ctx.fillText('Every 400 pts = Extra round!', centerX, y);
        y += lineHeight + sectionGap;
        ctx.font = `bold ${headingFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#f39c12';
        ctx.fillText('Controls:', centerX, y);
        y += lineHeight;
        ctx.font = `${textFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText('Drag/tap or use arrow keys to move.', centerX, y);
        y += lineHeight + sectionGap;
        // Responsive button at bottom with better spacing
        const btnWidth = Math.min(280, W * 0.7);
        const btnHeight = Math.max(40, Math.floor(H * 0.07));
        const btnX = centerX - btnWidth / 2;
        const btnY = H - btnHeight - padding * 2; // Extra padding from bottom
        this.startGameBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
        const pulseScale = 1 + this.pulseAmount * 0.05;
        const adjustedWidth = btnWidth * pulseScale;
        const adjustedHeight = btnHeight * pulseScale;
        const adjustedX = btnX - (adjustedWidth - btnWidth) / 2;
        const adjustedY = btnY - (adjustedHeight - btnHeight) / 2;
        ctx.save();
        const gradient = ctx.createLinearGradient(adjustedX, adjustedY, adjustedX + adjustedWidth, adjustedY + adjustedHeight);
        gradient.addColorStop(0, '#3498db');
        gradient.addColorStop(1, '#2980b9');
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = gradient;
        ctx.beginPath();
        const radius = Math.max(12, Math.floor(btnHeight * 0.3));
        ctx.moveTo(adjustedX + radius, adjustedY);
        ctx.lineTo(adjustedX + adjustedWidth - radius, adjustedY);
        ctx.arcTo(adjustedX + adjustedWidth, adjustedY, adjustedX + adjustedWidth, adjustedY + radius, radius);
        ctx.lineTo(adjustedX + adjustedWidth, adjustedY + adjustedHeight - radius);
        ctx.arcTo(adjustedX + adjustedWidth, adjustedY + adjustedHeight, adjustedX + adjustedWidth - radius, adjustedY + adjustedHeight, radius);
        ctx.lineTo(adjustedX + radius, adjustedY + adjustedHeight);
        ctx.arcTo(adjustedX, adjustedY + adjustedHeight, adjustedX, adjustedY + adjustedHeight - radius, radius);
        ctx.lineTo(adjustedX, adjustedY + radius);
        ctx.arcTo(adjustedX, adjustedY, adjustedX + radius, adjustedY, radius);
        ctx.closePath();
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(14, Math.min(20, Math.floor(btnHeight * 0.4)))}px 'Press Start 2P', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('START GAME', adjustedX + adjustedWidth / 2, adjustedY + adjustedHeight / 2);
        ctx.restore();
    }
    // Display round start message and wait for user interaction
    showRoundStartMessage() {
        const ctx = game.ctx;
        if (!ctx)
            return;
        const W = this.game.canvas.width;
        const H = this.game.canvas.height;
        // Semi-transparent overlay
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        // Responsive font sizing
        const roundFontSize = Math.max(24, Math.min(64, Math.floor(Math.min(W, H) * 0.08)));
        const instructFontSize = Math.max(12, Math.min(24, Math.floor(Math.min(W, H) * 0.03)));
        // Round message
        ctx.font = `bold ${roundFontSize}px 'Press Start 2P', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFD700'; // Gold color
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(2, Math.floor(roundFontSize * 0.06));
        const centerX = W / 2;
        const centerY = H / 2;
        ctx.strokeText(this.roundStartMessage, centerX, centerY);
        ctx.fillText(this.roundStartMessage, centerX, centerY);
        // Instruction text
        ctx.font = `${instructFontSize}px 'Roboto', sans-serif`;
        ctx.fillStyle = '#FFF';
        const instructY = centerY + Math.max(40, Math.floor(roundFontSize * 0.8));
        ctx.fillText('Click, touch, or move to start!', centerX, instructY);
        ctx.restore();
    }
    // Handle starting the round after user interaction
    startRoundAfterWait() {
        this.waitingForRoundStart = false;
        this.roundStartMessage = '';
        // Allow shoes to be visible again when round starts
        this.hidePlayerShoes = false;
        // Now generate falling shoes for the new round
        const lvl = Levels.get(board.getLevel(), game.cols);
        board.refreshStreams(lvl);
    }
    // Start a minimal game loop that just updates the start screen
    startMinimalLoop() {
        // Cancel any existing loop
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        const startScreenLoop = (timestamp) => {
            this.currentTs = timestamp;
            // Update pulse animation
            this.pulseAmount += 0.05 * this.pulseDirection;
            if (this.pulseAmount >= 1) {
                this.pulseAmount = 1;
                this.pulseDirection = -1;
            }
            else if (this.pulseAmount <= 0) {
                this.pulseAmount = 0;
                this.pulseDirection = 1;
            }
            // Only render the start screen
            this.showStartScreen();
            // Continue the loop if still showing start screen
            if (this.showingStartScreen) {
                this.rafId = requestAnimationFrame(startScreenLoop);
            }
        };
        // Start the loop
        this.rafId = requestAnimationFrame(startScreenLoop);
    }
    startLoop() {
        const step = (ts) => {
            try {
                const dt = this.lastTs ? (ts - this.lastTs) / 1000 : 0;
                this.lastTs = ts;
                this.currentTs = ts;
                // Sync player pos prior to update for accurate collision timing
                board.setPlayerPosition(this.playerCol, this.playerRow);
                // Check if we're waiting for user input to start a round
                if (this.waitingForRoundStart) {
                    // Don't update board, just render the waiting state
                    this.renderFrame();
                    this.showRoundStartMessage();
                    this.rafId = requestAnimationFrame(step);
                    return;
                }
                // If we're in explosion phase, freeze board updates
                if (!this.exploding) {
                    board.update(dt);
                }
                this.renderFrame();
                // Check for round transition first
                if (board.isRoundOver() && !board.isGameOver()) {
                    // Trigger explosion sequence first, then handle round transition
                    if (!this.exploding && !this.explosionDone) {
                        this.exploding = true;
                        this.roundExplosion = true; // Mark as round explosion
                        this.explosionStart = ts;
                        // Clear player's shoes immediately when explosion starts
                        board.clearPlayerShoes();
                        // Hide player shoes temporarily
                        this.hidePlayerShoes = true;
                    }
                    if (this.exploding && this.explosionStart != null) {
                        const elapsed = ts - this.explosionStart;
                        const total = 550; // ms: two frames ~275ms each
                        if (elapsed < total) {
                            this.rafId = requestAnimationFrame(step);
                            return;
                        }
                        // Explosion finished for round transition
                        this.exploding = false;
                        this.explosionDone = true;
                        this.roundExplosion = false;
                        // Redraw once so explosion finish is visible
                        this.renderFrame();
                        // Handle round transition after explosion
                        setTimeout(() => {
                            if (!board.isGameOver()) {
                                this.explosionDone = false; // Reset for next potential explosion
                                // Set up waiting state for round start
                                this.waitingForRoundStart = true;
                                this.roundStartMessage = `ROUND ${board.getCurrentRound()}`;
                                this.roundStartTime = ts;
                                // Clear the board for the new round but don't start yet
                                board.startNextRound(); // This clears the board state
                                // Reset shoe hiding for the new round
                                this.hidePlayerShoes = false;
                                // Continue loop to show round start message
                                this.rafId = requestAnimationFrame(step);
                            }
                        }, 1000); // Shorter delay since we're now waiting for user input
                        return;
                    }
                }
                if (!board.isGameOver()) {
                    this.rafId = requestAnimationFrame(step);
                }
                else {
                    // Trigger explosion sequence first, then show Game Over overlay
                    if (!this.exploding && !this.explosionDone) {
                        this.exploding = true;
                        this.roundExplosion = false; // Mark as game over explosion
                        this.explosionStart = ts;
                        // Clear player's shoes immediately when explosion starts
                        board.clearPlayerShoes();
                        // Hide player shoes temporarily
                        this.hidePlayerShoes = true;
                    }
                    if (this.exploding && this.explosionStart != null) {
                        const elapsed = ts - this.explosionStart;
                        const total = 550; // ms: two frames ~275ms each
                        if (elapsed < total) {
                            this.rafId = requestAnimationFrame(step);
                            return;
                        }
                        // Explosion finished
                        this.exploding = false;
                        this.explosionDone = true;
                        // Stop and reinitialize the falling shoes immediately after explosion
                        const lvl = Levels.get(board.getLevel(), game.cols);
                        board.refreshStreams(lvl);
                        // Redraw once so refreshed board is visible under overlay
                        this.renderFrame();
                    }
                    // Now show overlay and start a game over loop that continuously displays the overlay
                    this.showGameOver();
                    this.startGameOverLoop();
                }
            }
            catch (error) {
                console.error("Game loop error:", error);
                // Continue the game loop even if there was an error
                this.rafId = requestAnimationFrame(step);
            }
        };
        if (this.rafId)
            cancelAnimationFrame(this.rafId);
        this.lastTs = 0;
        this.rafId = requestAnimationFrame(step);
    }
    // Draw explosion using a single atlas sprite centered across both player tiles
    // Phase 1: (sx,sy)=(88,1056); Phase 2: (sx,sy)=(88,100)
    drawExplosion(ctx) {
        var _a;
        const img = game.pict;
        if (!img) {
            console.error("Cannot draw explosion - image not loaded");
            return;
        }
        const block = game.block;
        // Apply centering transform
        ctx.save();
        ctx.translate(game.offsetX, game.offsetY);
        const baseX = this.playerCol * block;
        const baseY = this.playerRow * block;
        // Determine current phase based on elapsed since explosionStart
        const now = this.currentTs;
        const start = (_a = this.explosionStart) !== null && _a !== void 0 ? _a : now;
        const elapsed = now - start;
        const phase = elapsed < 275 ? 0 : 1; // two phases
        const sy = phase === 0 ? 1056 : 100; // source Y per request
        const sx = 88; // single explosion sprite
        // Position explosion exactly on the player component:
        // Player left foot is at: baseX + halfBlock
        // Player right foot is at: baseX + halfBlock + block
        // Center explosion between the two feet
        const halfBlock = block * 0.5;
        const dx = baseX + halfBlock + halfBlock; // Center between left and right foot
        // Use visibleRow for Y position to match player rendering
        const visibleRow = game.topReserved + game.rows - 1;
        const dy = visibleRow * block;
        ctx.drawImage(img, sx, sy, 44, 44, dx, dy, block, block);
        // Restore context
        ctx.restore();
    }
    showGameOver() {
        const ctx = game.ctx;
        if (!ctx)
            return;
        const W = this.game.canvas.width;
        const H = this.game.canvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        // Responsive font sizing based on smaller dimension
        const minDim = Math.min(W, H);
        const titleFontSize = Math.max(18, Math.min(48, Math.floor(minDim * 0.06)));
        const textFontSize = Math.max(12, Math.min(24, Math.floor(minDim * 0.035)));
        const lineSpacing = Math.max(20, Math.floor(minDim * 0.04));
        // Title
        ctx.font = `bold ${titleFontSize}px 'Press Start 2P', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(1, Math.floor(titleFontSize * 0.05));
        const cx = W / 2;
        let cy = Math.max(titleFontSize + 20, H * 0.15); // Adaptive top position
        ctx.strokeText('GAME OVER!', cx, cy);
        ctx.fillText('GAME OVER!', cx, cy);
        // Game statistics
        const currentLevel = board.getLevel();
        const roundScores = board.getRoundScores();
        const totalScore = roundScores.reduce((sum, score) => sum + score, 0);
        const highScore = board.getHighScore();
        const highScoreLevel = board.getHighScoreLevel();
        ctx.font = `${textFontSize}px 'Press Start 2P', monospace`;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        let scoreY = cy + lineSpacing * 2;
        // Current level
        ctx.fillStyle = '#FFD700'; // Gold color
        const levelText = `Level: ${currentLevel}`;
        ctx.strokeText(levelText, cx, scoreY);
        ctx.fillText(levelText, cx, scoreY);
        scoreY += lineSpacing;
        // Current score
        ctx.fillStyle = '#00FF00'; // Green for current score
        const scoreText = `Score: ${totalScore}`;
        ctx.strokeText(scoreText, cx, scoreY);
        ctx.fillText(scoreText, cx, scoreY);
        scoreY += lineSpacing;
        // High score with level - make text shorter if needed
        ctx.fillStyle = '#FF69B4'; // Pink for high score
        const highScoreText = W < 600 ? `High: ${highScore} (L${highScoreLevel})` : `High Score: ${highScore} (Level ${highScoreLevel})`;
        ctx.strokeText(highScoreText, cx, scoreY);
        ctx.fillText(highScoreText, cx, scoreY);
        // Responsive button below scores
        const btnFontSize = Math.max(12, Math.min(20, Math.floor(minDim * 0.03)));
        const btnPaddingX = Math.max(12, Math.floor(W * 0.04));
        const btnPaddingY = Math.max(8, Math.floor(H * 0.02));
        const label = 'Play Again';
        ctx.font = `bold ${btnFontSize}px 'Press Start 2P', monospace`;
        const textW = ctx.measureText(label).width;
        const btnW = Math.min(W * 0.7, textW + btnPaddingX * 2);
        const btnH = btnFontSize + btnPaddingY * 2;
        const btnX = cx - btnW / 2;
        const btnY = Math.min(scoreY + lineSpacing * 2, H - btnH - 20);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(1, Math.floor(btnFontSize * 0.1));
        ctx.beginPath();
        ctx.rect(btnX, btnY, btnW, btnH);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, btnY + btnH / 2);
        this.playAgainBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
        ctx.restore();
    }
    /**
     * Start a continuous loop to keep displaying the game over screen
     * This prevents flickering by ensuring the overlay is continuously rendered
     */
    startGameOverLoop() {
        // Cancel any existing animation frame
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        const gameOverLoop = (timestamp) => {
            // Update current time
            this.currentTs = timestamp;
            // Redraw the game state
            this.renderFrame();
            // Draw the game over overlay
            this.showGameOver();
            // Continue the loop
            this.rafId = requestAnimationFrame(gameOverLoop);
        };
        // Start the game over loop
        this.rafId = requestAnimationFrame(gameOverLoop);
    }
    // Click/touch handlers for various game states
    setupInput() {
        const touchHandler = (ev) => {
            // Don't process input during animations
            if (this.exploding)
                return;
            // Don't process input if we're ignoring it temporarily
            if (performance.now() < this.ignoreInputUntil)
                return;
            // Check if we're waiting for round start
            if (this.waitingForRoundStart) {
                // Any user interaction starts the round
                this.startRoundAfterWait();
                ev.preventDefault();
                return;
            }
            // Check if the start screen is showing - handle Start Game button click
            if (this.showingStartScreen && this.startGameBtn) {
                const btn = this.startGameBtn;
                let x = 0, y = 0;
                if (ev instanceof MouseEvent) {
                    x = ev.clientX;
                    y = ev.clientY;
                }
                else {
                    const touch = ev.touches[0];
                    if (!touch)
                        return;
                    x = touch.clientX;
                    y = touch.clientY;
                }
                // Convert to canvas coordinates
                const rect = this.game.canvas.getBoundingClientRect();
                const scale = this.game.canvas.width / rect.width; // Handle scaling in fullscreen
                x = (x - rect.left) * scale;
                y = (y - rect.top) * scale;
                // Check if the click/tap is on the Start Game button
                if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    // Start the game
                    this.resetGame();
                    ev.preventDefault();
                    return;
                }
                return;
            }
            if (board.isGameOver()) {
                // Check if Play Again button was clicked
                const btn = this.playAgainBtn;
                if (!btn)
                    return;
                let x = 0, y = 0;
                if (ev instanceof MouseEvent) {
                    x = ev.clientX;
                    y = ev.clientY;
                }
                else {
                    const touch = ev.touches[0];
                    if (!touch)
                        return;
                    x = touch.clientX;
                    y = touch.clientY;
                }
                // Convert to canvas coordinates
                const rect = this.game.canvas.getBoundingClientRect();
                const scale = this.game.canvas.width / rect.width; // Handle scaling in fullscreen
                x = (x - rect.left) * scale;
                y = (y - rect.top) * scale;
                if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    this.resetGame();
                }
                return;
            }
            // Normal gameplay: track drag state
            if (ev.type === 'mousedown' || ev.type === 'touchstart') {
                this.isDragging = true;
                this.hintPulseStart = this.currentTs; // Start the hint pulse animation
                this.updatePlayerPosition(ev);
            }
            else if (ev.type === 'mousemove' || ev.type === 'touchmove') {
                if (!this.isDragging)
                    return;
                this.updatePlayerPosition(ev);
            }
            else if (ev.type === 'mouseup' || ev.type === 'touchend') {
                this.isDragging = false;
            }
        };
        // Mouse events
        this.game.canvas.addEventListener('mousedown', touchHandler);
        this.game.canvas.addEventListener('mousemove', touchHandler);
        this.game.canvas.addEventListener('mouseup', touchHandler);
        // Touch events
        this.game.canvas.addEventListener('touchstart', touchHandler);
        this.game.canvas.addEventListener('touchmove', touchHandler);
        this.game.canvas.addEventListener('touchend', touchHandler);
    }
    setupKeyboardInput() {
        window.addEventListener('keydown', (ev) => {
            if (this.showingStartScreen || board.isGameOver())
                return;
            // Don't process input if we're ignoring it temporarily
            if (performance.now() < this.ignoreInputUntil)
                return;
            // Check if we're waiting for round start
            if (this.waitingForRoundStart) {
                // Any key press starts the round
                this.startRoundAfterWait();
                ev.preventDefault();
                return;
            }
            if (ev.key === 'ArrowLeft') {
                this.playerCol = Math.max(-1, this.playerCol - 1);
                this.hintPulseStart = performance.now();
            }
            else if (ev.key === 'ArrowRight') {
                this.playerCol = Math.min(game.cols - 1, this.playerCol + 1);
                this.hintPulseStart = performance.now();
            }
        });
    }
    updatePlayerPosition(ev) {
        // Get touch/click position
        let x = 0;
        if (ev instanceof MouseEvent) {
            x = ev.clientX;
        }
        else {
            const touch = ev.touches[0];
            if (!touch)
                return;
            x = touch.clientX;
            ev.preventDefault(); // Prevent scrolling on touch
        }
        // Convert to canvas coordinates - handle fullscreen properly
        const rect = this.game.canvas.getBoundingClientRect();
        const scale = this.game.canvas.width / rect.width; // Handle scaling in fullscreen
        x = (x - rect.left) * scale;
        // For mobile edge detection, check if touch is in the leftmost or rightmost 15% of canvas
        const canvasWidth = this.game.canvas.width;
        const leftEdgeThreshold = canvasWidth * 0.15;
        const rightEdgeThreshold = canvasWidth * 0.85;
        const rawX = x; // Store original x before offset adjustment
        x -= game.offsetX;
        // Convert to grid column (0-based)
        // Account for the half-block offset that's used throughout the rendering system
        const halfBlock = game.block * 0.5;
        const adjustedX = x + halfBlock; // Add back the half-block offset for proper grid alignment
        let col = Math.floor(adjustedX / game.block);
        // Mobile-friendly edge detection using raw canvas coordinates
        if (rawX < leftEdgeThreshold) {
            col = -1;
            console.log(`LEFT EDGE: Touch at ${rawX} pixels, setting player to position -1 (left foot hidden)`);
        }
        else if (rawX > rightEdgeThreshold) {
            col = game.cols - 1;
            console.log(`RIGHT EDGE: Touch at ${rawX} pixels, setting player to position ${game.cols - 1} (right foot hidden)`);
        }
        // Allow player to be partially off-screen (-1 to cols-1 range)
        // This ensures that when the player is at the left edge, the right shoe remains visible,
        // and when at the right edge, the left shoe remains visible
        const maxCol = game.cols - 1;
        const finalCol = Math.max(-1, Math.min(maxCol, col));
        if (finalCol !== this.playerCol) {
            console.log(`Player position change: ${this.playerCol} -> ${finalCol}`);
        }
        this.playerCol = finalCol;
    }
    resetGame() {
        // Reset game state
        this.exploding = false;
        this.explosionDone = false;
        this.explosionStart = null;
        this.roundExplosion = false;
        this.hidePlayerShoes = false;
        this.playAgainBtn = null;
        this.gameStarted = true;
        // Place player at the bottom of the grid
        this.playerRow = game.topReserved + game.rows;
        // Hide the start screen
        this.showingStartScreen = false;
        // Reset the score and level to starting values
        board.init(game.cols, game.rows, Levels.get(1, game.cols));
        // Set ignore input flag to prevent immediate triggering from the START GAME click
        this.ignoreInputUntil = performance.now() + 700; // Ignore input for 700ms
        // Set up waiting state for Round 1 with a delay
        setTimeout(() => {
            this.waitingForRoundStart = true;
            this.roundStartMessage = 'ROUND 1';
            this.roundStartTime = performance.now();
        }, 500); // Delay to ensure clean transition
        // Start with fresh game loop (but waiting for user input)
        this.startLoop();
    }
}
// Initialize game when the script loads
window.addEventListener('load', () => {
    const gameInstance = new theGame();
    // Expose instance globally for fullscreen canvas recalculation
    window.theGameInstance = gameInstance;
});
//# sourceMappingURL=theGame.js.map