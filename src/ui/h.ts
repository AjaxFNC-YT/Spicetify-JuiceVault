declare const Spicetify: any;

export function h(type: any, props?: any, ...children: any[]): any {
	return Spicetify.React.createElement(type, props ?? null, ...children);
}

export function useState<T>(initial: T | (() => T)): [T, (value: T | ((previous: T) => T)) => void] {
	return Spicetify.React.useState(initial);
}

export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void {
	Spicetify.React.useEffect(effect, deps);
}

export function useMemo<T>(factory: () => T, deps: unknown[]): T {
	return Spicetify.React.useMemo(factory, deps);
}

export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: unknown[]): T {
	return Spicetify.React.useCallback(callback, deps);
}

export function native(): any {
	return Spicetify.ReactComponent ?? {};
}

export function notify(message: string, isError = false): void {
	Spicetify.showNotification(message, isError);
}
