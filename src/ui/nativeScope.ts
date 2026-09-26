import { h } from "./h";

declare const Spicetify: any;

const CONTEXT_PROVIDER = 10;

interface Provider {
	type: any;
	value: unknown;
}

let nativeMenusFailed = false;

function fiberOf(element: Element): any {
	const key = Object.keys(element).find((name) => name.startsWith("__reactFiber$") || name.startsWith("__reactInternalInstance$"));
	return key ? (element as any)[key] : null;
}

function providersAbove(anchor: Element | null): Provider[] {
	let fiber: any = null;
	for (let node = anchor; node && !fiber; node = node.parentElement) fiber = fiberOf(node);

	const providers: Provider[] = [];
	for (let current = fiber; current; current = current.return) {
		if (current.tag === CONTEXT_PROVIDER && current.type) providers.push({ type: current.type, value: current.memoizedProps?.value });
	}
	return providers.reverse();
}

export function NativeScope({ anchor, children }: { anchor: Element | null; children?: any }): any {
	const providers = providersAbove(anchor);
	return providers.reduceRight((inner, provider) => h(provider.type, { value: provider.value }, inner), children ?? null);
}

export function nativeMenusAvailable(): boolean {
	return !nativeMenusFailed && Boolean(Spicetify.ReactComponent?.TrackMenu && Spicetify.ReactComponent?.ContextMenu);
}

let boundary: any = null;

export function NativeFallback(): any {
	if (boundary) return boundary;

	boundary = class extends Spicetify.React.Component {
		state = { failed: false };

		static getDerivedStateFromError(): { failed: boolean } {
			nativeMenusFailed = true;
			return { failed: true };
		}

		componentDidCatch(error: unknown): void {
			console.warn("[JV] native menu unavailable here, using the JuiceVault menu", error);
		}

		render(): any {
			return this.state.failed ? this.props.fallback() : this.props.children;
		}
	};
	return boundary;
}
