import { game } from './Ui.js';
import Shoes, { ShoeSide } from './Shoes.js';
import Levels from './Levels.js';
import type { LevelConfig } from './Levels.js';
import { BoardInterface } from './Player.js';

type FallingShoe = {
    col: number;
    y: number;       // fractional row position
    speed: number;   // rows per second
    side: ShoeSide;  // 'left' | 'right'
    yIndex: number;  // 0..22 sprite row index
    id: string;      // identifier based on side and yIndex (e.g., 'left-12')
    value: number;   // numeric value for scoring/logic
};

// Type for animated score popups
type ScorePopup = {
    text: string;     // Text to display (e.g., "+100")
    col: number;      // Column position
    row: number;      // Row position (absolute)
    startTime: number; // When the animation started (timestamp)
    duration: number; // How long to show in ms (typically 700ms)
    color: string;    // Text color
    fontSize?: number; // Optional size multiplier
};

export default class Board implements BoardInterface {
    private shoesHelper = new Shoes();
    private cols = 0;
    private rows = 0; // playable rows (excludes reserved bottom rows)
    private streams: FallingShoe[] = [];
    // pairCount removed: no longer used in HUD
    private playerCol = 0; // left tile col of player
    private playerRow = 0; // absolute grid row where player sits (including topReserved)
    private score = 0;
    private level = 1;
    private highScore = 0;
    private highScoreLevel = 1;
    private currentRound = 1;
    private matchValidationTime = 0; // Timer for validating matches
    private pendingMatch = false; // Whether we have a pending match to validate
    private totalRounds = 3;
    private baseRounds = 3; // Base number of rounds
    private extraRounds = 0; // Extra rounds earned through scoring
    private roundScores: number[] = []; // Track score for each round
    private lastExtraRoundThreshold = 0; // Track the last score threshold where we awarded an extra round
    // messages removed (legacy)
    private rightColumnText: Array<string | undefined> = [];
    private nextLevelAt = 100;
    private lastScoreRow: number | null = null;
    private scorePopups: ScorePopup[] = []; // Track animated score popups
    private currentTime: number = 0; // Track current time for animations
    private effects: { col: number; rowAbs: number; yIndex: number; spriteX: number }[] = [];
    // Track whether each foot has already collected a value; null means empty/default
    private leftFootValue: number | null = null;
    private rightFootValue: number | null = null;
    private gameOver = false;
    private roundOver = false;
    // Pairing bias state
    private recentLeftY: number[] = [];
    private recentRightY: number[] = [];
    private readonly RECENT_MAX = 8;
    private pairBias = 0.6; // 60% chance to reuse an opposite-side recent yIndex

    constructor() { }

    setImage(img: HTMLImageElement) {
        this.shoesHelper.setImage(img);
    }

    // Build an ID that reflects the shoe's current board row and side (e.g., 'left-7')
    private makeShoeId(side: ShoeSide, row: number): string {
        return `${side}-${row | 0}`;
    }

    init(cols: number, rows: number, level?: LevelConfig) {
        this.cols = cols;
        this.rows = rows;
        // Reset core state
        this.score = 0;
        this.level = 1;
        this.currentRound = 1;
        this.totalRounds = this.baseRounds; // Reset to base rounds
        this.extraRounds = 0; // Reset extra rounds
        this.lastExtraRoundThreshold = 0; // Reset threshold tracking
        this.roundScores = [];
        this.streams = []; // Start with an empty board - no shoes
        this.recentLeftY = [];
        this.recentRightY = [];
        this.rightColumnText = new Array(this.getTotalRowsAbsolute());
        this.nextLevelAt = 100; // First level up at 100 points
        this.lastScoreRow = null;
        this.effects = [];
        
        // Load high score from localStorage
        try {
            const savedHighScore = Number(localStorage.getItem('theGame.highScore'));
            const savedHighScoreLevel = Number(localStorage.getItem('theGame.highScoreLevel'));
            if (Number.isFinite(savedHighScore) && savedHighScore >= 0) {
                this.highScore = savedHighScore;
            }
            if (Number.isFinite(savedHighScoreLevel) && savedHighScoreLevel >= 1) {
                this.highScoreLevel = savedHighScoreLevel;
            }
        } catch { /* noop */ }
        
        // Clear foot values
        this.leftFootValue = null;
        this.rightFootValue = null;
        
        this.gameOver = false;
        this.roundOver = false;
        // Persist level reset
        try { localStorage.setItem('theGame.level', String(this.level)); } catch { /* noop */ }
        
        // We'll add the initial shoes with a delay in theGame.ts instead of here
    }
    
