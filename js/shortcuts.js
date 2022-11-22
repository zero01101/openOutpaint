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
