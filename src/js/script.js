import component from "./grid_component.js";
import { array_range, create_element } from "./util.js";

// ? Example of creating component

const render_item_callback = (el_data, idx, data_arr) => {
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
const my_data = array_range(1, 10000, 1).map(i => `Element ${i}`),
	// ? Item sizes (should be same as in CSS styles)
	options = { width: 200, height: 100, gap: 10, padding: 10 };

// ? Standard example
component(document.body, my_data, render_item_callback, options);

// ? Enable drag-and-drop
// options.draggable = true;
// component(document.body, my_data, render_item_callback, options);

// ? Using fixed columns (NOTE: uncomment CSS rule for columns
// options.width = undefined;
// options.columns = 1;
// component(document.body, my_data, render_item_callback, options);

// ? Dynamic example using reflow() return method
// const { reflow } = component(document.body, data, render_item_callback, options);

// data.unshift("Test");
// reflow();
