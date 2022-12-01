const tools = {};

/**
 * Dream tool
 */
tools.dream = dreamTool();
tools.img2img = img2imgTool();

/**
 * Mask Editing tools
 */
toolbar.addSeparator();

/**
 * Mask Brush tool
 */
tools.maskbrush = maskBrushTool();
tools.colorbrush = colorBrushTool();

/**
 * Image Editing tools
 */
toolbar.addSeparator();

tools.selecttransform = selectTransformTool();
tools.stamp = stampTool();

toolbar.tools[0].enable();
