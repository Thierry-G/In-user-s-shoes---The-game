// Common type definitions for the game
import { ShoeSide } from './Shoes.js';

// Define shared types in a central location
export interface FallingShoe {
    col: number;
    y: number;       // fractional row position
    speed: number;   // rows per second
    side: ShoeSide;  // 'left' | 'right'
    yIndex: number;  // 0..22 sprite row index
    id: string;      // identifier based on side and yIndex (e.g., 'left-12')
    value: number;   // numeric value for scoring/logic
}

export interface Effect {
    col: number; 
    rowAbs: number; 
    yIndex: number; 
    spriteX: number;
    startTime?: number; // Timestamp when the effect started
}

export interface ButtonBounds {
    x: number;
    y: number;
    w: number;
    h: number;
}

// Storage keys for persistent data
export const STORAGE_KEYS = {
    LEVEL: 'theGame.level',
    GAME_COUNT: 'theGame.gameCount'
};
