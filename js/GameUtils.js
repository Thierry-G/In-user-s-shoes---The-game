// Utilities for the game
import { STORAGE_KEYS } from './GameTypes.js';
/**
 * Storage utility functions for persistent game data
 */
export class Storage {
    /**
     * Save a value to localStorage with error handling
     */
    static save(key, value) {
        try {
            localStorage.setItem(key, String(value));
            return true;
        }
        catch (error) {
            console.warn(`Failed to save ${key}:`, error);
            return false;
        }
    }
    /**
     * Get a numeric value from localStorage with error handling
     */
    static getNumber(key, defaultValue = 0) {
        try {
            const value = localStorage.getItem(key);
            if (value === null)
                return defaultValue;
            const numValue = Number(value);
            return Number.isFinite(numValue) ? numValue : defaultValue;
        }
        catch (error) {
            console.warn(`Failed to load ${key}:`, error);
            return defaultValue;
        }
    }
    /**
     * Get the saved level or default to 1
     */
    static getLevel() {
        return Math.max(1, this.getNumber(STORAGE_KEYS.LEVEL, 1));
    }
    /**
     * Get the saved game count or default to 0
     */
    static getGameCount() {
        return Math.max(0, this.getNumber(STORAGE_KEYS.GAME_COUNT, 0));
    }
}
/**
 * Drawing utilities for the game
 */
export class DrawUtils {
    /**
     * Clear a rect at the given grid cell position
     */
    static clearCell(ctx, col, row, blockSize) {
        const x = col * blockSize;
        const y = row * blockSize;
        ctx.clearRect(x, y, blockSize, blockSize);
    }
    /**
     * Draw a button with text
     */
    static drawButton(ctx, x, y, width, height, text, fontSize, fontFamily = "'Press Start 2P', monospace") {
        // Button background
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = Math.max(2, Math.floor(fontSize * 0.15));
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.fill();
        ctx.stroke();
        // Button text
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, x + width / 2, y + height / 2 + 1);
    }
}
//# sourceMappingURL=GameUtils.js.map