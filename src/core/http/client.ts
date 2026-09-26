import { config } from "../config";
import { createLogger } from "../log";
import { ApiError, TimeoutError } from "./errors";

const log = createLogger("http");

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

export interface RequestOptions {
	method?: string;
	headers?: Record<string, string>;
	body?: unknown;
	timeoutMs?: number;
	retries?: number;
	signal?: AbortSignal;
}

function baseUrl(): string {
	return config.api.baseUrl.replace(/\/+$/, "");
}

function resolve(path: string): string {
	return path.startsWith("http") ? path : `${baseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function retryDelay(attempt: number, response?: Response): number {
	const header = response?.headers.get("retry-after");
	if (header) {
		const seconds = Number(header);
		if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 30000);
	}
	return BASE_BACKOFF_MS * 2 ** attempt + Math.random() * 200;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parse(response: Response): Promise<unknown> {
	const type = response.headers.get("content-type") ?? "";
	if (!type.includes("json")) return await response.text();
	try {
		return await response.json();
	} catch {
		return null;
	}
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const url = resolve(path);
	const timeoutMs = options.timeoutMs ?? config.api.timeoutMs;
	const attempts = options.retries ?? MAX_ATTEMPTS;

	let lastError: unknown = null;

	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		const abort = (): void => controller.abort();
		options.signal?.addEventListener("abort", abort);

		try {
			const response = await fetch(url, {
				method: options.method ?? "GET",
				headers: {
					...(options.body ? { "Content-Type": "application/json" } : {}),
					...(options.headers ?? {}),
				},
				body: options.body ? JSON.stringify(options.body) : undefined,
				signal: controller.signal,
			});

			if (response.ok) return (await parse(response)) as T;

			const body = await parse(response);
			const error = new ApiError(response.status, `${path} failed: ${response.status}`, path, body);

			if (!error.isRetryable || attempt === attempts - 1) throw error;

			const delay = retryDelay(attempt, response);
			log.debug(`${path} -> ${response.status}, retrying in ${Math.round(delay)}ms`);
			await sleep(delay);
			lastError = error;
			continue;
		} catch (error) {
			if (error instanceof ApiError) throw error;

			const aborted = error instanceof DOMException && error.name === "AbortError";
			const wrapped = aborted ? new TimeoutError(path, timeoutMs) : error;

			if (options.signal?.aborted || attempt === attempts - 1) throw wrapped;

			const delay = retryDelay(attempt);
			log.debug(`${path} threw, retrying in ${Math.round(delay)}ms`);
			await sleep(delay);
			lastError = wrapped;
		} finally {
			clearTimeout(timer);
			options.signal?.removeEventListener("abort", abort);
		}
	}

	throw lastError ?? new ApiError(0, `${path} failed`, path);
}

export function get<T>(path: string, options?: RequestOptions): Promise<T> {
	return request<T>(path, { ...options, method: "GET" });
}

export function post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
	return request<T>(path, { ...options, method: "POST", body });
}
