// util methods

interface ArrayConstructor extends globalThis.ArrayConstructor {
	from<T, U>(arrayLike: ArrayLike<T>, mapfn: (v: T, k: number) => U, thisArg?: any): Array<U>;
	from<T>(arrayLike: ArrayLike<T>): Array<T>;
}

interface ObjectConstructor extends globalThis.ObjectConstructor {
	assign(target: any, ...sources: any[]): any;
}


export const array_move = <T = any>(arr: T[], from: number, to: number, on: number = 1): T[] => {
	if (from === to) return arr;

	arr.splice(to, 0, ...arr.splice(from, on));

	return arr;
};


export const array_range = (start: number, stop: number, step: number): number[] =>
	(<ArrayConstructor>Array).from({ length: (stop - start) / step + 1 },
		(value, index) => start + index * step);


export const create_element = (tag: string, attrs: object): HTMLElement => attrs
	? (<ObjectConstructor>Object).assign(document.createElement(tag), attrs)
	: document.createElement(tag);


export const throttle = (func: Function, ms: number): () => void => {
	let is_throttled: boolean = false,
		saved_args: IArguments | null,
		saved_this: any;

	function wrapper(this: any) {
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
				wrapper.apply(saved_this, saved_args as any);
				saved_args = saved_this = null;
			}
		}, ms);
	}

	return wrapper;
};
