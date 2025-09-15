import { game } from './Ui.js';
/**
 * Handles shoe sprites and drawing
 */
export default class Shoes {
    /**
     * Initialize shoes with optional image
     */
    constructor(img) {
        this.image = null;
        this.leftShoe = [];
        this.rightShoe = [];
        if (img)
            this.image = img;
        this.buildFrames();
    }
    /**
     * Get the image used for the shoe sprites
     */
    getImage() {
        return this.image;
    }
    /**
     * Set the sprite sheet image
     */
    setImage(img) {
        this.image = img;
        // Rebuild frames to ensure we have correct data
        this.buildFrames();
    }
    /**
     * Build frame definitions for all shoe sprites
     */
    buildFrames() {
        this.leftShoe = [];
        this.rightShoe = [];
        // Create sprite frames for 23 shoe styles (yIndex 0-22)
        for (let y = 0; y <= 22; y++) {
            // Left shoes have sx=88, right shoes have sx=132
            this.leftShoe.push({
                side: 'left',
                yIndex: y,
                sx: 88, // Updated: left falling shoes start at sx=88
                sy: y * 44,
                sWidth: 44,
                sHeight: 44
            });
            this.rightShoe.push({
                side: 'right',
                yIndex: y,
                sx: 132, // Updated: right falling shoes start at sx=132
                sy: y * 44,
                sWidth: 44,
                sHeight: 44
            });
        }
    }
    /**
     * Get the shoe frame for the given side and yIndex
     */
    getFrame(side, yIndex) {
        const list = side === 'left' ? this.leftShoe : this.rightShoe;
        const idx = Math.max(0, Math.min(22, yIndex | 0));
        return list[idx];
    }
    /**
     * Draw a shoe frame at grid col,row using current image and canvas context
     * @param yOffset - Optional pixel offset in Y direction (for layering effects)
     */
    drawAtGrid(side, yIndex, col, row, yOffset = 0) {
        if (!this.image || !game.ctx) {
            console.log("Cannot draw shoe - image or context not available");
            return;
        }
        const frame = this.getFrame(side, yIndex);
        // Add half-column offset to account for visual layout shift
        const halfBlock = game.block * 0.5;
        const dx = col * game.block + halfBlock;
        const dy = row * game.block + yOffset; // Apply yOffset for layering effect
        try {
            // Ensure crisp pixel rendering
            game.ctx.imageSmoothingEnabled = false;
            // Debug to verify sprite positions
            // console.log(`Drawing ${side} shoe with sx=${frame.sx}, sy=${frame.sy} at grid (${col}, ${row})`);
            game.ctx.drawImage(this.image, frame.sx, frame.sy, frame.sWidth, frame.sHeight, dx, dy, game.block, game.block);
        }
        catch (err) {
            console.error("Error drawing shoe:", err, "sx:", frame.sx, "sy:", frame.sy, "sw:", frame.sWidth, "sh:", frame.sHeight, "dx:", dx, "dy:", dy, "dw:", game.block, "dh:", game.block);
        }
    }
    /**
     * Draw using an explicit sprite X (sx override) keeping the same yIndex row in the spritesheet
     * Also draws a border around the tile
     * @param highlightLevel - Optional highlight level (0=normal, 1=slight highlight, 2=stronger highlight)
     */
    drawAtGridSpriteX(spriteX, yIndex, col, row, highlightLevel = 0) {
        if (!this.image || !game.ctx) {
            console.log("Cannot draw shoe - image or context not available");
            return;
        }
        // Add half-column offset to account for visual layout shift
        const halfBlock = game.block * 0.5;
        const dx = col * game.block + halfBlock;
        const dy = row * game.block;
        const sy = Math.max(0, Math.min(22, yIndex | 0)) * 44;
        try {
            // First ensure we're using crisp pixel rendering
            game.ctx.imageSmoothingEnabled = false;
            // Debug to verify sprite positions for kept shoes
            // console.log(`Drawing kept shoe with spriteX=${spriteX}, sy=${sy} at grid (${col}, ${row})`);
            // Draw the shoe sprite
            game.ctx.drawImage(this.image, spriteX, sy, 44, 44, dx, dy, game.block, game.block);
            // Add a border with varying styles based on highlightLevel
            if (highlightLevel === 1) {
                // Slight highlight - thinner border
                game.ctx.strokeStyle = '#333';
                game.ctx.lineWidth = 1.5;
            }
            else if (highlightLevel === 2) {
                // Stronger highlight - thicker border with different color
                game.ctx.strokeStyle = '#555';
                game.ctx.lineWidth = 2;
            }
            else {
                // Default border
                game.ctx.strokeStyle = '#000';
                game.ctx.lineWidth = 1;
            }
            // Use integer pixel positions for crisp borders
            game.ctx.strokeRect(Math.floor(dx) + 0.5, Math.floor(dy) + 0.5, Math.floor(game.block) - 1, Math.floor(game.block) - 1);
        }
        catch (err) {
            console.error("Error drawing shoe with sprite X:", err, "sx:", spriteX, "sy:", sy, "sw:", 44, "sh:", 44, "dx:", dx, "dy:", dy, "dw:", game.block, "dh:", game.block);
        }
    }
}
//# sourceMappingURL=Shoes.js.map