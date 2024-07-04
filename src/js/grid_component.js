import { array_move, create_element, throttle } from "./util.js";

/* component for grid container
	* root - target Element
	* data - data array for render callback (any)
	* render_callback - render function, should accept data from elements and return Element
	* options - an object with sizes styles {width: 200, height: 100, gap: 10, padding: 10} for correct size calculations, as well as enable drag-and-drop support {draggable: true}
	? returns { reflow } - a method for updating dynamic data (e.g. for infinite scrolling)
*/
const component = (root, data, render_callback, options) => {
	const content = create_element("div", { classList: "content" }),
		wrap = create_element("div", { classList: "wrap" }),
		scrollbar = create_element("div", { classList: "scrollbar" }),
		scrollbar_thumb = create_element("div", { classList: "scrollbar-thumb" }),

		gwidth = options?.width ?? 200,
		gheight = options?.height ?? 100,
		ggap = options?.gap ?? 10,
		wpad = options?.padding ?? 10,

		draggable = options?.draggable ?? false,
		drop_ctx = draggable ? {
			placeholder: create_element("div", { classList: "drop-placeholder" }),
			added: false,
			origin: null,
			origin_pos: { ncols: 0, nrows: 0, row: 0 },
			at_start: true,
			at_end: false,
			drag_scroll_throttle: null
		} : {};

	scrollbar.appendChild(scrollbar_thumb);
	content.appendChild(wrap);
	content.appendChild(scrollbar);

	root.appendChild(content);

	let wwidth = wrap.clientWidth - wpad * 2,
		ncols = Math.max(Math.floor((wwidth + ggap) / (gwidth + ggap)), 1),
		_nrows = (window.innerHeight - ggap) / (gheight + ggap),
		nrows = Math.ceil(_nrows),
		row = 0,
		total = data.length,
		max_row = Math.ceil(total / ncols - _nrows),
		thumb_height = 0;

	// ? container filler methods

	const clear_wrap = () => {
		while (wrap.firstChild) wrap.lastChild.remove();
	};

	const fill_wrap = (start, stop, clear = false, at_start = false) => {
		if (start < 0) start = 0;
		if (stop > total) stop = total;

		const frag = document.createDocumentFragment();

		if (draggable) data.slice(start, stop).forEach((el_data, idx) => frag.appendChild(apply_drag(render_callback(el_data, idx, data), start + idx)));
		else data.slice(start, stop).forEach((el_data, idx) => frag.appendChild(render_callback(el_data, idx, data)));

		if (clear) clear_wrap();
		if (at_start) wrap.insertBefore(frag, wrap.firstChild);
		else wrap.appendChild(frag);
	};

	const calc_scrollbar_thumb_height = (els) =>
		thumb_height = Math.max(4, Math.min(els / total * 100, 100));

	const calc_scrollbar = (e) => {
		const pos = Math.max(0, Math.min(ncols * row / total * (100.1 - calc_scrollbar_thumb_height(ncols * (nrows - 1))), 100));

		scrollbar.style.setProperty("--scrollbar-thumb-height", `${thumb_height}%`);
		scrollbar.style.setProperty("--scrollbar-position", `${pos}%`);

		if (thumb_height === 100) scrollbar.classList.add("hidden")
		else if (scrollbar.classList.contains("hidden")) scrollbar.classList.remove("hidden");
	};

	// ? window resize event

	const on_resize = (e) => {
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

		if (draggable) drop_scroll_update();
	};

	// ? mouse wheel scroll

	const on_scroll = (e) => {
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

		if (draggable) drop_scroll_update();
	};

	// ? scrollbar mouse & touch

	const on_pointermove = (e) => {
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

		if (draggable) drop_scroll_update();
	};

	const on_pointerup = (e) => {
		window.removeEventListener("pointermove", on_pointermove, true);
		window.removeEventListener("pointerup", on_pointerup, true);
	};

	const on_pointerdown = (e) => {
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

		window.addEventListener("pointerup", on_pointerup, true);
		window.addEventListener("pointermove", on_pointermove, true);

		if (row === new_row) return;
		scrollbar.style.setProperty("--scrollbar-position", `${pos}%`);
		row = new_row;

		fill_wrap(ncols * row, ncols * row + nrows * ncols, true);
	};

	// ? touch events

	const on_touch_scroll_move = (e) => {
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

		if (draggable) drop_scroll_update();
	};

	const on_touch_scroll_up = (e) => {
		wrap.removeEventListener("pointermove", on_touch_scroll_move, true);
		wrap.removeEventListener("pointerup", on_touch_scroll_up, true);
	};

	const on_touch_scroll_down = (e) => {
		if (e.pointerType !== "touch") return;

		wrap.addEventListener("pointerup", on_touch_scroll_up, true);
		wrap.addEventListener("pointermove", on_touch_scroll_move, true);
	};

	// ? drag-and-drop

	const on_drag_start = (e) => {
		const t = e.target,
			dt = e.dataTransfer;
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

	const on_drag_end = (e) => {
		e.target?.classList.remove("hidden");
		drag_cleanup();
	};

	const drag_scroll = (direction) => {
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

		if (draggable) drop_scroll_update();
	};

	const on_drag_over = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";

		if (e.y < 55) drop_ctx.drag_scroll_throttle?.(false);
		else if (e.y > window.innerHeight - 55) drop_ctx.drag_scroll_throttle?.(true);

		const drop_el = get_parent_item(e.target); // get_el_from_coords(e.x, e.y);
		if (!drop_el) return;

		const drop_before_or_after = e.x > drop_el.offsetWidth / 2 + drop_el.offsetLeft,
			sibling = drop_before_or_after
				? (drop_el.nextElementSibling !== drop_ctx.origin ? drop_el.nextElementSibling : drop_el.nextElementSibling?.nextElementSibling)
				: (drop_el.previousElementSibling !== drop_ctx.origin ? drop_el.previousElementSibling : drop_el.previousElementSibling?.previousElementSibling),
			placeholder_pos_compare = sibling === drop_ctx.placeholder;

		if (!placeholder_pos_compare && !drop_before_or_after) drop_el.before(drop_ctx.placeholder);
		else if (!placeholder_pos_compare && drop_before_or_after) drop_el.after(drop_ctx.placeholder);
		drop_ctx.placeholder.dataset.dataid = drop_el.dataset.dataid;
	};

	const on_drop = (e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";

		const drop_el = get_parent_item(e.target) ?? drop_ctx.placeholder; // get_el_from_coords(e.x, e.y);
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

	const apply_drag = (el, index) => {
		el.draggable = true;
		el.dataset.dataid = index;
		el.addEventListener("dragstart", on_drag_start);
		el.addEventListener("dragend", on_drag_end);

		return el;
	};

	const drop_scroll_update = () => {
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

	const drop_fix_indexes = (drag_idx, drop_idx) => {
		const idx_min = Math.min(drag_idx, drop_idx),
			idx_max = Math.max(drag_idx, drop_idx),
			slice = [...wrap.children].filter(el => (+el.dataset.dataid >= idx_min) && (+el.dataset.dataid <= idx_max));
		let idx = idx_min;

		for (let el of slice) el.dataset.dataid = idx++;
	};

	const drag_cleanup = () => {
		if (!drop_ctx.added) return;

		drop_ctx.placeholder.remove();
		drop_ctx.added = false;
		drop_ctx.origin?.classList.remove("hidden");
		drop_ctx.origin = null;
		drop_ctx.origin_pos.ncols = ncols;
		drop_ctx.origin_pos.nrows = nrows;
		drop_ctx.origin_pos.row = row;
	};

	const get_parent_item = (el) => {
		if (el === wrap || el === undefined || el === null) return;
		if (el.parentElement === wrap) return el;

		return get_parent_item(el?.parentElement);
	};

	const get_el_from_coords = (x, y) => {
		const els = document.elementsFromPoint(x, y).toReversed();
		let next = false;

		for (let el of els) {
			if (next) return el;
			if (el === wrap) next = true;
		}
	};

	// ? reflow

	const reflow = () => {
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

	if (draggable) {
		wrap.addEventListener("dragover", on_drag_over);
		wrap.addEventListener("drop", on_drop);
		drop_ctx.drag_scroll_throttle = throttle(drag_scroll, 400);
	}

	return { reflow };
};

export default component;