    // Find an available column that doesn't have overlapping shoes
    private findAvailableColumn(excludeNearTop: boolean = true): number {
        const cols = this.cols;
        const availableColumns: number[] = [];
        
        for (let col = 0; col < cols; col++) {
            let hasConflict = false;
            
            // Check if this column has shoes that would cause overlap
            for (const shoe of this.streams) {
                if (shoe.col === col) {
                    // If excludeNearTop is true, avoid columns with shoes in the top area
                    if (excludeNearTop && shoe.y < 3) {
                        hasConflict = true;
                        break;
                    }
                    // Always avoid columns with shoes very close to spawn area
                    if (shoe.y < 1) {
                        hasConflict = true;
                        break;
                    }
                }
            }
            
            if (!hasConflict) {
                availableColumns.push(col);
            }
        }
        
        // If we have available columns, pick one randomly
        if (availableColumns.length > 0) {
            return availableColumns[Math.floor(Math.random() * availableColumns.length)];
        }
        
        // Fallback: if all columns are occupied, find the one with the lowest shoe
        let bestCol = 0;
        let lowestY = Infinity;
        
        for (let col = 0; col < cols; col++) {
            let highestShoeY = -Infinity;
            let hasShoe = false;
            
            for (const shoe of this.streams) {
                if (shoe.col === col) {
                    hasShoe = true;
                    highestShoeY = Math.max(highestShoeY, shoe.y);
                }
            }
            
            if (!hasShoe) {
                return col; // Empty column is best
            }
            
            if (highestShoeY < lowestY) {
                lowestY = highestShoeY;
                bestCol = col;
            }
        }
        
        return bestCol;
    }

    // Rebuild only the falling shoe streams without touching score/level or messages
    refreshStreams(level?: LevelConfig) {
        const cols = this.cols;
        const rows = this.rows;
        this.streams = [];
        this.recentLeftY = [];
        this.recentRightY = [];
        const total = level?.totalShoes ?? cols;
        const spMin = level?.speedMin ?? 0.6;
        const spMax = level?.speedMax ?? 1.8;
        for (let i = 0; i < total; i++) {
            const c = this.findAvailableColumn(false); // Allow any column during initial setup
            const side: ShoeSide = Math.random() < 0.5 ? 'left' : 'right';
            const yIndex = this.chooseYIndex(side);
            // Start above the visible area so new shoes fall in naturally
            // Space them out more during initial setup
            const initialY = -Math.random() * Math.max(2, rows) - i * 0.5;
            this.streams.push({
                col: c,
                y: initialY,
                speed: spMin + Math.random() * Math.max(0.01, spMax - spMin),
                side,
                yIndex,
                id: this.makeShoeId(side, Math.floor(initialY)),
                value: yIndex
            });
            this.pushRecent(side, yIndex);
        }
    }
    
    /**
     * Alias for refreshStreams for compatibility
     * @param level Optional level configuration
     */
    reset(level?: LevelConfig) {
        this.refreshStreams(level);
    }

    setPlayerPosition(col: number, rowAbsolute: number) {
        // Ensure the player's left shoe doesn't go off the right side of the canvas
        // and the right shoe doesn't go off the left side of the canvas
        
        // The player occupies two columns (left shoe and right shoe)
        // Left shoe position (col) must be less than the max column index
        // Right shoe position (col+1) must be at least 0
        
        // For the left shoe not to go off the right side:
        // col must be <= cols-1
        const maxLeftCol = this.cols - 1;
        
        // For the right shoe not to go off the left side:
        // col+1 must be >= 0, so col must be >= -1
        const minLeftCol = -1;
        
        // Apply constraints to keep both shoes visible
        const boundedCol = Math.min(maxLeftCol, Math.max(minLeftCol, col));
        
        // Set the constrained position
        this.playerCol = boundedCol;
        this.playerRow = rowAbsolute;
    }

    getScore() { return this.score; }
    getLevel() { return this.level; }
    isGameOver() { return this.gameOver; }
    isRoundOver() { return this.roundOver; }
    getCurrentRound() { return this.currentRound; }
    getTotalRounds() { return this.totalRounds; }
    getExtraRounds() { return this.extraRounds; }
    getBaseRounds() { return this.baseRounds; }
    getRoundScores() { return [...this.roundScores]; } // Return copy

    setGameCount(n: number) { /* Legacy method - no longer used */ }
    getGameCount() { return 0; } // Legacy method - always return 0
    
    // High score methods
    getHighScore() { return this.highScore; }
    getHighScoreLevel() { return this.highScoreLevel; }
    
    // Round management
    endCurrentRound() {
        // Save current round score
        this.roundScores.push(this.score);
        
        // Clear foot values and effects
        this.leftFootValue = null;
        this.rightFootValue = null;
        this.effects = [];
        
        if (this.currentRound < this.totalRounds) {
            // Move to next round
            this.currentRound++;
            this.roundOver = true;
            
            // Round transition is handled by theGame.ts, no popup needed here
        } else {
            // All rounds completed - end game
            this.gameOver = true;
            // Check and update high score
            const totalScore = this.roundScores.reduce((sum, score) => sum + score, 0) + this.score;
            if (totalScore > this.highScore) {
                this.highScore = totalScore;
                this.highScoreLevel = this.level;
                // Save high score to localStorage
                try {
                    localStorage.setItem('theGame.highScore', String(this.highScore));
                    localStorage.setItem('theGame.highScoreLevel', String(this.highScoreLevel));
                } catch { /* noop */ }
            }
        }
    }
    
    // Start next round (called after round transition)
    startNextRound() {
        this.roundOver = false;
        // Do NOT reset score - it should accumulate across rounds
        // Do NOT reset level - it should persist across rounds
        this.streams = []; // Clear all falling shoes
        this.recentLeftY = [];
        this.recentRightY = [];
    }
    
