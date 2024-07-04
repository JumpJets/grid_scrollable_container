import component, { component_options } from "./grid_component";
import { array_range, create_element } from "./util";

// ? Example of creating component

const render_item_callback = (el_data: string, idx: number, data_arr: string[]): HTMLElement => {
	// ? Your item render method here
	return create_element("div", { classList: "item", innerText: el_data });

	// ? Editable example:
	// return create_element("textarea", {
	// 	classList: "item", innerText: el_data, oninput: (e) => {
	// 		data_arr[idx] = e.target.value;
	// 	}, style: "resize: none; line-height: 1;"
	// });
};

// ? Your data for items
const my_data: string[] = array_range(1, 10000, 1).map(i => `Element ${i}`),
	// ? Item sizes (should be same as in CSS styles)
	options: component_options = { width: 200, height: 100, gap: 10, padding: 10, draggable: true };

component(document.body, my_data, render_item_callback, options);

// ? Dynamic example using reflow() return method
// const { reflow } = component(document.body, data, render_item_callback, options);

// data.unshift("Test");
// reflow();
