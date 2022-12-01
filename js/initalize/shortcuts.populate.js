// Listen for shortcuts
keyboard.onShortcut({ctrl: true, key: "KeyZ"}, () => {
	commands.undo();
});

keyboard.onShortcut({ctrl: true, key: "KeyY"}, () => {
	commands.redo();
});

// Tool shortcuts
keyboard.onShortcut({key: "KeyD"}, () => {
	tools.dream.enable();
});
keyboard.onShortcut({key: "KeyM"}, () => {
	tools.maskbrush.enable();
});
keyboard.onShortcut({key: "KeyC"}, () => {
	tools.colorbrush.enable();
});
keyboard.onShortcut({key: "KeyI"}, () => {
	tools.img2img.enable();
});
keyboard.onShortcut({key: "KeyS"}, () => {
	tools.selecttransform.enable();
});
keyboard.onShortcut({key: "KeyU"}, () => {
	tools.stamp.enable();
});