    // Implement BoardInterface methods
    getLeftFootValue(): number | null {
        return this.leftFootValue;
    }
    
    getRightFootValue(): number | null {
        return this.rightFootValue;
    }

    // Clear player's shoes (used when explosion starts)
    clearPlayerShoes() {
        this.leftFootValue = null;
        this.rightFootValue = null;
    }

    update(dt: number, timestamp?: number) {
        if (this.gameOver) return;
        
        // Update current time for animations (still needed for other features)
        if (timestamp) {
            this.currentTime = timestamp;
        } else {
            this.currentTime += dt * 1000; // Convert dt (in seconds) to milliseconds
        }
        
        // Remove expired score popups - using Date.now() for compatibility
        this.scorePopups = this.scorePopups.filter(popup => 
            Date.now() - popup.startTime < popup.duration);
        
        // Move shoes first
        for (const s of this.streams) {
            s.y += s.speed * dt;
            // Refresh ID based on the current visible row
            s.id = this.makeShoeId(s.side, Math.floor(s.y));
        }
        // Check for collisions when shoes are at the last playable row
        this.checkCollisions();
        // Check for collisions between left and right shoes
        this.checkShoeToShoeCollisions();
        
        // Validate pending matches after a short delay (500ms)
        if (this.pendingMatch && performance.now() - this.matchValidationTime > 500) {
            if (this.leftFootValue != null && this.rightFootValue != null && 
                this.leftFootValue === this.rightFootValue) {
                // Still a valid match after delay - award points
                const centerCol = this.playerCol + 1; // +1 for center position (between two feet)
                this.addScore(100, centerCol, this.playerRow);
                this.leftFootValue = null;
                this.rightFootValue = null;
            }
            this.pendingMatch = false;
        }
        
        // Check for level up
        while (this.score >= this.nextLevelAt) {
            this.levelUp();
        }
        
        // Recycle any shoes that have moved past the board (after allowing a collision frame at last row)
        for (const s of this.streams) {
            if (Math.floor(s.y) >= this.rows) {
                this.recycleShoe(s);
            }
        }
    }

    // Check for collisions between left and right shoes
    private checkShoeToShoeCollisions() {
        const leftShoes = this.streams.filter(s => s.side === 'left');
        const rightShoes = this.streams.filter(s => s.side === 'right');
        const shoesToRemove = [];
        
        for (const leftShoe of leftShoes) {
            const leftRow = Math.floor(leftShoe.y);
            const leftCol = leftShoe.col;
            
            for (const rightShoe of rightShoes) {
                const rightRow = Math.floor(rightShoe.y);
                const rightCol = rightShoe.col;
                
                // Check if they're on the same row and adjacent columns
                if (leftRow === rightRow && leftCol + 1 === rightCol) {
                    // If they have the same yIndex (shoe style), it's a match
                    if (leftShoe.yIndex === rightShoe.yIndex) {
                        shoesToRemove.push(leftShoe);
                        shoesToRemove.push(rightShoe);
                        
                        // Mark the absolute row positions
                        const leftRowAbs = leftRow + game.topReserved;
                        const rightRowAbs = rightRow + game.topReserved;
                        
                        // Add visual effects for both shoes
                        this.effects.push({ 
                            col: leftCol, 
                            rowAbs: leftRowAbs, 
                            yIndex: leftShoe.yIndex, 
                            spriteX: 0 
                        });
                        this.effects.push({ 
                            col: rightCol, 
                            rowAbs: rightRowAbs, 
                            yIndex: rightShoe.yIndex, 
                            spriteX: 44 
                        });
                        
                        // Award points when shoes match
                        // Add score popup at the center between the two matching shoes
                        const scoreX = leftCol + 0.5; // Center between the two columns
                        const scoreY = leftRow + game.topReserved;
                        this.addScore(50, scoreX, scoreY);
                    }
                }
            }
        }
        
        // Remove matched shoes
        for (const shoe of shoesToRemove) {
            this.recycleShoe(shoe);
        }
    }

    // Level up logic separated into its own method
    private levelUp() {
        this.level++;
        
        // Update score threshold for next level (progressively higher but reasonable)
        // Level 1->2: 100, Level 2->3: 250, Level 3->4: 450, etc.
        const nextLevelGap = 100 + (this.level - 1) * 150;
        this.nextLevelAt = this.score + nextLevelGap;
        
        // Show level up message
        this.showLevelUpPopup();
        
        // Apply level-specific configuration
        const levelConfig = Levels.get(this.level, this.cols);
        
        // Rebuild streams with new level properties
        this.refreshStreams(levelConfig);
        
        // Persist level
        try { localStorage.setItem('theGame.level', String(this.level)); } catch { /* noop */ }
    }


    // Method called from theGame.ts
    render(ctx: CanvasRenderingContext2D) {
        this.draw();
    }
    
