declare namespace Spicetify {
	const Platform: any;
	const Player: any;
	const CosmosAsync: any;
	const GraphQL: any;
	const LocalStorage: {
		get(key: string): string | null;
		set(key: string, value: string): void;
		remove(key: string): void;
	};
	function showNotification(text: string, isError?: boolean, msTimeout?: number): void;
}

interface Window {
	JuiceVault?: unknown;
}
