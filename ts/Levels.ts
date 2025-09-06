export interface LevelConfig {
	totalShoes: number; // how many falling shoes concurrently
	speedMin: number;   // rows per second (minimum)
	speedMax: number;   // rows per second (maximum)
	targetPairs: number; // desired pairs metric (informational)
}

export default class Levels {
	// Progressive difficulty based on level
	static get(level: number, cols: number): LevelConfig {
		// Progressive difficulty based on level
		// Base shoes: 4 at level 1, 6 at level 2, then +1 for each additional level
		const baseShoes = level === 1 ? 4 : (level === 2 ? 6 : 6 + (level - 2) * 2);

		// Ensure we don't exceed reasonable limits
		const totalShoes = Math.min(Math.max(baseShoes, 4), cols * 2);

		// Speed increases at each level
		const baseSpeedMin = 0.5;
		const baseSpeedMax = 1.2;
		const speedMin = baseSpeedMin + (level - 1) * 0.1;
		const speedMax = baseSpeedMax + (level - 1) * 0.15;

		return {
			totalShoes: totalShoes,
			speedMin: speedMin,
			speedMax: speedMax,
			targetPairs: Math.max(3, Math.floor(totalShoes / 2))
		};
	}
}