    // Method for rendering explosion animation
    renderExplosion(ctx: CanvasRenderingContext2D, explosionTime: number): boolean {
        // Clear the canvas first to ensure a clean background
        if (game.ctx) {
            game.ctx.clearRect(0, 0, game.width, game.height);
        }
        
        // Draw the board WITHOUT player (just the falling shoes)
        this.drawWithoutPlayer();
        
        // Apply centering transform
        ctx.save();
        ctx.translate(game.offsetX, game.offsetY);
        
        // Total animation time: 3 seconds (3000ms)
        const explosionDuration = 3000;
        const progress = Math.min(1.0, explosionTime / explosionDuration);
        
        // Create a less intense, more transparent flash at the player position
        const flashOpacity = Math.max(0, 0.6 - progress * 1.2); // Lower max opacity and fade out faster
        if (flashOpacity > 0) {
            ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
            // Use a smaller area for the flash effect to avoid covering too much of the background
            ctx.fillRect(
                this.playerCol * game.block, 
                this.playerRow * game.block,
                game.block * 2,  // Just cover the player width
                game.block       // Just cover the player height
            );
        }
        
        // Use sprite-based explosion animation
        if (game.pict) {
            // Similar to UIEffects.drawExplosion but adapted for the board context
            const block = game.block;
            const baseX = this.playerCol * block;
            const baseY = this.playerRow * block;

            // Set composite operation to ensure transparency
            ctx.globalCompositeOperation = 'source-over';
            
            // Determine animation phase based on elapsed time
            // Create a multi-phase animation with 6 frames
            const phaseCount = 6;
            const frameDuration = explosionDuration / phaseCount;
            const phase = Math.min(phaseCount - 1, Math.floor(explosionTime / frameDuration));
            
            // Source coordinates from sprite sheet based on the correct coordinates:
            // X0: 0 y0: 1056
            // x1: 44 y1: 1056
            // x2: 132 y2: 1056
            // x3: 0 y3: 1100
            // x4: 44 y4: 1100
            // x5: 132 y5: 1100
            let sx, sy;
            
            if (phase < 3) {
                // First row of explosion sprites (y = 1056)
                sy = 1056;
                if (phase === 0) sx = 0;
                else if (phase === 1) sx = 44;
                else sx = 132; // phase === 2
            } else {
                // Second row of explosion sprites (y = 1100)
                sy = 1100;
                if (phase === 3) sx = 0;
                else if (phase === 4) sx = 44;
                else sx = 132; // phase === 5
            }
            
            // Draw the explosion centered on the player (covers both feet)
            // Scale the explosion to be larger as the animation progresses
            const scale = 1.0 + phase * 0.2; // Gradually increase size
            const scaledSize = block * scale;
            
            // Center the explosion on the player
            const dx = baseX + block * 0.5;
            const dy = baseY;
            
            // Make sure we're not changing the transparency of the sprite itself
            ctx.globalAlpha = 1.0;
            
            // Use 'source-over' to ensure transparent parts of the sprite stay transparent
            ctx.globalCompositeOperation = 'source-over';
            
            // Draw explosion sprite with proper scaling
            ctx.drawImage(
                game.pict, 
                sx, sy, 44, 44, // Source coordinates (sprite sheet)
                dx, dy, scaledSize, scaledSize // Destination with scaling
            );
        }
        
        ctx.restore();
        
        // Return true when animation is complete
        return progress >= 1.0;
    }

    // Draw the game board without the player - used for explosion animation
    drawWithoutPlayer() {
        const ctx = game.ctx;
        if (!ctx) return;
        
        // Clear canvas first with the darker gray margin color
        ctx.fillStyle = '#e0e0e0'; // Darker gray for margins
        ctx.fillRect(0, 0, game.width, game.height);
        
        // Apply centering transform
        ctx.save();
        ctx.translate(game.offsetX, game.offsetY);
        
        // Draw the board background to visualize the game area
        // Leave first and last half columns with body background
        ctx.fillStyle = 'rgb(247,247,247)'; // Light gray background for the board
        const boardWidth = (game.cols + 1) * game.block;
        const boardHeight = (game.topReserved + game.rows + game.bottomReserved) * game.block;
        const halfBlock = game.block * 0.5;
        
        // Draw white background excluding first and last half columns
        ctx.fillRect(halfBlock, 0, boardWidth - game.block, boardHeight);
        
        // Draw the last row with player component background color
        const lastVisibleRow = game.topReserved + game.rows - 1;
        ctx.fillStyle = 'rgb(235,235,235)'; // Same color as player component
        ctx.fillRect(halfBlock, lastVisibleRow * game.block, boardWidth - game.block, game.block);
        
        // Draw the circle row (below player) with same background color
        const circleRow = Math.min(this.playerRow + 1, game.topReserved + game.rows + game.bottomReserved - 1);
        ctx.fillStyle = 'rgb(235,235,235)'; // Same color as player component
        ctx.fillRect(halfBlock, circleRow * game.block, boardWidth - game.block, game.block);
        
        // Draw all falling shoes
        for (const s of this.streams) {
            const r = Math.floor(s.y);
            if (r >= 0 && r < this.rows) {
                // draw offset by top reserved rows
                this.shoesHelper.drawAtGrid(s.side, s.yIndex, s.col, r + game.topReserved);
            }
        }
        
        // Draw HUD
        this.drawHUD(ctx);
        
        // Score popups are now drawn in theGame.ts for proper layering
        
        // Restore context
        ctx.restore();
    }

