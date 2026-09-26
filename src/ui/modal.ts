import { injectStyle } from "./styles";

declare const Spicetify: any;

export function openModal(title: string, content: any, large = false): void {
	injectStyle();
	Spicetify.PopupModal.display({ title, content, isLarge: large });
}

export function closeModal(): void {
	Spicetify.PopupModal.hide();
}
