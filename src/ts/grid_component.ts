import { array_move, create_element, throttle } from "./util";

type PositiveNumber<N extends number = number> = number extends N ? N : `${N}` extends "0" | `-${string}` ? never : N;

type NonnegativeNumber<N extends number = number> = number extends N ? N : `${N}` extends `-${string}` ? never : N;

type PositiveInteger<N extends number = number> = number extends N ? N : `${N}` extends "0" | `-${string}` | `${string}.${string}` ? never : N;

type NonnegativeInteger<N extends number = number> = number extends N ? N : `${N}` extends `-${string}` | `${string}.${string}` ? never : N;


export type component_options<N extends number = number> = {
	width?: NonnegativeNumber<N> // column width (if columns is used, then use fractional units instead)
	height?: NonnegativeNumber<N> // row height
	gap?: NonnegativeNumber<N> // gap between grid cells (px) to calculate proper sizes
	padding?: NonnegativeNumber<N> // padding for container (px) to calculate proper sizes
	draggable?: boolean | "single" | "multiple" // support dragging grid cells, when table is used - drag rows
}

export type drop_ctx_type<N extends number = number> = {
	draggable: boolean | "single" | "multiple"
	placeholder: HTMLElement
	added: boolean
	origin: HTMLElement | null // | EventTarget
	origin_pos: {
		ncols: PositiveInteger<N>
		nrows: PositiveInteger<N>
		row: NonnegativeInteger<N>
	}
	at_start: boolean
	at_end: boolean
	drag_scroll_throttle: ((direction: boolean) => void) | null
}


