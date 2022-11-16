# hello there

![openOutpaint creating some undersea wildlife](docs/01-demo.gif)

this is a completely vanilla javascript and html canvas outpainting convenience built for [AUTOMATIC1111's stable diffusion webUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) similar to a few others which certainly have superior functionality.  this simply offers an alternative for my desires:
 - avoiding the overhead of an additional virtual python evnironment or impacting a pre-existing one
 - operates against the API exposed by A1111's webUI
 - no external dependencies, extremely boring vanilla
 - no external connectivity, self-hosted and offline
 - unobfuscated (cough cough)
 - <a name="terrible"></a>i am terrible at javascript and should probably correct that
 - i have never used html canvas for anything before and should try it out

 ## operation
 you'll obviously need A1111's webUI installed before you can use this.  

 technically you can run it directly in browser as a bare `file://` protocol webpage but that's _really_ not recommended as you'll have to add `null` as an accepted domain to your `--cors-allow-origins` option which just seems like it's a visibly poor decision.  
 i therefore **strongly** recommend using a small webserver such as [simple-http-server](https://github.com/TheWaWaR/simple-http-server) if you don't have a local server already running somewhere.

 1. clone this repo or just literally download index.html and js/index.js manually and put 'em somewhere
 2. configure whatever local (host or network) webserver you're using to serve the index.html from this repo and execute it (instructions for configuring a web server are outside the scope of this remedial quickstart)
 3. modify your `webui-user.sh` or `webui-user.bat`'s `COMMANDLINE_ARGS` variable to contain ` --api --cors-allow-origins=http://127.0.0.1:1234` *(replacing 127.0.0.1:1234 with wherever you're hosting it on your local network if necessary)*
 4. execute your webui-user script and wait for it to be ready
 5. **SELECT AN INPAINTING MODEL (and associated VAE if applicable) IN WEBUI** - [runwayml/stable-diffusion-inpainting](https://huggingface.co/runwayml/stable-diffusion-inpainting) is recommended
 6. open your locally-hosted web server, possibly appending `index.html` if it doesn't automatically serve that
 7. update the host field if necessary to point at your stable diffusion API address, change my stupid prompts with whatever you want, click somewhere in the canvas, and wait
 8. once an image appears, click the `<` and `>` buttons at the bottom-left corner of the image to cycle through the others in the batch if you requested multiple (it defaults to 2 batch size, 2 batch count) - click `y` to choose one you like, or `n` to cancel that image generation batch outright and possibly try again
 9. now that you've got a starter, click somewhere near it to outpaint - try and include as much of the "context" as possible in the reticle for the best result convergence
 10. use the mask mode to prepare previously rendered image areas for touchups/inpainting
11. play around with the available options, click "dl img" to save the entire 2560x1440 canvas, sorry it doesn't smart crop or anything  

if it _doesn't_ create an image, check your console output to see if you've got CORS errors 

## todo
- [ ] controls for the rest of API-available options (e.g. hires fix, inpaint fill modes, etc)
- [ ] figure out where that stupid 1-pixel offset is happening between approve/reject state and committing to an image, it doesn't affect output but it's _super_ obnoxious  
- [ ] BUG: make erase mask actually work, enable the control if you dare
- [ ] infinite canvas
- [ ] smart crop downloaded image
- [ ] floating/togglable menu leftnav bar with categorized/sensibly laid-out options
- [ ] global undo/redo
- [ ] render progress spinner/bar
- [ ] inpainting sketch tools
- [ ] something actually similar to a "user interface", hopefully actually pleasant
- [ ] eventually delete the generated mask display canvases at the bottom of the page, but they're useful for debugging canvas pixel offsets sometimes
- [ ] honestly probably refactor literally everything

## pull requests
**PLEASE SEND PULL REQUESTS**  
i am begging you, yes you personally reading this, please fix my horrible code and feel free to insult it, but i absolutely refuse to budge on no 3rd party libraries or dependencies, not even jquery, nothing.  vanilla is a very complex and layered flavor if you give it a chance.