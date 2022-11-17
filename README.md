# hello there

![openOutpaint creating some undersea wildlife](docs/01-demo.gif)

this is a completely vanilla javascript and html canvas outpainting convenience doodad built for the API optionally exposed by [AUTOMATIC1111's stable diffusion webUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui), operating similarly to a few others which certainly have superior functionality.  this simply offers an alternative for my following vain desires:
 - avoiding the overhead of an additional virtual python evnironment or impacting a pre-existing one
 - operates against the API exposed by A1111's webUI
 - no external dependencies, extremely boring vanilla
 - no external connectivity, self-hosted and offline
 - unobfuscated (cough cough)
 - <a name="terrible"></a>i am terrible at javascript and should probably correct that
 - i have never used html canvas for anything before and should try it out

 ## operation

 ### prerequisities
 you'll obviously need A1111's webUI installed before you can use this, thus you're presumed to have an operational python install up and running to boot.  

 ### notes 
 -  technically you can run it directly in browser as a bare `file://` protocol webpage but that's _really_ not recommended as you'll have to add `null` as an accepted domain to your `--cors-allow-origins` option which just seems like it's a visibly poor decision.  
 - a deliciously simple launch script (thanks [@jasonmhead](https://github.com/jasonmhead)! (https://github.com/zero01101/openOutpaint/pull/1)) is included to pop up a teensy tiny python-based local webserver, however you may have to manually `chmod +x openOutpaint.sh` on mac/linux.  
 - the address http://127.0.0.1:3456 will be used as the host address for openOutpaint in the below quickstart; your local setup may use a different IP address or port.  you can of course modify the included launch script to point at a different port than 3456 if desired, as well.

### quickstart
 1. clone this repo to your homelab's webserver (i mean who doesn't have a couple of those lying around?) or somewhere on your local pc
 2. configure your local webhost in your homelab to serve the newly cloned repo like the technological bastion you are, or simply run the included `openOutpaint.bat` on windows or `openOutpaint.sh` on mac/linux. 
 3. modify your `webui-user.sh` or `webui-user.bat`'s `COMMANDLINE_ARGS` variable to contain ` --api --cors-allow-origins=http://127.0.0.1:3456`
 4. execute your webui-user script and wait for it to be ready
 5. **APPLY THE FOLLOWING SETTINGS IN A1111 WEBUI ONCE IT IS READY:** 
  - select an inpainting checkpoint/model - ([runwayml/stable-diffusion-inpainting](https://huggingface.co/runwayml/stable-diffusion-inpainting) [3e16efc8] is recommended)
  - set your `Inpainting conditioning mask strength` to `1`
  - disable the `Apply color correction to img2img results to match original colors.` option (the last 2 options are found under the stable diffusion category in the settings tab by default unless you've already moved it to your quicksettings list, and if so, you know where to set them already)
 6. open your locally-hosted web server at http://127.0.0.1:3456 (or wherever, i'm not your boss)
 7. update the host field if necessary to point at your stable diffusion API address, change my stupid prompts with whatever you want, click somewhere in the canvas, and wait
 8. once an image appears*, click the `<` and `>` buttons at the bottom-left corner of the image to cycle through the others in the batch if you requested multiple (it defaults to 2 batch size, 2 batch count) - click `y` to choose one you like, or `n` to cancel that image generation batch outright and possibly try again
 9. now that you've got a starter, click somewhere near it to outpaint - try and include as much of the "context" as possible in the reticle for the best result convergence
 10. use the mask mode to prepare previously rendered image areas for touchups/inpainting
11. play around with the available options, make your click "dl img" to save the cropped region of outpainted canvas (thanks [@Kalekki](https://github.com/Kalekki)! (https://github.com/zero01101/openOutpaint/pull/2))

*if it _doesn't_ create an image, check your console output to see if you've got CORS errors 

## //todo
### in order of "priority"/likelihood of me doing it
- [ ] lots and lots of readme updates (ongoing)
- [ ] comment basically everything that isn't self documenting (ongoing)
- [ ] _CURRENT TASK_: overmask seam of img2img (https://www.reddit.com/r/StableDiffusion/comments/ys9lhq/kollai_an_infinite_multiuser_canvas_running_on/ivzygwk/?context=3)
- [x] split out CSS to its own file (remedial cleanup task)
- [ ] split out JS to separation-of-concerns individual files (oh no)
- [ ] add error handling for async/XHR POST in case of, yknow, errors
- [ ] image erase region in case you decide later that you're not too happy with earlier results
- [ ] controls for the rest of API-available options (e.g. hires fix, inpaint fill modes, etc)
- [ ] render progress spinner/bar
- [ ] ~~smart crop downloaded image~~ 
- [ ] import external image and scale/superimpose at will on canvas for in/outpainting
- [ ] "numpad" selector for determining how reticle is anchored against actual mouse cursor (currently works like a "5" [center] on the "numpad" paradigm)
- [ ] BUG: figure out where that stupid 1-pixel offset is happening between approve/reject state and committing to an image, it doesn't affect output but it's _super_ obnoxious  
- [ ] BUG: make erase mask actually work, enable the control if you dare
- [ ] discrete size control for mask and target reticle, discrete x/y axes for reticle
- [ ] floating/togglable menu leftnav bar with categorized/sensibly laid-out options
- [ ] infinite canvas
- [ ] global undo/redo
- [ ] inpainting sketch tools
- [ ] something actually similar to a "user interface", preferably visually pleasant and would make my mom say "well that makes sense" if she looked at it
- [ ] eventually delete the generated mask display canvases at the bottom of the page, but they're useful for debugging canvas pixel offsets sometimes
- [ ] see if i can use fewer canvases overall; seems wasteful, canvas isn't free yknow
- [ ] upscaling output canvas??? sure let's make 16k wallpapers that'll be neat
- [ ] honestly probably refactor literally everything

## pull requests
**PLEASE SEND PULL REQUESTS**  
i am begging you, yes you personally reading this, please fix my horrible code and feel free to insult it, but i absolutely refuse to budge on no 3rd party libraries or dependencies, not even jquery, nothing.  vanilla is a very complex and layered flavor if you give it a chance.

## bug reports
please do! kindly indicate your OS, browser, versions of both, any errors in devtools/console output, what you were trying to do, what you expected, what happened unexpectedly or incorrectly, if something caught fire (please call the fire department first), the usual

## warranty
[lmao](https://github.com/moyix/fauxpilot#support-and-warranty)

## sample 
generated using 100% openOutpaint UI defaults except for switching to/from mask mode and changing scale factor to adjust the size of the mask blob, there's some neat stuff down there even if it disregarded the `people, humans, divers` negative prompt but in its defense there is only one singular person, human, diver in there, so according to the no homers club treatise of 1995 it's technically correct 

_(see https://github.com/zero01101/openOutpaint/commit/92ab9d231542ea5f7a3c85563acf5cd3cb16a928 for attempted counterattack)_
![fishies n stuff](docs/02-sample.png)

## version history
- 0.0.1 - txt2img proof of concept
- 0.0.2 - img2img outpainting proof of concept
- 0.0.3 - image masking/img2img inpainting proof of concept
- 0.0.4 - batch size/batch count, approve/reject system implementations, snap-to-grid, other people are now allowed to see this thing [01f8c6a](https://github.com/zero01101/openOutpaint/commit/01f8c6ab3f49739439a0990d6f5f0967a9a0bf12)
- 0.0.4.1 - extremely minor revisions [02cb01a](https://github.com/zero01101/openOutpaint/commit/02cb01ac062ef93878ff4161eabcedfa8e125be6)
- 0.0.4.2 - pull requests (&lt;3), downloaded images now have a timestamped name, css breakout because hopefully this will become halfway attractive enough to benefit from non-inline stylesheets [70ad4fe](https://github.com/zero01101/openOutpaint/commit/70ad4fe081bdbd507afc5af3cc2a4435924b66e3)
