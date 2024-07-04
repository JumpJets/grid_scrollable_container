# Grid scrollable component

This is custom component for grid (`display: grid;`) container that support large amount of elements and still remaining performant, that support dynamic updating elements and data, that also support scrolling, optionable dragging and possible more in the future.

It is supposed to be portable drop-in solution for any JS/TS project. It doesn't have dependencies aside a few utils functions in `utils.js`.

## Demo

There is Codepen demo where you can test it out live:

https://codepen.io/XCanG/pen/NWVvvwp?editors=0110

### A few notes about demo:

1. In `options` object you can toggle `dragging` option.
2. In `render_item_callback` there is editable example that you can uncomment, this example shows how to preserve data when element being scrolled out of screen.
3. There is also commented example that use `reflow`. Reflow used to rerender elements on changes. It can be used to modify internal data and then hit `reflow();` to update UI.
4. `data` structure is up to user, because it passed back to callback. In demo it used as simple array of strings, but it can be any object, like JSON, etc. You have control for how you store and process your input data. Grid component only render it in a grid.

# Known issues

1. During drag-and-drop mouse wheel wont work, because it is platform limitation from drag event. The solution to it is not to use drag events at all, however there is no plans to rewrite drag-and-drop code just to make a workaround for this limitation.

# Future plans

In general, this is not finalized version. Some testing will be made to see for potential bugs, however there is plans to extend functionality when needed.

As for now grid container is designed for vertical-only solution. If needed it may be expanded for horizontal solution as well. Not sure if there is any need to have 2D infinite grid, AKA Excel. It would add a lot of compications if support both directions at the same time.

May be there would be an extension for dynamic column/row sizes? As much as it is possible, having fixed sizes allow for more performant solution.

Smooth scrolling is probably not planned. While it is possible, JS only solution to transform grid container position would reduce performance, and I personally like quick response from *"sharp"* scrolling.

There is plans for support drag-and-drop range of elements.
