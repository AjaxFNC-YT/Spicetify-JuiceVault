import { injectStyle } from "./styles";

declare const Spicetify: any;

const MODAL = ".GenericModal";
const WAIT_STEP_MS = 1500;

export function openModal(title: string, content: any, large = false): void {
	injectStyle();
	Spicetify.PopupModal.display({ title, content, isLarge: large });
}

export function closeModal(): void {
	Spicetify.PopupModal.hide();
}

export function isModalOpen(): boolean {
	return Boolean(document.querySelector(MODAL));
}

export function whenNoModal(): Promise<void> {
	return new Promise((resolve) => {
		const check = (): void => {
			if (isModalOpen()) window.setTimeout(check, WAIT_STEP_MS);
			else resolve();
		};
		check();
	});
}