    // Draw responsive HUD with proper spacing
    private drawHUD(ctx: CanvasRenderingContext2D) {
        const halfBlock = game.block * 0.5;
        
        // HUD in top reserved rows (Score/Level)
        ctx.fillStyle = '#000'; // Change text color to black for visibility
        const baseFontSize = Math.max(12, Math.min(18, Math.floor(game.block * 0.4))); // Responsive font size
        ctx.font = `${baseFontSize}px 'Press Start 2P', monospace`;
        ctx.textBaseline = 'middle';

        // Persistent HUD in top reserved rows
        const hudPadding = Math.max(8, Math.floor(game.block * 0.2));
        const labelX = hudPadding + 1.5 * halfBlock; // Position for labels
        
        // Measure the longest label to ensure proper spacing
        ctx.textAlign = 'left';
        const scoreWidth = ctx.measureText('Score:').width;
        const roundWidth = ctx.measureText('Round:').width;
        const levelWidth = ctx.measureText('Level:').width;
        const maxLabelWidth = Math.max(scoreWidth, roundWidth, levelWidth);
        
        const valueX = labelX + maxLabelWidth + Math.max(15, baseFontSize * 0.8); // Add proper gap after labels
        const lineHeight = Math.max(game.block * 0.8, baseFontSize + 4); // Responsive line height
        const scoreY = (0 + 0.5) * game.block; // First row
        const levelY = scoreY + lineHeight; // Second row with proper spacing
        const gameY = levelY + lineHeight; // Third row with proper spacing

        // Draw labels left-aligned at fixed position for perfect alignment
        ctx.fillText('Score:', labelX, scoreY);
        ctx.fillText('Round:', labelX, levelY);
        ctx.fillText('Level:', labelX, gameY); // Changed from Game to Level
        
        // Draw values left-aligned
        ctx.fillText(`${this.score}`, valueX, scoreY);
        
        // Show round info with extra rounds if any
        let roundText = `${this.currentRound}/${this.totalRounds}`;
        if (this.extraRounds > 0) {
            roundText += ` (+${this.extraRounds})`;
        }
        ctx.fillText(roundText, valueX, levelY);
        
        ctx.fillText(`${this.level}`, valueX, gameY); // Show current level

        // Reset text alignment to default
        ctx.textAlign = 'start';

        // Draw right column texts down the full height on the reserved right column
        const rightColX = (game.cols) * game.block; // reserved right column X
        for (let rAbs = 0; rAbs < this.rightColumnText.length; rAbs++) {
            const msg = this.rightColumnText[rAbs];
            if (!msg) continue;
            ctx.fillText(msg, rightColX + 6, (rAbs + 0.5) * game.block);
        }
    }

    draw() {
        const ctx = game.ctx;
        if (!ctx) return;
        
        // Draw the darker gray margin background
        ctx.fillStyle = '#e0e0e0'; // Darker gray for margins
        ctx.fillRect(0, 0, game.width, game.height);
        
        // Apply centering transform
        ctx.save();
        ctx.translate(game.offsetX, game.offsetY);
        
        // Draw the board background to visualize the game area
        // Leave first and last half columns with body background
        ctx.fillStyle = 'rgb(247,247,247)'; // Light gray background for the board
        const boardWidth = (game.cols + 1) * game.block;
        const boardHeight = (game.topReserved + game.rows + game.bottomReserved) * game.block;
        const halfBlock = game.block * 0.5;
        
        // Draw white background excluding first and last half columns
        ctx.fillRect(halfBlock, 0, boardWidth - game.block, boardHeight);
        
        // Draw the last row with player component background color
        const lastVisibleRow = game.topReserved + game.rows - 1;
        ctx.fillStyle = 'rgb(235,235,235)'; // Same color as player component
        ctx.fillRect(halfBlock, lastVisibleRow * game.block, boardWidth - game.block, game.block);
        
        // Draw the circle row (below player) with same background color
        const circleRow = Math.min(this.playerRow + 1, game.topReserved + game.rows + game.bottomReserved - 1);
        ctx.fillStyle = 'rgb(235,235,235)'; // Same color as player component
        ctx.fillRect(halfBlock, circleRow * game.block, boardWidth - game.block, game.block);
        
        // Draw all falling shoes
        for (const s of this.streams) {
            const r = Math.floor(s.y);
            if (r >= 0 && r < this.rows) {
                // draw offset by top reserved rows
                this.shoesHelper.drawAtGrid(s.side, s.yIndex, s.col, r + game.topReserved);
            }
        }
        
        // Draw HUD
        this.drawHUD(ctx);
        
        // Score popups are now drawn in theGame.ts for proper layering
        
        // Restore context
        ctx.restore();
    }

    // Draw transient effects on top of the player and other elements, then clear them
    drawEffectsOnTop() {
        const ctx = game.ctx;
        if (!ctx) return;
        
        // Apply centering transform
        ctx.save();
        ctx.translate(game.offsetX, game.offsetY);
        
        for (const e of this.effects) {
            // Clean the rect where the shoe touched before drawing the overlay
            const dx = e.col * game.block;
            const dy = e.rowAbs * game.block;
            ctx.clearRect(dx, dy, game.block, game.block);
            this.shoesHelper.drawAtGridSpriteX(e.spriteX, e.yIndex, e.col, e.rowAbs);
        }
        this.effects = [];
        
        // Restore context
        ctx.restore();
    }

