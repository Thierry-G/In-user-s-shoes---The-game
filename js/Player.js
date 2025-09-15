import { game } from './Ui.js';
// This will be set externally by the game
let boardInstance = null;
export function setBoardInstance(board) {
    boardInstance = board;
}
/**
 * Player component that draws the player character (two shoe tiles side by side)
 */
export default class Player {
    constructor() {
        this.image = null;
    }
    /**
     * Set the sprite sheet image
     */
    setImage(img) {
        this.image = img;
    }
    /**
     * Draw the player at the specified grid position
     * @param ctx - Canvas rendering context
     * @param col - Grid column (left tile)
     * @param row - Grid row
     * @param hideShoes - If true, don't render any shoes (for post-explosion state)
     */
    renderPlayer(ctx, col, row, hideShoes = false) {
        if (!ctx || !this.image || !boardInstance)
            return;
        // Ensure crisp pixel rendering
        ctx.imageSmoothingEnabled = false;
        // Calculate visual position where the player should be drawn
        // For the player position, we'll always draw at the bottom of the visible area
        // regardless of the actual game position (which may be below the visible area)
        const visibleRow = game.topReserved + game.rows - 1;
        // Get the adjusted column value
        const adjustedCol = col;
        // Draw a lighter background for the player row matching the falling shoes board size
        // Exclude first and last half columns to match board layout
        ctx.save();
        ctx.fillStyle = 'rgb(235,235,235)'; // Slightly darker gray background for player row
        // Calculate the background area: cover the game play area excluding first/last half columns
        const halfBlock = game.block * 0.5;
        const backgroundStartX = game.offsetX + halfBlock; // Start after first half column
        const backgroundWidth = game.cols * game.block; // Cover game columns only
        const backgroundY = (visibleRow * game.block) + game.offsetY;
        ctx.fillRect(backgroundStartX, backgroundY, backgroundWidth, game.block);
        ctx.restore();
        // Apply centering transform for player sprites
        ctx.save();
        ctx.translate(game.offsetX, game.offsetY);
        // Add half-column offset to account for visual layout shift (reuse halfBlock from above)
        const dx = adjustedCol * game.block + halfBlock;
        const dy = visibleRow * game.block; // Always draw at the bottom of the visible area
        // Get the current foot values from the board
        const leftFootValue = boardInstance.getLeftFootValue();
        const rightFootValue = boardInstance.getRightFootValue();
        // Left tile - use the stored left foot value if available, otherwise default player shoe
        // Only draw if it's within the visible area and shoes are not hidden
        if (adjustedCol >= 0 && adjustedCol < game.cols && !hideShoes) {
            if (leftFootValue !== null) {
                // Draw left foot with collected shoe appearance
                // Use X=0 for left foot sprite, Y=shoe index*44 for shoe type
                ctx.drawImage(this.image, 0, leftFootValue * 44, 44, 44, dx, dy, game.block, game.block);
            }
            else {
                // Draw default left player shoe (from top-left of sprite sheet)
                ctx.drawImage(this.image, 0, 0, 44, 44, dx, dy, game.block, game.block);
            }
        }
        // Right tile - use the stored right foot value if available, otherwise default player shoe
        // Only draw if it's within the visible area and shoes are not hidden
        if (adjustedCol + 1 >= 0 && adjustedCol + 1 < game.cols && !hideShoes) {
            if (rightFootValue !== null) {
                // Draw right foot with collected shoe appearance
                // Use X=44 for right foot sprite, Y=shoe index*44 for shoe type
                ctx.drawImage(this.image, 44, rightFootValue * 44, 44, 44, dx + game.block, dy, game.block, game.block);
            }
            else {
                // Draw default right player shoe (from sprite sheet X=44)
                ctx.drawImage(this.image, 44, 0, 44, 44, dx + game.block, dy, game.block, game.block);
            }
        }
        // Restore context
        ctx.restore();
    }
    /**
     * Legacy method to maintain compatibility
     * @deprecated Use renderPlayer instead
     */
    drawAtGrid(col, row, offset = 0) {
        if (!game.ctx)
            return;
        this.renderPlayer(game.ctx, col, row);
    }
}
//# sourceMappingURL=Player.js.map