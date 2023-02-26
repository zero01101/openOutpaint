const tools = {};

/**
 * Dream tool
 */
tools.dream = dreamTool();
tools.img2img = img2imgTool();

/**
 * Mask Editing tools
 */
thetoolbar.addSeparator();

/**
 * Mask Brush tool
 */
tools.maskbrush = maskBrushTool();
tools.colorbrush = colorBrushTool();

/**
 * Image Editing tools
 */
thetoolbar.addSeparator();

tools.selecttransform = selectTransformTool();
tools.stamp = stampTool();

/**
 * Interrogator tool
 */
thetoolbar.addSeparator();
tools.interrogate = interrogateTool();
thetoolbar.tools[0].enable();
