/**
 * Implementation of a simple Oberver Pattern for custom event handling
 */
function Observer() {
    this.handlers = new Set();
}

Observer.prototype = {
    // Adds handler for this message
    on(callback) {
        this.handlers.add(callback);
        return callback;
    },
    clear(callback) {
        return this.handlers.delete(callback);
    },
    emit(msg) {
        this.handlers.forEach(async (handler) => {
            try {
                await handler(msg);
            } catch (e) {
                console.warn('Observer failed to run handler');
                console.warn(handler);
            }
        });
    },
};
