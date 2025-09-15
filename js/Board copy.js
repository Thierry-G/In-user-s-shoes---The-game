import { game } from './Ui.js';
import Shoes from './Shoes.js';
import Levels from './Levels.js';
export default class Board {
    constructor() {
        this.shoesHelper = new Shoes();
        this.cols = 0;
        this.rows = 0; // playable rows (excludes reserved bottom rows)
        this.streams = [];
        // pairCount removed: no longer used in HUD
        this.playerCol = 0; // left tile col of player
        this.playerRow = 0; // absolute grid row where player sits (including topReserved)
        this.score = 0;
        this.level = 1;
        this.gameCount = 0;
        // messages removed (legacy)
        this.rightColumnText = [];
        this.nextLevelAt = 200;
        this.lastScoreRow = null;
        this.scorePopups = []; // Track animated score popups
        this.currentTime = 0; // Track current time for animations
        this.effects = [];
        // Track whether each foot has already collected a value; null means empty/default
        this.leftFootValue = null;
        this.rightFootValue = null;
        this.gameOver = false;
        // Pairing bias state
        this.recentLeftY = [];
        this.recentRightY = [];
        this.RECENT_MAX = 8;
        this.pairBias = 0.6; // 60% chance to reuse an opposite-side recent yIndex
        // Flag to track if we need to check for matching pairs in the next frame
        this.pendingPairCheck = false;
    }
    setImage(img) {
        this.shoesHelper.setImage(img);
    }
    // Build an ID that reflects the shoe's current board row and side (e.g., 'left-7')
    makeShoeId(side, row) {
        return `${side}-${row | 0}`;
    }
    // Initialize or refresh the board with new streams using a level config
    init(cols, rows, level) {
        this.cols = cols;
        this.rows = rows;
        this.streams = [];
        this.leftFootValue = null;
        this.rightFootValue = null;
        this.score = 0;
        this.level = 1; // Always reset to level 1 when initializing a new game
        this.gameOver = false;
        this.nextLevelAt = 200; // Using 200 points for level up threshold
        // Initialize right column text array with proper size
        const totalRows = this.getTotalRowsAbsolute();
        this.rightColumnText = new Array(totalRows).fill(undefined);
        // We'll display the level in the top right permanently instead of as a message
        // so we don't need to place it in the rightColumnText array
        // Add next level threshold info
        this.placeRightColumn(`Next: ${this.nextLevelAt}`);
        this.effects = [];
        this.pendingPairCheck = false;
        this.refreshStreams(level);
        // For debugging
        console.log(`Game initialized: Level ${this.level}, Next level at: ${this.nextLevelAt}`);
    }
    refreshStreams(level) {
        var _a, _b, _c;
        const cols = this.cols;
        this.streams = [];
        this.recentLeftY = [];
        this.recentRightY = [];
        const total = (_a = level === null || level === void 0 ? void 0 : level.totalShoes) !== null && _a !== void 0 ? _a : cols;
        const spMin = (_b = level === null || level === void 0 ? void 0 : level.speedMin) !== null && _b !== void 0 ? _b : 0.6;
        const spMax = (_c = level === null || level === void 0 ? void 0 : level.speedMax) !== null && _c !== void 0 ? _c : 1.8;
        for (let i = 0; i < total; i++) {
            const c = Math.floor(Math.random() * cols);
            const side = Math.random() < 0.5 ? 'left' : 'right';
            const yIndex = this.chooseYIndex(side);
            // Start above the visible area so new shoes fall in naturally
            const initialY = -Math.random() * Math.max(1, this.rows);
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
    setPlayerPosition(col, rowAbsolute) {
        // Ensure player position respects the reserved columns on the right
        const reservedColumnsRight = 2;
        const maxCol = this.cols - reservedColumnsRight - 1; // -1 for the right foot
        this.playerCol = Math.min(col, maxCol);
        this.playerRow = rowAbsolute;
    }
    getScore() { return this.score; }
    getLevel() { return this.level; }
    isGameOver() { return this.gameOver; }
    setGameCount(n) { this.gameCount = n; }
    getGameCount() { return this.gameCount; }
    update(dt, currentTimestamp) {
        if (this.gameOver)
            return;
        // Update current time for animations if provided
        if (currentTimestamp !== undefined) {
            this.currentTime = currentTimestamp;
        }
        // Remove expired score popups
        this.scorePopups = this.scorePopups.filter(popup => this.currentTime - popup.startTime < popup.duration);
        // Move shoes first
        for (const s of this.streams) {
            s.y += s.speed * dt;
            // Ensure column is within valid bounds (0 to cols-1)
            if (s.col < 0 || s.col >= this.cols) {
                s.col = Math.min(Math.max(0, s.col), this.cols - 1);
            }
            // Refresh ID based on the current visible row
            s.id = this.makeShoeId(s.side, Math.floor(s.y));
        }
        // Check for collisions when shoes are at the last playable row
        this.checkCollisions();
        // Check for collisions between left and right shoes
        this.checkShoeToShoeCollisions();
        // Track shoes to recycle to avoid modification during iteration
        const shoesToRecycle = [];
        // Recycle any shoes that have moved past the board or are at the player row
        for (const s of this.streams) {
            // Get absolute row position 
            const rowAbsolute = Math.floor(s.y) + game.topReserved;
            // Recycle shoes at or beyond the player row position
            if (Math.floor(s.y) >= this.rows - 1 || rowAbsolute >= this.playerRow) {
                shoesToRecycle.push(s);
            }
        }
        // Recycle shoes after we're done iterating through the array
        for (const s of shoesToRecycle) {
            this.recycleShoe(s);
        }
    }
    // Add a new animated score popup
    addScorePopup(amount, col, rowAbs) {
        const text = amount > 0 ? `+${amount}` : `${amount}`;
        // Use fully opaque colors - alpha will be applied during drawing
        // Green for +100, yellow for +50, red for -50
        let color = '#ffff00'; // Default yellow for +50
        let fontSize = 1.0; // Default size multiplier
        if (amount >= 100) {
            color = '#00ff00'; // Green for +100
            fontSize = 1.2; // Slightly larger for +100
        }
        else if (amount < 0) {
            color = '#ff3333'; // Red for negative values
            fontSize = 0.9; // Slightly smaller for penalties
        }
        this.scorePopups.push({
            text,
            col,
            row: rowAbs,
            startTime: this.currentTime,
            duration: 700, // 0.7 seconds
            color,
            fontSize
        });
    }
    // Check for collisions between left and right shoes
    checkShoeToShoeCollisions() {
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
                        this.score += 50;
                        // Show animated +50 score popup
                        const scoreX = leftCol;
                        const scoreY = leftRow + game.topReserved;
                        this.addScorePopup(50, scoreX, scoreY);
                    }
                }
            }
        }
        // Remove matched shoes
        for (const shoe of shoesToRemove) {
            this.recycleShoe(shoe);
        }
    }
    draw() {
        const ctx = game.ctx;
        if (!ctx) {
            console.log("Cannot draw board - context not available");
            return;
        }
        // Note: Centering transform is now applied in the main render method
        // No need to save/translate context here
        // Define the right column position moved 2 columns left
        const reservedColumnsRight = 2;
        const playableColumns = this.cols - reservedColumnsRight;
        // Draw all falling shoes - only in the playable area
        for (const s of this.streams) {
            const r = Math.floor(s.y);
            // Skip drawing shoes that are at the player's position (they'll be shown as player feet)
            const isAtPlayerPosition = (r === this.playerRow - game.topReserved) &&
                ((s.col === this.playerCol && s.side === 'left') ||
                    (s.col === this.playerCol + 1 && s.side === 'right'));
            // Only draw shoes that are within valid game area (excluding the reserved right columns)
            // AND not at the player's position
            if (r >= 0 && r < this.rows && s.col >= 0 && s.col < playableColumns && !isAtPlayerPosition) {
                // Draw right shoes with a slight offset and different visual style to create layering effect
                if (s.side === 'right') {
                    // Draw right shoes with a slight negative y-offset to appear "above" left shoes
                    const offsetY = -1; // Offset by 1 pixel to create layering effect
                    const adjustedRow = r + game.topReserved;
                    this.shoesHelper.drawAtGrid(s.side, s.yIndex, s.col, adjustedRow, offsetY);
                }
                else {
                    // Draw left shoes normally
                    this.shoesHelper.drawAtGrid(s.side, s.yIndex, s.col, r + game.topReserved);
                }
            }
        }
        // Draw any active score popups
        this.drawScorePopups(ctx);
        // ----- HUD AREA - LEFT SIDE -----
        // Create a standardized background for the HUD
        const hudBgColor = 'rgba(255,255,255,0.85)';
        ctx.fillStyle = hudBgColor;
        // Fill the background for the ENTIRE top area, including both score and level sections
        // Make sure it goes all the way to the edge of the canvas
        ctx.fillRect(0, 0, game.width, game.topReserved * game.block);
        // Set font size based on block size for better responsiveness
        const fontSizeMultiplier = Math.min(1, game.block / 40); // Scale font based on block size
        const hudFontSize = Math.max(12, Math.floor(16 * fontSizeMultiplier));
        // Define a consistent HUD font for all text elements - use bold for all Score, Game, and Level
        const hudFont = `bold ${hudFontSize}px 'Press Start 2P', monospace`;
        ctx.font = hudFont;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#000';
        // Persistent HUD in top reserved rows - now including score, game, and level
        const hudX = 8;
        const scoreY = (0 + 0.5) * game.block; // First row
        const gameY = (1 + 0.5) * game.block; // Second row
        // Calculate maximum text width to prevent overflow
        const maxHudWidth = (this.cols - 2) * game.block - 16; // Minus padding
        // Draw Score text and ensure it fits
        ctx.fillText(`Score: ${this.score}`, hudX, scoreY, maxHudWidth);
        ctx.fillText(`Game: ${this.gameCount}`, hudX, gameY, maxHudWidth);
        // ----- RIGHT COLUMN AREA (now part of the HUD) -----
        // Get level column X position - moved 2 columns to the left
        const levelColX = (this.cols - 2) * game.block; // 2 columns left of edge
        // Calculate right column width based on screen size, more consistently
        const rightColWidth = Math.min(game.block * 3, // Max width
        Math.max(game.block * 1.5, Math.floor(game.width * 0.15)) // Responsive min width
        );
        // Use the same font size as Score and Game for all elements
        // We don't need a separate rightColFontSize since we're using hudFontSize consistently
        // Consistent padding
        const padding = Math.max(4, Math.floor(game.block * 0.1));
        // No need for separate level display background since we're using the HUD background
        // No border needed
        // Use the same font as Score and Game (already stored in hudFont)
        // No need to reset the font as it's already set to hudFont above
        ctx.fillStyle = '#000'; // Same color as Score and Game
        // Calculate available text width for level display
        const availableTextWidth = rightColWidth - (padding * 2);
        // Draw Level directly, always using the format "Level: X" to match Score and Game
        const levelText = `Level: ${this.level}`;
        // Level is on the same line as Score, left-aligned in its column
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        // Draw the level text on the same line as Score
        ctx.fillText(levelText, levelColX + padding, scoreY, availableTextWidth);
        // Define a consistent non-bold font for regular messages (only for non-HUD messages)
        const regularMessageFont = `${hudFontSize}px 'Press Start 2P', monospace`;
        // Draw the rest of the right column messages with consistent styling
        // Start from the second row (after Level which is on the first row)
        for (let rAbs = 1; rAbs < this.rightColumnText.length; rAbs++) {
            const msg = this.rightColumnText[rAbs];
            if (!msg)
                continue;
            // Detect if this is a level message
            const isLevelMsg = msg.includes('Level');
            // Add a background rectangle with consistent color
            ctx.fillStyle = hudBgColor; // Use same background color for all text
            ctx.fillRect(levelColX, rAbs * game.block, rightColWidth, game.block);
            // Set text color first, same for all text
            ctx.fillStyle = '#000';
            // Use different font weight for level messages but keep same size
            if (isLevelMsg) {
                ctx.font = hudFont; // Use bold font for level messages
            }
            else {
                ctx.font = regularMessageFont; // Use regular font for other messages
            }
            // Format "Next: X" messages to ensure they fit
            let displayMsg = msg;
            if (msg.includes('Next:')) {
                const nextValue = msg.split('Next:')[1].trim();
                // Use shorter format if space is limited
                if (ctx.measureText(msg).width > availableTextWidth) {
                    displayMsg = `Next:${nextValue}`;
                }
            }
            // Add padding and ensure text fits
            ctx.fillText(displayMsg, levelColX + padding, (rAbs + 0.5) * game.block, availableTextWidth);
        }
        // Note: Context restore is now handled in the main render method
    }
    // Draw transient effects on top of the player and other elements, then clear them
    drawEffectsOnTop() {
        const ctx = game.ctx;
        if (!ctx)
            return;
        // Note: Centering transform is now applied in the main render method
        // No need to save/translate context here
        for (const e of this.effects) {
            // Validate the effect is within game bounds
            if (e.col < 0 || e.col >= this.cols || e.rowAbs < 0 || e.rowAbs >= this.getTotalRowsAbsolute()) {
                continue; // Skip effects outside the game area
            }
            // Get the position for drawing
            const dx = e.col * game.block;
            const dy = e.rowAbs * game.block;
            // Instead of clearing a rect, which can cause flickering,
            // we'll redraw the background color to create a clean slate
            ctx.fillStyle = '#cfcfcf'; // Match canvas background color
            ctx.fillRect(dx, dy, game.block, game.block);
            // Set a z-index-like rendering by drawing right shoes slightly above left shoes
            // This creates a visual layering effect when shoes touch
            if (e.spriteX === 44) { // Right shoe
                this.shoesHelper.drawAtGridSpriteX(e.spriteX, e.yIndex, e.col, e.rowAbs, 2); // Draw with slight highlight
            }
            else { // Left shoe
                this.shoesHelper.drawAtGridSpriteX(e.spriteX, e.yIndex, e.col, e.rowAbs, 1); // Normal highlight
            }
        }
        // Clear effects after drawing them
        this.effects = [];
        // Note: Context restore is now handled in the main render method
    }
    // Draw persistent kept overlays on the player's feet using stored foot values
    drawKeptOverlays() {
        const ctx = game.ctx;
        if (!ctx)
            return;
        // Note: Centering transform is now applied in the main render method
        // No need to save/translate context here
        // Ensure player position is within valid game bounds
        const validPlayerCol = Math.min(Math.max(0, this.playerCol), this.cols - 1);
        const validPlayerRow = Math.min(Math.max(0, this.playerRow), this.getTotalRowsAbsolute() - 1);
        if (this.leftFootValue != null) {
            this.shoesHelper.drawAtGridSpriteX(0, this.leftFootValue, validPlayerCol, validPlayerRow);
        }
        if (this.rightFootValue != null && validPlayerCol + 1 < this.cols) {
            this.shoesHelper.drawAtGridSpriteX(44, this.rightFootValue, validPlayerCol + 1, validPlayerRow);
        }
        // Note: Context restore is now handled in the main render method
    }
    // Detect when a falling shoe reaches the player's row and correct side alignment
    checkCollisions() {
        // Player occupies columns [playerCol, playerCol+1] on row playerRow
        const leftCol = this.playerCol;
        const rightCol = this.playerCol + 1;
        // Don't allow player to move into the reserved right columns
        const reservedColumnsRight = 2;
        const maxCol = this.cols - reservedColumnsRight - 1; // -1 for the right foot
        // Restrict player to valid columns
        if (rightCol > maxCol) {
            return; // Player is in the reserved area, ignore collisions
        }
        // Convert absolute player row to board-local and clamp to last playable row
        let targetRowVisible = this.playerRow - game.topReserved;
        if (!Number.isFinite(targetRowVisible))
            return;
        if (targetRowVisible < 0)
            targetRowVisible = 0;
        if (targetRowVisible >= this.rows)
            targetRowVisible = this.rows - 1;
        // First find candidates at the player's row for both feet
        let leftHit;
        let rightHit;
        // Track all shoes at the player row to recycle them later
        const shoesAtPlayerRow = [];
        for (const s of this.streams) {
            const r = Math.floor(s.y);
            // If the shoe is at the player row, add it to our tracking list
            if (r === targetRowVisible) {
                shoesAtPlayerRow.push(s);
                // Check for correct side hits
                if (s.col === leftCol && s.side === 'left')
                    leftHit = s;
                else if (s.col === rightCol && s.side === 'right')
                    rightHit = s;
            }
        }
        // Show visual change at contact positions per-foot and set foot values
        // Left foot: always display replacement sprite with sx=0 on touch
        if (leftHit) {
            const spriteX = 0;
            this.effects.push({ col: leftHit.col, rowAbs: targetRowVisible + game.topReserved, yIndex: leftHit.yIndex, spriteX });
            // Check if we already had a left shoe
            if (this.leftFootValue !== null) {
                // We already had a left shoe, check if it matches the new one
                if (this.leftFootValue === leftHit.yIndex) {
                    // Same shoe: award points
                    this.score += 50;
                    this.addScorePopup(50, leftHit.col, targetRowVisible + game.topReserved);
                }
                else {
                    // Different shoe: lose points
                    this.score -= 50;
                    this.addScorePopup(-50, leftHit.col, targetRowVisible + game.topReserved);
                }
            }
            // Set the new left foot value
            this.leftFootValue = leftHit.yIndex;
            this.recycleShoe(leftHit);
        }
        // Right foot: always display replacement sprite with sx=44 on touch
        if (rightHit) {
            const spriteX = 44;
            this.effects.push({ col: rightHit.col, rowAbs: targetRowVisible + game.topReserved, yIndex: rightHit.yIndex, spriteX });
            // Check if we already had a right shoe
            if (this.rightFootValue !== null) {
                // We already had a right shoe, check if it matches the new one
                if (this.rightFootValue === rightHit.yIndex) {
                    // Same shoe: award points
                    this.score += 50;
                    this.addScorePopup(50, rightHit.col, targetRowVisible + game.topReserved);
                }
                else {
                    // Different shoe: lose points
                    this.score -= 50;
                    this.addScorePopup(-50, rightHit.col, targetRowVisible + game.topReserved);
                }
            }
            // Set the new right foot value
            this.rightFootValue = rightHit.yIndex;
            this.recycleShoe(rightHit);
        }
        // If only one foot hit this frame and it completes a matching pair with the already kept other foot,
        // also push an effect for the other foot so the user sees the completed pair flash
        if (!leftHit && rightHit && this.leftFootValue != null && this.leftFootValue === rightHit.yIndex) {
            this.effects.push({ col: leftCol, rowAbs: targetRowVisible + game.topReserved, yIndex: rightHit.yIndex, spriteX: 0 });
        }
        if (!rightHit && leftHit && this.rightFootValue != null && this.rightFootValue === leftHit.yIndex) {
            this.effects.push({ col: rightCol, rowAbs: targetRowVisible + game.topReserved, yIndex: leftHit.yIndex, spriteX: 44 });
        }
        // If we have new hits in this frame, don't check for matching pairs yet - wait until next frame
        // This ensures the shoes are visibly on the player before pairing
        if (leftHit || rightHit) {
            // Store that we need to check for matching pairs in the next frame
            this.pendingPairCheck = true;
            // Recycle all shoes at the player row to avoid the 3 feet bug
            // This includes shoes that were not directly hit by the player
            for (const s of shoesAtPlayerRow) {
                // Only recycle shoes that weren't already recycled as leftHit or rightHit
                if (s !== leftHit && s !== rightHit) {
                    this.recycleShoe(s);
                }
            }
            return;
        }
        // If both feet are set, decide outcome - but only if we're not in the middle of collecting shoes
        // This ensures the shoes are visibly on the player before scoring the +100
        let scored = false;
        if (this.pendingPairCheck && this.leftFootValue != null && this.rightFootValue != null) {
            this.pendingPairCheck = false; // Reset the pending check
            if (this.leftFootValue === this.rightFootValue) {
                // Matched pair: score and reset
                this.score += 100;
                // Show animated +100 score popup at the player's position
                const scoreX = this.playerCol; // Show at left foot position
                const scoreY = this.playerRow;
                this.addScorePopup(100, scoreX, scoreY);
                // No longer show in the right column
                scored = true;
                this.leftFootValue = null;
                this.rightFootValue = null;
                // Check for level up immediately after scoring
                this.checkLevelUp(scored);
            }
            else {
                // Mismatch: game over
                this.gameOver = true;
            }
        }
    }
    // Check if player should level up based on score
    checkLevelUp(scored) {
        var _a, _b, _c, _d, _e;
        // Level up at every 10,000 points
        if (this.score >= this.nextLevelAt) {
            console.log(`Leveling up to ${this.level + 1} at score ${this.score}`);
            this.level += 1;
            this.nextLevelAt += 200; // Add 200 points for next level threshold
            // Persist new level
            try {
                localStorage.setItem('theGame.level', String(this.level));
            }
            catch ( /* noop */_f) { /* noop */ }
            // Clear any previous level-related messages from the right column
            for (let i = 0; i < this.rightColumnText.length; i++) {
                if (this.rightColumnText[i] &&
                    (((_a = this.rightColumnText[i]) === null || _a === void 0 ? void 0 : _a.includes('Level')) ||
                        ((_b = this.rightColumnText[i]) === null || _b === void 0 ? void 0 : _b.includes('Next')))) {
                    this.rightColumnText[i] = undefined;
                }
            }
            // Add a temporary level-up notification message
            this.placeRightColumn(`Level Up!`);
            // Add updated next level message
            this.placeRightColumn(`Next: ${this.nextLevelAt}`);
            // Increase concurrent falling shoes for the new level
            const cfg = Levels.get(this.level, this.cols);
            const targetTotal = (_c = cfg.totalShoes) !== null && _c !== void 0 ? _c : this.cols;
            if (this.streams.length < targetTotal) {
                const toAdd = targetTotal - this.streams.length;
                this.addRandomStreams(toAdd, cfg);
            }
            // Nudge existing speeds into the new level's range
            for (const s of this.streams) {
                const min = (_d = cfg.speedMin) !== null && _d !== void 0 ? _d : 0.6;
                const max = (_e = cfg.speedMax) !== null && _e !== void 0 ? _e : Math.max(min + 0.01, 1.8);
                if (s.speed < min || s.speed > max) {
                    s.speed = min + Math.random() * Math.max(0.01, max - min);
                }
            }
        }
    }
    // Append N new streams starting above the board, using level speed ranges
    addRandomStreams(count, level) {
        var _a, _b;
        const cols = this.cols;
        const spMin = (_a = level === null || level === void 0 ? void 0 : level.speedMin) !== null && _a !== void 0 ? _a : 0.6;
        const spMax = (_b = level === null || level === void 0 ? void 0 : level.speedMax) !== null && _b !== void 0 ? _b : 1.8;
        // Account for the reserved columns on the right
        const reservedColumnsRight = 2;
        const maxCol = cols - reservedColumnsRight - 1;
        for (let i = 0; i < count; i++) {
            // Ensure column is within valid game boundaries (0 to maxCol)
            const c = Math.floor(Math.random() * (maxCol + 1));
            // Randomize other properties
            const side = Math.random() < 0.5 ? 'left' : 'right';
            const yIndex = this.chooseYIndex(side);
            // Start above the visible area so new shoes fall in naturally
            const initialY = -Math.random() * Math.max(1, this.rows);
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
    recycleShoe(s) {
        // Reset position to above the game area
        s.y = -1 - (Math.random() * 2); // Random start height to prevent clustering
        // Randomize side
        s.side = Math.random() < 0.5 ? 'left' : 'right';
        // Select a new yIndex (shoe style)
        s.yIndex = this.chooseYIndex(s.side);
        // Ensure column is within valid bounds, respecting the reserved columns on the right
        const reservedColumnsRight = 2;
        const maxCol = this.cols - reservedColumnsRight - 1;
        // Randomize column position for better distribution
        s.col = Math.floor(Math.random() * (maxCol + 1));
        // Update ID and value
        s.id = this.makeShoeId(s.side, -1);
        s.value = s.yIndex;
        // Randomize speed within acceptable range
        s.speed = 0.6 + Math.random() * 1.2;
        // Track recent shoe types to avoid repetition
        this.pushRecent(s.side, s.yIndex);
    }
    getTotalRowsAbsolute() {
        return game.topReserved + this.rows + game.bottomReserved;
    }
    placeRightColumn(text) {
        const total = this.rightColumnText.length || this.getTotalRowsAbsolute();
        if (this.rightColumnText.length !== total) {
            this.rightColumnText = new Array(total);
        }
        // Find the first available row or scroll up if full
        let row = 0;
        // Check if text might be too long for display
        const isCompactNeeded = game.width < 500; // For small screens
        let processedText = text;
        // For level messages, try to place them in a more visible position (rows 4-6)
        if (text.includes('Level')) {
            // Use a position that's more likely to be visible (right after the HUD area)
            const preferredStartRow = game.topReserved + 1;
            const preferredEndRow = Math.min(preferredStartRow + 3, total - 1);
            // Apply compact format for small screens
            if (isCompactNeeded && text.includes('Level Up')) {
                processedText = 'Lv Up!';
            }
            // Try to find an empty slot in the preferred range
            for (row = preferredStartRow; row <= preferredEndRow; row++) {
                if (row < total && this.rightColumnText[row] === undefined) {
                    break;
                }
            }
            // If no empty slots in preferred range, clear one
            if (row > preferredEndRow || row >= total) {
                row = preferredStartRow;
                // Clear this row for the level message
                this.rightColumnText[row] = undefined;
            }
        }
        // For "Next:" messages, use compact format if needed
        else if (text.includes('Next:') && isCompactNeeded) {
            const nextValue = text.split('Next:')[1].trim();
            processedText = `Next:${nextValue}`;
            // For non-level messages, find the first available slot
            while (row < total && this.rightColumnText[row] !== undefined) {
                row++;
            }
            // If no empty slots, scroll up
            if (row >= total) {
                // Scroll up: drop first, append empty
                this.rightColumnText.shift();
                this.rightColumnText.push(undefined);
                row = total - 1;
            }
        }
        // For non-level messages, find the first available slot
        else {
            while (row < total && this.rightColumnText[row] !== undefined) {
                row++;
            }
            // If no empty slots, scroll up
            if (row >= total) {
                // Scroll up: drop first, append empty
                this.rightColumnText.shift();
                this.rightColumnText.push(undefined);
                row = total - 1;
            }
        }
        // Place the processed text in the selected row
        this.rightColumnText[row] = processedText;
        // Log placement for debugging
        console.log(`Placed text "${processedText}" in right column at row ${row}`);
        return row;
    }
    // Bias helpers
    chooseYIndex(side) {
        const useBias = Math.random() < this.pairBias;
        const pool = side === 'left' ? this.recentRightY : this.recentLeftY;
        if (useBias && pool.length > 0) {
            return pool[Math.floor(Math.random() * pool.length)] | 0;
        }
        return Math.floor(Math.random() * 23);
    }
    pushRecent(side, yIndex) {
        const list = side === 'left' ? this.recentLeftY : this.recentRightY;
        if (list.length >= this.RECENT_MAX) {
            list.shift();
        }
        list.push(yIndex);
    }
    // Draw animated score popups
    drawScorePopups(ctx) {
        if (this.scorePopups.length === 0)
            return;
        for (const popup of this.scorePopups) {
            const elapsed = this.currentTime - popup.startTime;
            const progress = Math.min(1.0, elapsed / popup.duration);
            // Fade out near the end of the animation
            const alpha = progress > 0.7 ? 1.0 - ((progress - 0.7) / 0.3) : 1.0;
            // Move upward as the animation progresses
            const offsetY = -Math.floor(progress * game.block * 0.5);
            const x = popup.col * game.block + game.block / 2;
            const y = popup.row * game.block + game.block / 2 + offsetY;
            // Draw with shadow for better visibility
            ctx.save();
            const baseFontSize = Math.max(18, Math.floor(game.block * 0.6));
            const fontSize = popup.fontSize ? baseFontSize * popup.fontSize : baseFontSize;
            ctx.font = `bold ${fontSize}px 'Press Start 2P', monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Simplified shadow with less blur to prevent visual glitches
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 2; // Reduced blur
            ctx.shadowOffsetX = 1; // Smaller offset
            ctx.shadowOffsetY = 1; // Smaller offset
            // Main text - draw only once with cleaner shadows
            ctx.fillStyle = popup.color;
            ctx.globalAlpha = alpha; // Use global alpha for cleaner fading
            ctx.fillText(popup.text, x, y);
            ctx.restore();
        }
    }
}
//# sourceMappingURL=Board%20copy.js.map