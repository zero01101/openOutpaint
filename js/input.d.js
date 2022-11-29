/* Here are event types */
/**
 * A base event type for input handlers
 *
 * @typedef InputEvent
 * @property {HTMLElement} target The target for the event
 * @property {MouseEvent | KeyboardEvent} evn An input event
 * @property {number} timestamp The time an event was emmited
 */

/**
 * A base event type for input
 */
// TODO: Implement event typing
/**
 * An object for mouse event listeners
 *
 * @typedef OnClickEvent
 */

/* Here are mouse context types */
/**
 * An object for mouse button event listeners.
 *
 * Drag events are use timing and radius to determine if they will be triggered
 * Paint events are triggered on any mousedown, mousemove and mouseup circunstances
 *
 * @typedef MouseListenerBtnContext
 * @property {Observer} onclick A click handler
 * @property {Observer} ondclick A double click handler
 *
 * @property {Observer} ondragstart A drag start handler
 * @property {Observer} ondrag A drag handler
 * @property {Observer} ondragend A drag end handler
 *
 * @property {Observer} onpaintstart A paint start handler
 * @property {Observer} onpaint A paint handler
 * @property {Observer} onpaintend A paint end handler
 */

/**
 * An object for mouse event listeners
 *
 * @typedef MouseListenerContext
 * @property {Observer} onmousemove A mouse move handler
 * @property {Observer} onwheel A mouse wheel handler
 * @property {MouseListenerBtnContext} btn Button handlers
 */

/**
 * This callback defines how event coordinateswill be transformed
 * for this context. This function should set ctx.coords appropriately.
 *
 *
 * @callback ContextMoveTransformer
 * @param {MouseEvent} evn The mousemove event to be transformed
 * @param {MouseContext} ctx The context object we are currently in
 * @returns {void}
 */

/**
 * A context for handling mouse coordinates and events
 *
 * @typedef MouseContext
 * @property {string} id A unique identifier
 * @property {string} name The key name
 * @property {ContextMoveTransformer} onmove The coordinate transform callback
 * @property {?HTMLElement} target The target
 */

/**
 * An object for storing dragging information
 *
 * @typedef MouseCoordContextDragInfo
 * @property {number} x X coordinate of drag start
 * @property {number} y Y coordinate of drag start
 * @property {HTMLElement} target Original element of drag
 * @property {boolean} drag If we are in a drag
 */

/**
 * An object for storing mouse coordinates in a context
 *
 * @typedef MouseCoordContext
 * @property {{[key: string]: MouseCoordContextDragInfo}} dragging Information about mouse button drags
 * @property {{x: number, y: number}} prev Previous mouse position
 * @property {{x: number, y: number}} pos Current mouse position
 */

/* Here are keyboard-related types */
/**
 * Stores key states
 *
 * @typedef KeyboardKeyState
 * @property {boolean} pressed If the key is currently pressed or not
 * @property {boolean} held If the key is currently held or not
 * @property {?number} _hold_to A timeout for detecting key holding status
 */

/* Here are the shortcut types */
/**
 * Keyboard shortcut callback
 *
 * @callback KeyboardShortcutCallback
 * @param {KeyboardEvent} evn The keyboard event that triggered this shorcut
 * @returns {void}
 */

/**
 * Shortcut information
 *
 * @typedef KeyboardShortcut
 * @property {string} id A unique identifier for this shortcut
 *
 * @property {boolean} ctrl Shortcut ctrl key state
 * @property {boolean} alt Shortcut alt key state
 * @property {boolean} shift Shortcut shift key state
 *
 * @property {KeyboardShortcutCallback} callback If the key is currently held or not
 */
