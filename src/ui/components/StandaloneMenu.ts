import { h, useEffect, useState } from "../h";
import { Icon } from "../icons";

declare const Spicetify: any;

export interface MenuSpec {
	key: string;
	label: string;
	icon?: string;
	onClick?: () => void;
	disabled?: boolean;
	dividerAfter?: boolean;
	pinned?: boolean;
	searchable?: string;
	children?: MenuSpec[];
}

export interface MenuPosition {
	x: number;
	y: number;
}

const MENU_WIDTH = 260;
const ITEM_HEIGHT = 40;
const SUBMENU_MAX = 420;
const LAYER_ID = "juicevault-overlay-layer";

function overlayLayer(): HTMLElement {
	let layer = document.getElementById(LAYER_ID);
	if (!layer) {
		layer = document.createElement("div");
		layer.id = LAYER_ID;
		document.body.appendChild(layer);
	}
	const style = layer.style;
	style.setProperty("display", "block", "important");
	style.setProperty("position", "fixed", "important");
	style.setProperty("inset", "0", "important");
	style.setProperty("width", "100vw", "important");
	style.setProperty("height", "100vh", "important");
	style.setProperty("pointer-events", "none", "important");
	style.setProperty("z-index", "2147483000", "important");
	style.setProperty("visibility", "visible", "important");
	style.setProperty("opacity", "1", "important");
	return layer;
}

function place(position: MenuPosition, height: number): MenuPosition {
	return {
		x: Math.max(8, Math.min(position.x, window.innerWidth - MENU_WIDTH - 8)),
		y: Math.max(8, Math.min(position.y, window.innerHeight - height - 8)),
	};
}

function estimateHeight(items: MenuSpec[], searchable: boolean): number {
	const rows = items.length * ITEM_HEIGHT + items.filter((item) => item.dividerAfter).length * 9 + 8;
	return Math.min(searchable ? rows + 48 : rows, SUBMENU_MAX);
}

function MenuList({
	items,
	position,
	onClose,
	depth,
	searchable,
}: {
	items: MenuSpec[];
	position: MenuPosition;
	onClose: () => void;
	depth: number;
	searchable?: string;
}): any {
	const [open, setOpen] = useState<{ key: string; position: MenuPosition } | null>(null);
	const [filter, setFilter] = useState("");

	const needle = filter.trim().toLowerCase();
	const visible = needle ? items.filter((item) => item.pinned || item.label.toLowerCase().includes(needle)) : items;
	const at = place(position, estimateHeight(visible, Boolean(searchable)));

	const row = (spec: MenuSpec): any => {
		const hasChildren = Boolean(spec.children);
		const disabled = spec.disabled || (hasChildren && !spec.children!.length);

		const openChildren = (event: any): void => {
			if (!hasChildren || disabled) return;
			const rect = event.currentTarget.getBoundingClientRect();
			const right = rect.right + 2;
			const x = right + MENU_WIDTH > window.innerWidth ? rect.left - MENU_WIDTH - 2 : right;
			setOpen({ key: spec.key, position: { x, y: rect.top - 4 } });
		};

		return h(
			"li",
			{ key: spec.key, className: `main-contextMenu-menuItem jv-mi${spec.dividerAfter ? " jv-mi--divider" : ""}`, role: "presentation" },
			h(
				"button",
				{
					className: "main-contextMenu-menuItemButton jv-mi-button",
					role: "menuitem",
					tabIndex: -1,
					disabled,
					"data-open": String(open?.key === spec.key),
					"aria-haspopup": hasChildren ? "menu" : undefined,
					onMouseEnter: (event: any) => (hasChildren ? openChildren(event) : setOpen(null)),
					onClick: (event: any) => {
						event.stopPropagation();
						if (hasChildren) return openChildren(event);
						if (disabled) return;
						spec.onClick?.();
						onClose();
					},
				},
				spec.icon ? h("span", { className: "jv-mi-icon" }, Icon(spec.icon, 16)) : null,
				h("span", { className: "jv-menu-label" }, spec.label),
				hasChildren ? h("span", { className: "jv-mi-caret" }, Icon("chevron", 16)) : null,
			),
		);
	};

	const child = open ? items.find((spec) => spec.key === open.key) : null;

	return h(
		"div",
		null,
		h(
			"div",
			{
				className: "jv-standalone-menu",
				style: { position: "fixed", left: at.x, top: at.y, zIndex: 1 + depth, width: MENU_WIDTH, pointerEvents: "auto" },
				onClick: (event: any) => event.stopPropagation(),
				onContextMenu: (event: any) => event.preventDefault(),
			},
			searchable
				? h(
						"div",
						{ className: "jv-mi-search" },
						Icon("search", 16),
						h("input", {
							placeholder: searchable,
							value: filter,
							autoFocus: true,
							spellCheck: false,
							onChange: (event: any) => setFilter(event.target.value),
							onMouseEnter: () => setOpen(null),
						}),
					)
				: null,
			h(
				"ul",
				{ className: "main-contextMenu-menu jv-mi-list", role: "menu", "data-depth": depth, style: { maxHeight: SUBMENU_MAX - (searchable ? 48 : 0) } },
				visible.length ? visible.map(row) : h("li", { className: "jv-mi-empty" }, "No matches"),
			),
		),
		child?.children && open
			? h(MenuList, { items: child.children, position: open.position, onClose, depth: depth + 1, searchable: child.searchable })
			: null,
	);
}

export function StandaloneMenu({ items, position, onClose }: { items: MenuSpec[]; position: MenuPosition | null; onClose: () => void }): any {
	useEffect(() => {
		if (!position) return;

		const inside = (target: EventTarget | null): boolean =>
			target instanceof Element && Boolean(target.closest(".jv-standalone-menu, [data-jv-menu-trigger]"));

		const press = (event: PointerEvent): void => {
			if (!inside(event.target)) onClose();
		};
		const wheel = (event: WheelEvent): void => {
			if (!inside(event.target)) onClose();
		};
		const key = (event: KeyboardEvent): void => {
			if (event.key === "Escape") onClose();
		};
		const resize = (): void => onClose();

		window.addEventListener("pointerdown", press, true);
		window.addEventListener("wheel", wheel, { capture: true, passive: true });
		window.addEventListener("keydown", key);
		window.addEventListener("resize", resize);
		return () => {
			window.removeEventListener("pointerdown", press, true);
			window.removeEventListener("wheel", wheel, true);
			window.removeEventListener("keydown", key);
			window.removeEventListener("resize", resize);
		};
	}, [position]);

	if (!position) return null;
	return Spicetify.ReactDOM.createPortal(h(MenuList, { items, position, onClose, depth: 0 }), overlayLayer());
}
