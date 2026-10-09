const DEFAULT_TIMEOUT_MS = 4000;

export function loadImage(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const image = new Image();
		const timer = window.setTimeout(() => finish(null), timeoutMs);
		function finish(result: HTMLImageElement | null): void {
			window.clearTimeout(timer);
			image.onload = image.onerror = null;
			resolve(result);
		}
		image.crossOrigin = "anonymous";
		image.onload = () => finish(image.naturalWidth ? image : null);
		image.onerror = () => finish(null);
		image.src = url;
	});
}