/* component for grid container
	* root - target Element
	* data - data array for render callback (any)
	* render_callback - render function, should accept data from elements and return Element
	* options - an object with sizes styles {width: 200, height: 100, gap: 10, padding: 10} for correct size calculations, as well as enable drag-and-drop support {draggable: true}
	? returns { reflow } - a method for updating dynamic data (e.g. for infinite scrolling)
*/
const component = <N extends number = number>(root: HTMLElement, data: any[], render_callback: Function, options: component_options<N>): { reflow: () => void } => {
	const content = create_element("div", { classList: "content" }),
		wrap = create_element("div", { classList: "wrap" }),
		scrollbar = create_element("div", { classList: "scrollbar" }),
		scrollbar_thumb = create_element("div", { classList: "scrollbar-thumb" }),

		gwidth = options?.width ?? 200,
		gheight = options?.height ?? 100,
		ggap = options?.gap ?? 10,
		wpad = options?.padding ?? 10,

		drop_ctx: drop_ctx_type = {
			draggable: options?.draggable ?? false,
			placeholder: create_element("div", { classList: "drop-placeholder" }),
			added: false,
			origin: null,
			origin_pos: { ncols: 1, nrows: 1, row: 0 },
			at_start: true,
			at_end: false,
			drag_scroll_throttle: null
		};

	scrollbar.appendChild(scrollbar_thumb);
	content.appendChild(wrap);
	content.appendChild(scrollbar);

	root.appendChild(content);

	let wwidth: number = wrap.clientWidth - wpad * 2,
		ncols: number = Math.max(Math.floor((wwidth + ggap) / (gwidth + ggap)), 1),
		_nrows: number = (window.innerHeight - ggap) / (gheight + ggap),
		nrows: PositiveInteger = Math.ceil(_nrows),
		row: NonnegativeInteger = 0,
		total: NonnegativeInteger = data.length,
		max_row: PositiveInteger = Math.ceil(total / ncols - _nrows),
		thumb_height: NonnegativeInteger = 0;

	// ? container filler methods

	const clear_wrap = (): void => {
		while (wrap.firstChild) wrap.lastChild?.remove();
	};

	const fill_wrap = (start: NonnegativeInteger, stop: NonnegativeInteger, clear: boolean = false, at_start: boolean = false): void => {
		if (start < 0) start = 0;
		if (stop > total) stop = total;

		const frag = document.createDocumentFragment();

		if (drop_ctx.draggable) data.slice(start, stop).forEach((el_data, idx) => frag.appendChild(apply_drag(render_callback(el_data, idx, data), start + idx)));
		else data.slice(start, stop).forEach((el_data, idx) => frag.appendChild(render_callback(el_data, idx, data)));

		if (clear) clear_wrap();
		if (at_start) wrap.insertBefore(frag, wrap.firstChild);
		else wrap.appendChild(frag);
	};

	const calc_scrollbar_thumb_height = (els: NonnegativeInteger): NonnegativeInteger =>
		thumb_height = Math.max(4, Math.min(els / total * 100, 100));

	const calc_scrollbar = (_e?: Event): void => {
		const pos = Math.max(0, Math.min(ncols * row / total * (100.1 - calc_scrollbar_thumb_height(ncols * (nrows - 1))), 100));

		scrollbar.style.setProperty("--scrollbar-thumb-height", `${thumb_height}%`);
		scrollbar.style.setProperty("--scrollbar-position", `${pos}%`);

		if (thumb_height === 100) scrollbar.classList.add("hidden")
		else if (scrollbar.classList.contains("hidden")) scrollbar.classList.remove("hidden");
	};

	// ? window resize event

	const on_resize = (_e?: Event): void => {
		const oldcols = ncols,
			oldrows = nrows;

		wwidth = wrap.clientWidth - wpad * 2;
		ncols = Math.floor((wwidth + ggap) / (gwidth + ggap));
		_nrows = (window.innerHeight - ggap) / (gheight + ggap);
		nrows = Math.ceil(_nrows);
		max_row = Math.ceil(total / ncols - _nrows);

		if (oldcols === ncols && oldrows === nrows) return;

		if (row > max_row) row = max_row;

		if (oldcols !== ncols) {
			fill_wrap(ncols * row, ncols * row + nrows * ncols, true);
		} else if (oldrows < nrows) {
			fill_wrap(ncols * row + ncols * oldrows, ncols * row + ncols * oldrows + ncols * (nrows - oldrows));
		} else {
			const els = wrap.children.length - nrows * ncols;
			if (els > 0) for (let i = 0; i < els; i++) wrap.lastChild?.remove();
		}

		calc_scrollbar();

		if (drop_ctx.draggable) drop_scroll_update();
	};

	// ? mouse wheel scroll

	const on_scroll = (e: WheelEvent): void => {
		if (e.deltaY === 0) return;

		const direction = e.deltaY > 0;

		if (direction && row < max_row) {
			row += 1;

			fill_wrap(ncols * (row + nrows - 1), ncols * (row + nrows));

			for (let i = 0; i < ncols; i++) wrap.firstChild?.remove();
		} else if (!direction && row > 0) {
			row -= 1;

			fill_wrap(ncols * row, ncols * row + ncols, false, true);

			const els = wrap.children.length - nrows * ncols;
			if (els > 0) for (let i = 0; i < els; i++) wrap.lastChild?.remove();
		}

		calc_scrollbar();

		if (drop_ctx.draggable) drop_scroll_update();
	};

	// ? scrollbar mouse & touch

	const on_pointermove = (e: PointerEvent): void => {
		if (e.buttons === 0) {
			window.removeEventListener("pointermove", on_pointermove, true);
			window.removeEventListener("pointerup", on_pointerup, true);
			return;
		}

		const step = ncols / total * 100,
			pos = Math.max(0, Math.min(Math.ceil((e.y / window.innerHeight * (100) - calc_scrollbar_thumb_height(ncols * nrows) / 2) / step) * step, 100)),
			new_row = Math.min(
				Math.round(
					Math.max(0,
						Math.min(
							Math.ceil(
								(e.y / window.innerHeight * (100 + thumb_height) - thumb_height / 2) / step
							) * step,
							100))
					/ step),
				max_row);

		if (row === new_row) return;
		scrollbar.style.setProperty("--scrollbar-position", `${pos}%`);
		row = new_row;

		fill_wrap(ncols * row, ncols * row + nrows * ncols, true);

		if (drop_ctx.draggable) drop_scroll_update();
	};

	const on_pointerup = (e: PointerEvent): void => {
		window.removeEventListener("pointermove", on_pointermove, true);
		window.removeEventListener("pointerup", on_pointerup, true);
	};

	const on_pointerdown = (e: PointerEvent): void => {
		const step = ncols / total * 100,
			pos = Math.max(0, Math.min(Math.ceil((e.y / window.innerHeight * (100) - calc_scrollbar_thumb_height(ncols * nrows) / 2) / step) * step, 100)),
			new_row = Math.min(
				Math.round(
					Math.max(0,
						Math.min(
							Math.ceil(
								(e.y / window.innerHeight * (100 + thumb_height) - thumb_height / 2) / step
							) * step,
							100))
					/ step),
				max_row);

		window.addEventListener("pointerup", on_pointerup, true);
		window.addEventListener("pointermove", on_pointermove, true);

		if (row === new_row) return;
		scrollbar.style.setProperty("--scrollbar-position", `${pos}%`);
		row = new_row;

		fill_wrap(ncols * row, ncols * row + nrows * ncols, true);
	};

	// ? touch events

	const on_touch_scroll_move = (e: PointerEvent): void => {
		const els_per_page = nrows * ncols,
			thumb_height = Math.max(4, Math.min(els_per_page / total * 100, 100)),
			step = ncols / total * 100,
			pos = Math.max(0, Math.min(Math.ceil((e.y / window.innerHeight * (100) - thumb_height / 2) / step) * step, 100)),
			new_row = Math.min(
				Math.round(
					Math.max(0,
						Math.min(
							Math.ceil(
								(e.y / window.innerHeight * (100 + thumb_height) - thumb_height / 2) / step
							) * step,
							100))
					/ step),
				max_row);

		if (row === new_row) return;
		scrollbar.style.setProperty("--scrollbar-position", `${pos}%`);
		row = new_row;

		fill_wrap(ncols * row, ncols * row + nrows * ncols, true);

		if (drop_ctx.draggable) drop_scroll_update();
	};

	const on_touch_scroll_up = (e: PointerEvent): void => {
		wrap.removeEventListener("pointermove", on_touch_scroll_move, true);
		wrap.removeEventListener("pointerup", on_touch_scroll_up, true);
	};

	const on_touch_scroll_down = (e: PointerEvent): void => {
		if (e.pointerType !== "touch") return;

		wrap.addEventListener("pointerup", on_touch_scroll_up, true);
		wrap.addEventListener("pointermove", on_touch_scroll_move, true);
	};

	// ? drag-and-drop

	const on_drag_start = (e: DragEvent): void => {
		const t = e.target as HTMLElement | null,
			dt = e.dataTransfer as DataTransfer;
		if (!t) return;

		dt.setData("text/html", t.outerHTML);
		const index = +(t.dataset?.dataid ?? 0);
		dt.setData("application/json", JSON.stringify({ data: data?.[index], index }));

		dt.dropEffect = "move";
		dt.effectAllowed = "move";

		setTimeout(() => {
			t.classList.add("hidden");
			t.before(drop_ctx.placeholder);
			drop_ctx.added = true;
			drop_ctx.origin = t;
			drop_ctx.origin_pos.ncols = ncols;
			drop_ctx.origin_pos.nrows = nrows;
			drop_ctx.origin_pos.row = row;
		});
	};

	const on_drag_end = (e: DragEvent): void => {
		(e.target as HTMLElement | null)?.classList.remove("hidden");
		drag_cleanup();
	};

	const drag_scroll = (direction: boolean): void => {
		if (direction && row < max_row) {
			row += 1;

			fill_wrap(ncols * (row + nrows - 1), ncols * (row + nrows));

			for (let i = 0; i < ncols; i++) wrap.firstChild?.remove();
		} else if (!direction && row > 0) {
			row -= 1;

			fill_wrap(ncols * row, ncols * row + ncols, false, true);

			const els: number = wrap.children.length - nrows * ncols;
			if (els > 0) for (let i = 0; i < els; i++) wrap.lastChild?.remove();
		}

		calc_scrollbar();

		if (drop_ctx.draggable) drop_scroll_update();
	};

	const on_drag_over = (e: DragEvent): void => {
		e.preventDefault();
		(e.dataTransfer as DataTransfer).dropEffect = "move";

		if (e.y < 55) drop_ctx.drag_scroll_throttle?.(false);
		else if (e.y > window.innerHeight - 55) drop_ctx.drag_scroll_throttle?.(true);

		const drop_el = get_parent_item(e.target as HTMLElement | null); // get_el_from_coords(e.x, e.y);
		if (!drop_el) return;

		const drop_before_or_after = e.x > drop_el.offsetWidth / 2 + drop_el.offsetLeft,
			sibling: Element | null | undefined = drop_before_or_after
				? (drop_el.nextElementSibling !== drop_ctx.origin ? drop_el.nextElementSibling : drop_el.nextElementSibling?.nextElementSibling)
				: (drop_el.previousElementSibling !== drop_ctx.origin ? drop_el.previousElementSibling : drop_el.previousElementSibling?.previousElementSibling),
			placeholder_pos_compare = sibling === drop_ctx.placeholder;

		if (!placeholder_pos_compare && !drop_before_or_after) drop_el.before(drop_ctx.placeholder);
		else if (!placeholder_pos_compare && drop_before_or_after) drop_el.after(drop_ctx.placeholder);
		drop_ctx.placeholder.dataset.dataid = drop_el.dataset.dataid;
	};

	const on_drop = (e: DragEvent): void => {
		e.preventDefault();
		(e.dataTransfer as DataTransfer).dropEffect = "move";

		const drop_el = get_parent_item(e.target as HTMLElement | null) ?? drop_ctx.placeholder; // get_el_from_coords(e.x, e.y);
		if (!drop_el) {
			drag_cleanup();
			return;
		}

		const drop_before_or_after = e.x > drop_el.offsetWidth / 2 + drop_el.offsetLeft,
			drag_data = JSON.parse(e.dataTransfer?.getData("application/json") ?? "{}"),
			drag_idx = drag_data.index,
			drop_idx = +(drop_el.dataset.dataid ?? 0),
			is_same_idx = drop_before_or_after ? drag_idx === drop_idx + 1 : drag_idx === drop_idx - 1,
			drag_idx_outbound = (drop_idx < drop_ctx.origin_pos.ncols * drop_ctx.origin_pos.row) || (drop_idx > drop_ctx.origin_pos.ncols * drop_ctx.origin_pos.row + drop_ctx.origin_pos.nrows * drop_ctx.origin_pos.ncols);
		// el = apply_drag(render_callback(drag_data?.data), drag_data.index);

		if (!is_same_idx && drop_ctx.origin) {
			if (!drop_before_or_after) drop_el.before(drop_ctx.origin);
			else drop_el.after(drop_ctx.origin);

			// [data[drop_idx], data[drag_idx]] = [data[drag_idx], data[drop_idx]];
			array_move(data, drag_idx, drop_idx);

			// if (drag_idx_outbound && drop_ctx.origin_pos.row > row) wrap.lastChild.remove();
			if (drag_idx_outbound && drop_ctx.origin_pos.row < row) wrap.firstChild?.remove();
		}

		drag_cleanup();
		if (!is_same_idx) drop_fix_indexes(drag_idx, drop_idx);
	};

	const apply_drag = (el: HTMLElement, index: NonnegativeInteger): HTMLElement => {
		el.draggable = true;
		el.dataset.dataid = index as any;
		el.addEventListener("dragstart", on_drag_start);
		el.addEventListener("dragend", on_drag_end);

		return el;
	};

	const drop_scroll_update = (): void => {
		if (row === 0 && row === max_row) {
			drop_ctx.at_start = true;
			drop_ctx.at_end = true;
		} else if (row === 0) drop_ctx.at_start = true;
		else if (row === max_row) drop_ctx.at_end = true;
		else {
			drop_ctx.at_start = false;
			drop_ctx.at_end = false;
		}
	};

	const drop_fix_indexes = (drag_idx: NonnegativeInteger, drop_idx: NonnegativeInteger): void => {
		const idx_min: NonnegativeInteger = Math.min(drag_idx, drop_idx),
			idx_max: NonnegativeInteger = Math.max(drag_idx, drop_idx),
			slice = [...(wrap.children as any)].filter((el: any): boolean => (+el.dataset.dataid >= idx_min) && (+el.dataset.dataid <= idx_max)) as HTMLElement[];
		let idx = idx_min;

		for (let el of slice) el.dataset.dataid = idx++ as any;
	};

	const drag_cleanup = (): void => {
		if (!drop_ctx.added) return;

		drop_ctx.placeholder.remove();
		drop_ctx.added = false;
		drop_ctx.origin?.classList.remove("hidden");
		drop_ctx.origin = null;
		drop_ctx.origin_pos.ncols = ncols;
		drop_ctx.origin_pos.nrows = nrows;
		drop_ctx.origin_pos.row = row;
	};

	const get_parent_item = (el?: HTMLElement | null): HTMLElement | undefined => {
		if (el === wrap || el === undefined || el === null) return;
		if (el.parentElement === wrap) return el;

		return get_parent_item(el?.parentElement);
	};

	const get_el_from_coords = (x: number, y: number): HTMLElement | undefined => {
		const els = (document.elementsFromPoint(x, y) as any).toReversed() as HTMLElement[];
		let next: boolean = false;

		for (let el of els) {
			if (next) return el;
			if (el === wrap) next = true;
		}
	};

	// ? reflow

	const reflow = (): void => {
		total = data.length;
		max_row = Math.ceil(total / ncols - _nrows);
		fill_wrap(ncols * row, ncols * row + nrows * ncols, true);
	};

	// ? init component

	fill_wrap(0, nrows * ncols);
	calc_scrollbar();

	window.addEventListener("resize", on_resize);
	window.addEventListener("wheel", on_scroll);
	scrollbar.addEventListener("pointerdown", on_pointerdown, true);
	wrap.addEventListener("pointerdown", on_touch_scroll_down, true);

	if (drop_ctx.draggable) {
		wrap.addEventListener("dragover", on_drag_over);
		wrap.addEventListener("drop", on_drop);
		drop_ctx.drag_scroll_throttle = throttle(drag_scroll, 400);
	}

	return { reflow };
};

export default component;
