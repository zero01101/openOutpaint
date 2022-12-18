# hello there 🐠

[openOutpaint creating some undersea... well, stuff](https://user-images.githubusercontent.com/1649724/205455599-7817812e-5b50-4c96-807e-268b40fa2fd7.mp4)

_silly demo example current as of [9b174d6](https://github.com/zero01101/openOutpaint/commit/9b174d66c9b9d83ce8657128c97f917b473b13a9) / v0.0.8 / 2022-12-03_ //TODO UPDATE

this is a completely vanilla javascript and html canvas outpainting convenience doodad built for the API optionally exposed by [AUTOMATIC1111's stable diffusion webUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui), operating similarly to a few others that are probably more well-known. this simply offers an alternative for my following vain desires:

- avoiding the overhead of an additional virtual python environment or impacting a pre-existing one
- operates against the API exposed by A1111's webUI
- no external dependencies, extremely boring vanilla
- no external connectivity, self-hosted and offline
- unobfuscated (cough cough)
- <a name="terrible"></a>i am terrible at javascript and should probably correct that
- i have never used html canvas for anything before and should try it out

## features

- intuitive, convenient outpainting - that's like the whole point right
- queueable, cancelable dreams - just start a'clickin' all over the place
- arbitrary dream reticle size - draw the rectangle of your dreams
- an [effectively infinite](https://github.com/zero01101/openOutpaint/pull/108), resizable, scalable canvas for you to paint all over
  - **_NOTE: v0.0.10 introduces a new "camera control" modifier key - hold [`CTRL`] ([`CMD`] on mac) and use the scrollwheel to zoom (scroll the wheel) and pan (hold the wheel button) around the canvas_**
- a very nicely functional and familiar layer system
- inpainting/touchup mask brush
- prompt history panel
- optional (visibly) inverted mask mode - red masks get mutated, blue masks stay the same, but you can't take both pills at once
- inpainting color brush to bring out your inner vincent van bob ross
- dedicated img2img tool with optional border masking for enhanced output coherence with existing subject matter
- marquee select tool to select regions and arbitrarily scale, create stamps, move chunks, do all sorts of damage
- optionally decoupled cursor size and output resolution
- interrogate tool
- floating control panel to easily change models/samplers/steps/prompts/CFG/etc options for each dream summoned from the latent void _(NOTE: model switching requires A1111 webUI to be on commit [5a6387e](https://github.com/AUTOMATIC1111/stable-diffusion-webui/commit/5a6387e189dc365c47a7979b9040d5b6fdd7ba43) or more recent)_
- floating toolbox with handy keyboard shortcuts
- optional grid snapping for precision
- optional hi-res fix for blank/txt2img dreams which, if enabled, uses image width/height / 2 as firstpass size
- optional overmasking for potentially better seams between outpaints - set overmask px value to 0 to disable the feature
- import arbitrary images and scale/stamp on the canvas whenever, wherever you'd like
- upscaler support for final output images
- saves your preferences/imported images to browser localstorage for maximum convenience
- reset to defaults button to unsave your preferences if things go squirrely
- floating navigable undo/redo palette with ctrl+z/y keyboard shortcuts for additional maximum convenience and desquirreliness
- _all this and much more for the low, low price of simply already owning an expensive GPU!_

## operation

### prerequisities

you'll obviously need A1111's webUI installed before you can use this, thus you're presumed to have an operational python install up and running to boot.

### quickstart speedrun

1. edit your `cors-allow-origins` to include https://zero01101.github.io and run webUI
2. go to https://zero01101.github.io/openOutpaint/ and fill in the host value with your webUI API address
3. click things and do stuff

### step-by-step actually useful instructions

please see the [quickstart wiki article](https://github.com/zero01101/openOutpaint/wiki/SBS-Guided-Example) and comprehensive [manual](https://github.com/zero01101/openOutpaint/wiki/Manual).

## pull requests/bug reports

please do! see [contributing](https://github.com/zero01101/openOutpaint/blob/main/CONTRIBUTING.md) for details!

## warranty

[lmao](https://github.com/moyix/fauxpilot#support-and-warranty)
