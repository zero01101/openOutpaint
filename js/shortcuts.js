// Listen for shortcuts
keyboard.onShortcut({ctrl: true, key: "KeyZ"}, () => {
	commands.undo();
});

keyboard.onShortcut({ctrl: true, key: "KeyY"}, () => {
	commands.redo();
});