    // Draw persistent kept overlays on the player's feet using stored foot values
    drawKeptOverlays() {
        // This method is now empty because the Player component 
        // already draws the player with the correct foot values.
        // Keeping the method for compatibility with existing code.
    }

    // Detect when a falling shoe reaches the player's row and correct side alignment
    private checkCollisions() {
        // Player occupies columns [playerCol, playerCol+1] on row playerRow
        const leftCol = this.playerCol;
        const rightCol = this.playerCol + 1;
        // Convert absolute player row to board-local and clamp to last playable row
        let targetRowVisible = this.playerRow - game.topReserved;
        if (!Number.isFinite(targetRowVisible)) return;
        if (targetRowVisible < 0) targetRowVisible = 0;
        if (targetRowVisible >= this.rows) targetRowVisible = this.rows - 1;

        // First find candidates at the player's row for both feet
        let leftHit: FallingShoe | undefined;
        let rightHit: FallingShoe | undefined;
        
        for (const s of this.streams) {
            const r = Math.floor(s.y);
            if (r !== targetRowVisible) continue;
            
            // Check for correct side hits
            if (s.col === leftCol && s.side === 'left') leftHit = s;
            else if (s.col === rightCol && s.side === 'right') rightHit = s;
        }

        // Track shoes to recycle after all collision logic is complete
        const shoesToRecycle: FallingShoe[] = [];

        // Show visual change at contact positions per-foot and set foot values
        // Left foot: always display replacement sprite with sx=0 on touch
        if (leftHit) {
            const spriteX = 0;
            this.effects.push({ col: leftHit.col, rowAbs: targetRowVisible + game.topReserved, yIndex: leftHit.yIndex, spriteX });
            // Score for changing shoes
            if (this.leftFootValue !== null) {
                // Player already had a shoe, check if same type
                if (this.leftFootValue === leftHit.yIndex) {
                    // Same shoe type, +50 points
                    this.addScore(50, leftCol, this.playerRow);
                } else {
                    // Different shoe type, -50 points
                    this.score = Math.max(0, this.score - 50); // Prevent negative score
                    this.addScorePopup(-50, leftCol, this.playerRow);
                }
            }
            this.leftFootValue = leftHit.yIndex;
            shoesToRecycle.push(leftHit);
        }
        // Right foot: always display replacement sprite with sx=44 on touch
        if (rightHit) {
            const spriteX = 44;
            this.effects.push({ col: rightHit.col, rowAbs: targetRowVisible + game.topReserved, yIndex: rightHit.yIndex, spriteX });
            // Score for changing shoes
            if (this.rightFootValue !== null) {
                // Player already had a shoe, check if same type
                if (this.rightFootValue === rightHit.yIndex) {
                    // Same shoe type, +50 points
                    this.addScore(50, rightCol, this.playerRow);
                } else {
                    // Different shoe type, -50 points
                    this.score = Math.max(0, this.score - 50); // Prevent negative score
                    this.addScorePopup(-50, rightCol, this.playerRow);
                }
            }
            this.rightFootValue = rightHit.yIndex;
            shoesToRecycle.push(rightHit);
        }

        // If only one foot hit this frame and it completes a matching pair with the already kept other foot,
        // also push an effect for the other foot so the user sees the completed pair flash
        if (!leftHit && rightHit && this.leftFootValue != null && this.leftFootValue === rightHit.yIndex) {
            this.effects.push({ col: leftCol, rowAbs: targetRowVisible + game.topReserved, yIndex: rightHit.yIndex, spriteX: 0 });
        }
        if (!rightHit && leftHit && this.rightFootValue != null && this.rightFootValue === leftHit.yIndex) {
            this.effects.push({ col: rightCol, rowAbs: targetRowVisible + game.topReserved, yIndex: leftHit.yIndex, spriteX: 44 });
        }

        // If both feet are set, decide outcome
        let scored = false;
        if (this.leftFootValue != null && this.rightFootValue != null) {
            // Only check for matches if both feet were just set this frame
            // This prevents immediate matching when a falling shoe briefly touches
            const justCompletedPair = (leftHit && this.rightFootValue != null) || 
                                     (rightHit && this.leftFootValue != null);
            
            if (justCompletedPair) {
                if (this.leftFootValue === this.rightFootValue) {
                    // Start validation timer for matching pair
                    this.pendingMatch = true;
                    this.matchValidationTime = performance.now();
                } else {
                    // Immediate mismatch: end current round
                    this.endCurrentRound();
                }
            }
        }

        // Only recycle shoes that touched the player if no matching pair was scored
        // If a pair was scored, the shoes should disappear completely
        if (!scored) {
            for (const shoe of shoesToRecycle) {
                this.recycleShoe(shoe);
            }
        } else {
            // Remove matched shoes completely from the game
            let removedCount = 0;
            for (const shoe of shoesToRecycle) {
                const index = this.streams.indexOf(shoe);
                if (index > -1) {
                    this.streams.splice(index, 1);
                    removedCount++;
                }
            }
            // Add new shoes to replace the removed ones
            if (removedCount > 0) {
                const levelConfig = Levels.get(this.level, this.cols);
                this.addRandomStreams(removedCount, levelConfig);
            }
        }

        // Level up at every 10,000 points
        while (this.score >= this.nextLevelAt) {
            this.levelUp();
        }
    }

