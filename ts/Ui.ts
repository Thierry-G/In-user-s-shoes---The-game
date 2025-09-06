/**
 * Global game state and configuration
 */
export const game = {
    ctx: null as CanvasRenderingContext2D | null,
    pict: null as HTMLImageElement | null,
    width: 0,
    height: 0,
    cols: 0,
    rows: 0,
    topReserved: 0,
    bottomReserved: 0,
    block: 44, // Default block size, adjust as needed
    offsetX: 0, // Horizontal offset for centering
    offsetY: 0, // Vertical offset for centering,
    earlyCollisionDetection: false, // Option to enable/disable early collision detection (4 rows before)
    collisionOffset: 4, // Number of rows before the player where collisions are detected (when enabled)
    get tileSize() { return this.block; } // Alias for block size
};

/**
 * UI Manager - handles canvas setup, responsiveness, and input configuration
 */

export class Ui {
    main: HTMLElement;
    canvas: HTMLCanvasElement;
    pict: string | HTMLImageElement | null = null;
    ctx: CanvasRenderingContext2D | null = null;
    
    /**
     * Initialize the UI with a canvas
     * @param canvasId - The ID of the canvas element
     */
    constructor(canvasId: string) {
        // Get HTML element for sizing
        const mainElement = document.querySelector("html");
        if (!mainElement) {
            throw new Error('Main HTML element not found');
        }
        this.main = mainElement;
        
        // Get canvas element
        const canvasElement = document.getElementById(canvasId);
        if (!(canvasElement instanceof HTMLCanvasElement)) {
            throw new Error(`Canvas element with id '${canvasId}' not found or is not a canvas.`);
        }
        this.canvas = canvasElement;
        
        // Configure touch behavior
        this.setupTouchBehavior();
        
        // Get 2D context
        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context from canvas.");
        }
        
        // Configure context
        ctx.imageSmoothingEnabled = false; // Crisp pixel art rendering
        this.ctx = ctx; // Set the instance property
        game.ctx = ctx; // Also set the global reference
        
        // Initialize responsive layout
        this.init();
    }
    
    /**
     * Configure touch behavior for mobile devices
     */
    private setupTouchBehavior() {
        this.canvas.style.touchAction = 'none';
        // @ts-ignore - older engines
        (this.canvas.style as any).msTouchAction = 'none';
        this.canvas.style.userSelect = 'none';
        // @ts-ignore - Safari
        (this.canvas.style as any).webkitUserSelect = 'none';
    }
    /**
     * Initialize the game grid based on available screen space
     */
    init() {
        const availableWidth = this.main.clientWidth;
        const availableHeight = this.main.clientHeight;

        // Always use the actual viewport size
        game.width = availableWidth;
        game.height = availableHeight;

        // Determine optimal columns based on screen size
        let desiredCols: number;
        if (availableWidth <= 400) desiredCols = 6;        // very small phones
        else if (availableWidth <= 600) desiredCols = 8;   // small phones
        else if (availableWidth <= 900) desiredCols = 10;  // phones/tablets
        else desiredCols = 12;                             // larger screens
        
        // Compute block size from desired columns with a minimum size
        game.block = Math.max(40, Math.floor(availableWidth / desiredCols));

        // Calculate total grid dimensions
        const totalCols = Math.max(3, Math.floor(game.width / game.block));
        const totalRows = Math.max(5, Math.floor(game.height / game.block));
        
        // Set canvas dimensions to match the available space
        this.canvas.width = availableWidth;
        this.canvas.height = availableHeight;
        
        // Reserve one column on the right for messages
        game.cols = Math.max(1, totalCols - 1);
        
        // Split reserved rows between top and bottom
        game.topReserved = 3;
        game.bottomReserved = 1;
        game.rows = Math.max(1, totalRows - (game.topReserved + game.bottomReserved));
        
        // Calculate the actual game play area dimensions (including right column)
        const gamePlayWidth = game.cols * game.block;
        const rightColumnWidth = game.block; // Reserved right column
        const totalGameWidth = gamePlayWidth + rightColumnWidth; // Total width needed for game + right column
        const boardHeight = (game.topReserved + game.rows + game.bottomReserved) * game.block;
        
        // Center the board and then shift right by half a column for symmetry
        const halfColumn = game.block * 0.5;
        game.offsetX = Math.floor((availableWidth - totalGameWidth) / 2) + halfColumn;
        game.offsetY = Math.floor((availableHeight - boardHeight) / 2);
        
        // Ensure offsets are non-negative and board fits within canvas
        game.offsetX = Math.max(0, Math.min(game.offsetX, availableWidth - totalGameWidth));
        game.offsetY = Math.max(0, game.offsetY);
        
        // Apply CSS for centering the canvas itself
        this.canvas.style.display = 'block';
        this.canvas.style.margin = '0 auto';
    }
}