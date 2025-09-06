import { game } from './Ui.js';
import { ButtonBounds } from './GameTypes.js';
import { DrawUtils } from './GameUtils.js';

/**
 * Responsible for managing UI elements like the explosion animation,
 * hint pulse, game over screen and buttons
 */
export class UIEffects {
    /**
     * Draw the explosion animation at the player's position
     * @param ctx - Canvas context
     * @param playerCol - Player column 
     * @param playerRow - Player row
     * @param currentTs - Current timestamp
     * @param explosionStart - Explosion start timestamp
     * @returns The button bounds for the Play Again button if shown
     */
    static drawExplosion(
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        playerCol: number, 
        playerRow: number,
        currentTs: number,
        explosionStart: number
    ): void {
        const block = game.block;
        const baseX = playerCol * block;
        const baseY = playerRow * block;

        // Determine current phase based on elapsed time
        const elapsed = currentTs - explosionStart;
        const phase = elapsed < 275 ? 0 : 1; // two phases
        const sy = phase === 0 ? 1056 : 100; // source Y per phase
        const sx = 88; // single explosion sprite
        
        // Center the 1x1 explosion across the two-tile player
        const dx = baseX + block * 0.5;
        ctx.drawImage(img, sx, sy, 44, 44, dx, baseY, block, block);
    }

