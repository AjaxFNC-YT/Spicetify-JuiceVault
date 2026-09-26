const CURVE_EXPONENT = 3;

export function perceivedGain(sliderValue: number, trimDb = 0): number {
	const value = Math.max(0, Math.min(1, sliderValue));
	const trim = Math.pow(10, Math.min(0, trimDb) / 20);
	return Math.pow(value, CURVE_EXPONENT) * trim;
}