    // Append N new streams starting above the board, using level speed ranges
    private addRandomStreams(count: number, level?: LevelConfig) {
        const cols = this.cols;
        const rows = this.rows;
        const spMin = level?.speedMin ?? 0.6;
        const spMax = level?.speedMax ?? 1.8;
        for (let i = 0; i < count; i++) {
            const c = this.findAvailableColumn(true); // Avoid columns with shoes near top
            const side: ShoeSide = Math.random() < 0.5 ? 'left' : 'right';
            const yIndex = this.chooseYIndex(side);
            // Start above the visible area so new shoes fall in naturally
            const initialY = -Math.random() * Math.max(1, rows);
            this.streams.push({
                col: c,
                y: initialY,
                speed: spMin + Math.random() * Math.max(0.01, spMax - spMin),
                side,
                yIndex,
                id: this.makeShoeId(side, Math.floor(initialY)),
                value: yIndex
            });
            this.pushRecent(side, yIndex);
        }
    }

    private recycleShoe(s: FallingShoe) {
        // Find a new column that doesn't have overlapping shoes
        const newCol = this.findAvailableColumn(true);
        s.col = newCol;
        s.y = -1;
        s.side = Math.random() < 0.5 ? 'left' : 'right';
        s.yIndex = this.chooseYIndex(s.side);
        s.id = this.makeShoeId(s.side, -1);
        s.value = s.yIndex;
        s.speed = 0.6 + Math.random() * 1.2;
        this.pushRecent(s.side, s.yIndex);
    }

    // Add score and check for extra rounds earned
    private addScore(amount: number, col?: number, rowAbs?: number) {
        const extraRound = 400; // 
        const oldScore = this.score;
        this.score += amount;
        
        // Check for new high score during gameplay
        const currentTotal = this.roundScores.reduce((sum, score) => sum + score, 0) + this.score;
        if (currentTotal > this.highScore) {
            // New high score achieved!
            const wasFirstTime = this.highScore === 0; // First time playing
            this.highScore = currentTotal;
            this.highScoreLevel = this.level;
            
            // Save high score to localStorage immediately
            try {
                localStorage.setItem('theGame.highScore', String(this.highScore));
                localStorage.setItem('theGame.highScoreLevel', String(this.highScoreLevel));
            } catch { /* noop */ }
            
            // Show high score popup notification
            this.showHighScorePopup(wasFirstTime);
        }
        
        // Check for extra rounds earned (every  points)
        const oldThousands = Math.floor(oldScore / extraRound);
        const newThousands = Math.floor(this.score / extraRound);
        
        if (newThousands > oldThousands) {
            // Player has crossed one or more 1000-point thresholds
            const extraRoundsEarned = newThousands - oldThousands;
            this.extraRounds += extraRoundsEarned;
            this.totalRounds += extraRoundsEarned;
            
            // Show popup for extra round(s) earned - more prominent but non-invasive
            const centerCol = this.cols / 2;
            const centerRow = Math.max(3, game.topReserved + 2); // Position near top but below HUD
            
            for (let i = 0; i < extraRoundsEarned; i++) {
                this.scorePopups.push({
                    text: "EXTRA ROUND!",
                    col: centerCol,
                    row: centerRow + i * 0.7, // Stack multiple messages with more spacing
                    startTime: Date.now() + i * 300, // Stagger timing if multiple
                    duration: 3500, // 3.5 seconds - longer but not blocking
                    color: '#FFD700', // Gold color for extra round
                    fontSize: 1.6 // Larger font to make it more noticeable
                });
            }
        }
        
        // Add the regular score popup if position is provided
        if (col !== undefined && rowAbs !== undefined) {
            this.addScorePopup(amount, col, rowAbs);
        }
    }

    // Add a new animated score popup
    private addScorePopup(amount: number, col: number, rowAbs: number) {
        const text = amount > 0 ? `+${amount}` : `${amount}`;
        
        // Color scheme: green for positive, red for negative
        let color;
        let fontSize;
        
        if (amount >= 100) {
            // +100 score (matching pair)
            color = '#00FF00'; // Bright green
            fontSize = 1.3; // Larger text
        } else if (amount > 0) {
            // +50 score (same type replacement)
            color = '#FFFF00'; // Yellow
            fontSize = 1.1; // Slightly larger
        } else {
            // -50 score (different type replacement)
            color = '#FF3333'; // Bright red
            fontSize = 1.0; // Normal size
        }
        
        this.scorePopups.push({
            text,
            col,
            row: rowAbs,
            startTime: Date.now(),
            duration: 1000, // 1 second duration
            color,
            fontSize
        });
    }
    
