// util methods

export const array_move = (arr, from, to, on = 1) => {
	if (from === to) return arr;

	arr.splice(to, 0, ...arr.splice(from, on));

	return arr;
};


export const array_range = (start, stop, step) =>
	Array.from({ length: (stop - start) / step + 1 },
		(value, index) => start + index * step);


export const create_element = (tag, attrs) => attrs
	? Object.assign(document.createElement(tag), attrs)
	: document.createElement(tag);


export const throttle = (func, ms) => {
	let is_throttled = false,
		saved_args,
		saved_this;

	function wrapper() {
		if (is_throttled) {
			saved_args = arguments;
			saved_this = this;
			return;
		}

		func.apply(this, arguments);

		is_throttled = true;

		setTimeout(() => {
			is_throttled = false;
			if (saved_args) {
				wrapper.apply(saved_this, saved_args);
				saved_args = saved_this = null;
			}
		}, ms);
	}

	return wrapper;
};
