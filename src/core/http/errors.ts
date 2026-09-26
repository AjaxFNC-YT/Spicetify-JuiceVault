export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly path: string,
		readonly body?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}

	get isRateLimited(): boolean {
		return this.status === 429;
	}

	get isUnauthorized(): boolean {
		return this.status === 401;
	}

	get isNotFound(): boolean {
		return this.status === 404;
	}

	get isRetryable(): boolean {
		return this.status === 429 || this.status === 0 || this.status >= 500;
	}
}

export class TimeoutError extends Error {
	constructor(readonly path: string, readonly timeoutMs: number) {
		super(`${path} timed out after ${timeoutMs}ms`);
		this.name = "TimeoutError";
	}
}

export function describeError(error: unknown, fallback: string): string {
	if (error instanceof ApiError) {
		const body = error.body as { error?: unknown; message?: unknown } | undefined;
		if (typeof body?.error === "string" && body.error) return body.error;
		if (typeof body?.message === "string" && body.message) return body.message;
		if (error.isRateLimited) return "Too many attempts. Try again in a few minutes.";
	}
	if (error instanceof TimeoutError) return "JuiceVault took too long to respond.";
	if (error instanceof Error && error.message) return error.message;
	return fallback;
}