    // Draw animated score popups - public so theGame.ts can call it for proper layering
    drawScorePopups(ctx: CanvasRenderingContext2D) {
        if (this.scorePopups.length === 0) return;
        
        for (const popup of this.scorePopups) {
            const elapsed = Date.now() - popup.startTime;
            const progress = Math.min(1.0, elapsed / popup.duration);
            
            // Different animations based on text content
            let yOffset, xOffset = 0;
            let scale = 1.0;
            
            if (popup.text.includes('LEVEL')) {
                // Level up popup: expand and pulse
                scale = 1.0 + Math.sin(progress * Math.PI * 6) * 0.2 * (1.0 - progress);
                yOffset = -Math.floor(progress * game.block * 0.8);
            } else if (popup.text.includes('HIGH SCORE')) {
                // High score popup: golden glow with gentle bounce
                scale = 1.0 + Math.sin(progress * Math.PI * 4) * 0.15 * (1.0 - progress);
                yOffset = -Math.floor(progress * game.block * 0.6) - Math.sin(progress * Math.PI * 2) * 10;
            } else if (popup.text.startsWith('-')) {
                // Negative score: shake slightly and fall faster
                xOffset = Math.sin(progress * Math.PI * 8) * (1.0 - progress) * 5;
                yOffset = Math.floor(progress * game.block * 1.5);
            } else {
                // Positive score: rise up
                yOffset = -Math.floor(progress * game.block * 1.2);
            }
            
            // Position centered on the grid cell with offsets
            const x = popup.col * game.block + game.block / 2 + xOffset + game.offsetX;
            const y = popup.row * game.block + game.block / 2 + yOffset + game.offsetY;
            
            // Set up text rendering
            ctx.save();
            
            // Large, bold text with custom scaling
            const fontSize = popup.fontSize ? 24 * popup.fontSize * scale : 24 * scale;
            ctx.font = `bold ${fontSize}px 'Press Start 2P', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Add shadow appropriate to the type
            if (popup.text.includes('LEVEL')) {
                // Glowing effect for level up
                ctx.shadowColor = 'rgba(0, 255, 255, 0.8)';
                ctx.shadowBlur = 10;
            } else if (popup.text.includes('HIGH SCORE')) {
                // Golden glow for high score
                ctx.shadowColor = 'rgba(255, 215, 0, 0.9)';
                ctx.shadowBlur = 15;
            } else if (popup.text.startsWith('-')) {
                // Sharp shadow for negative
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 3;
            } else {
                // Standard shadow for positive
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4;
            }
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // Draw text with proper color (maintain full opacity)
            ctx.fillStyle = popup.color;
            ctx.fillText(popup.text, x, y);
            
            ctx.restore();
        }
    }

    // Display level up popup notification
    private showLevelUpPopup() {
        // Create a special popup for level up
        const centerCol = this.cols / 2; // Center of the playfield
        const centerRow = Math.min(this.playerRow - 2, this.rows / 2 + game.topReserved); // Above player
        
        this.scorePopups.push({
            text: `LEVEL ${this.level}!`,
            col: centerCol,
            row: centerRow,
            startTime: Date.now(),
            duration: 2000, // 2 seconds for level up
            color: '#00FFFF', // Cyan for level up
            fontSize: 1.5 // Larger text for level up
        });
    }

    // Display high score popup notification
    private showHighScorePopup(wasFirstTime: boolean) {
        // Create a special popup for high score
        const centerCol = this.cols / 2; // Center of the playfield
        const centerRow = Math.min(this.playerRow - 3, this.rows / 2 + game.topReserved - 1); // Above player, above level up
        
        const message = wasFirstTime ? "FIRST HIGH SCORE!" : "NEW HIGH SCORE!";
        
        this.scorePopups.push({
            text: message,
            col: centerCol,
            row: centerRow,
            startTime: Date.now(),
            duration: 2500, // 2.5 seconds for high score
            color: '#FFD700', // Gold color for high score
            fontSize: 1.6 // Larger text for high score
        });
    }

    private getTotalRowsAbsolute(): number {
        return game.topReserved + this.rows + game.bottomReserved;
    }

    // Bias helpers
    chooseYIndex(side: ShoeSide): number {
        const useBias = Math.random() < this.pairBias;
        const pool = side === 'left' ? this.recentRightY : this.recentLeftY;
        if (useBias && pool.length > 0) {
            return pool[Math.floor(Math.random() * pool.length)] | 0;
        }
        return Math.floor(Math.random() * 23);
    }

    private pushRecent(side: ShoeSide, yIndex: number) {
        const list = side === 'left' ? this.recentLeftY : this.recentRightY;
        if (list.length >= this.RECENT_MAX) {
            list.shift();
        }
        list.push(yIndex);
    }
    
    // Add a new shoe to the board
    addShoe(shoeData: { col?: number, y: number, speed: number, side: ShoeSide, yIndex: number, value: number }) {
        const { y, speed, side, yIndex, value } = shoeData;
        // Use provided column or find an available one
        const col = shoeData.col !== undefined ? shoeData.col : this.findAvailableColumn(true);
        
        this.streams.push({
            col,
            y,
            speed,
            side,
            yIndex,
            id: this.makeShoeId(side, Math.floor(y)),
            value
        });
        
        this.pushRecent(side, yIndex);
    }
}