    /**
     * Show the game over overlay with Play Again button
     * @param ctx - Canvas context
     * @param canvasWidth - Canvas width
     * @param canvasHeight - Canvas height
     * @returns The button bounds for the Play Again button
     */
    static showGameOver(
        ctx: CanvasRenderingContext2D,
        canvasWidth: number,
        canvasHeight: number
    ): ButtonBounds {
        // Dim the screen
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Text overlay
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.font = `bold ${Math.max(24, Math.floor(game.block * 0.9))}px 'Press Start 2P', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cx = canvasWidth / 2;
        const cy = canvasHeight / 2;
        ctx.strokeText('GAME OVER!', cx, cy);
        ctx.fillText('GAME OVER!', cx, cy);
        
        // Draw "Play Again" button below the text
        const btnPaddingX = Math.max(16, Math.floor(game.block * 0.6));
        const btnPaddingY = Math.max(10, Math.floor(game.block * 0.4));
        const label = 'Play Again';
        const btnFontSize = Math.max(16, Math.floor(game.block * 0.5));
        ctx.font = `bold ${btnFontSize}px 'Press Start 2P', monospace`;
        const textW = ctx.measureText(label).width;
        const btnW = Math.min(canvasWidth * 0.8, textW + btnPaddingX * 2);
        const btnH = btnFontSize + btnPaddingY * 2;
        const btnX = cx - btnW / 2;
        const btnY = cy + Math.max(20, Math.floor(game.block * 0.8));

        // Draw the button
        DrawUtils.drawButton(ctx, btnX, btnY, btnW, btnH, label, btnFontSize);
        
        ctx.restore();
        
        // Return hit area for input handling
        return { x: btnX, y: btnY, w: btnW, h: btnH };
    }

    /**
     * Draw the touch hint circle centered below the player
     * @param ctx - Canvas context
     * @param playerCol - Player column
     * @param playerRow - Player row
     * @param currentTs - Current timestamp
     * @param hintPulseStart - Hint pulse start timestamp or null
     * @returns Whether the hint pulse is still active
     */
    static drawTouchHint(
        ctx: CanvasRenderingContext2D,
        playerCol: number,
        playerRow: number,
        currentTs: number,
        hintPulseStart: number | null
    ): boolean {
        const block = game.block;
        const totalRowsAbs = game.topReserved + game.rows + game.bottomReserved;
        const hintRow = Math.min(playerRow + 1, totalRowsAbs - 1);
        const halfBlock = game.block * 0.5;
        const cx = (playerCol * block) + block + halfBlock; // center of 2-tile player with half-block offset
        const cy = (hintRow * block) + (block / 2);
        const baseR = Math.max(12, Math.floor(block * 0.42));

        ctx.save();
        
        // Apply centering transform
        ctx.translate(game.offsetX, game.offsetY);
        
        // Draw static hint circle
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

        // Draw pulse animation if active
        let pulseFinished = false;
        if (hintPulseStart != null) {
            const t = Math.min(1, Math.max(0, (currentTs - hintPulseStart) / 500));
            const easeOut = 1 - Math.pow(1 - t, 3);
            const pulseR = baseR * (1 + 0.9 * easeOut);
            const alpha = 0.9 * (1 - t);

            // Inner gradient
            const grad = ctx.createRadialGradient(cx + 0.5, cy + 0.5, Math.max(1, baseR * 0.2), cx + 0.5, cy + 0.5, pulseR);
            grad.addColorStop(0, `rgba(255,255,255,${0.24 * alpha})`);
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy + 0.5, pulseR, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Glow effect
            ctx.shadowColor = `rgba(255,255,255,${0.8 * alpha})`;
            ctx.shadowBlur = Math.max(4, Math.floor(block * 0.28));
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy + 0.5, pulseR, 0, Math.PI * 2);
            ctx.lineWidth = Math.max(3, Math.floor(block * 0.14));
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.stroke();

            // Outer ring
            ctx.shadowColor = 'transparent';
            ctx.beginPath();
            ctx.arc(cx + 0.5, cy + 0.5, pulseR + Math.max(2, Math.floor(block * 0.06)), 0, Math.PI * 2);
            ctx.lineWidth = Math.max(2, Math.floor(block * 0.08));
            ctx.strokeStyle = `rgba(18,108,227,${0.6 * alpha})`;
            ctx.stroke();

            pulseFinished = t >= 1;
        }
        
        ctx.restore();
        return pulseFinished;
    }
    
    /**
     * Check if a point is within the hint circle area
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param playerCol - Player column
     * @param playerRow - Player row
     * @returns Whether the point is within the hint circle
     */
    static isPointInHintCircle(
        x: number, 
        y: number, 
        playerCol: number, 
        playerRow: number
    ): boolean {
        const block = game.block;
        const totalRowsAbs = game.topReserved + game.rows + game.bottomReserved;
        const hintRow = Math.min(playerRow + 1, totalRowsAbs - 1);
        const halfBlock = game.block * 0.5;
        const cx = (playerCol * block) + block + halfBlock + game.offsetX; // center of 2-tile player with offsets
        const cy = (hintRow * block) + (block / 2) + game.offsetY;
        const r = Math.max(10, Math.floor(block * 0.38)) * 1.25; // larger tap area
        
        const dx = x - cx;
        const dy = y - cy;
        return (dx * dx + dy * dy) <= (r * r);
    }
    
    /**
     * Check if a point is within a button
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param button - Button bounds
     * @returns Whether the point is within the button
     */
    static isPointInButton(x: number, y: number, button: ButtonBounds): boolean {
        return (
            x >= button.x && 
            x <= button.x + button.w && 
            y >= button.y && 
            y <= button.y + button.h
        );
    }
    
    /**
     * Draw a shoe explosion effect at a specific grid position
     * @param ctx - Canvas context
     * @param img - Image containing the explosion sprite
     * @param col - Column where the explosion occurs
     * @param row - Row where the explosion occurs
     * @param currentTs - Current timestamp
     * @param startTs - When the explosion started
     */
    static drawShoeExplosion(
        ctx: CanvasRenderingContext2D,
        img: HTMLImageElement,
        col: number,
        row: number,
        currentTs: number,
        startTs: number
    ): void {
        const block = game.block;
        const elapsed = currentTs - startTs;
        
        // Use two animation phases based on elapsed time
        const phase = elapsed < 200 ? 0 : 1; 
        const sy = phase === 0 ? 1056 : 100; // source Y per phase
        const sx = 88; // explosion sprite
        
        // Draw the explosion sprite at the correct position
        const dx = col * block;
        const dy = row * block;
        ctx.drawImage(img, sx, sy, 44, 44, dx, dy, block, block);
    }
}
