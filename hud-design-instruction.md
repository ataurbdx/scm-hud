# 🏁 Complete Step-by-Step Guide: Building Your First Web HUD

This guide explains exactly how to take the web files we created and turn them into a stunning, working HUD in Second Life.

---

## Step 1: Host the HTML File (Decoupling)
Currently, you were serving HTML natively from Google Scripts. We want our HUD to load instantly, without weird Google warning banners or stretching.

1. Go to Github.com and create a free account if you don't have one.
2. Create a new "Repository" (Name it `scm-hud`).
3. Upload the `demo-hud.html` file into that repository and rename it `index.html`.
4. Go to the repository **Settings** -> **Pages**.
5. Under "Source", select `main` or `master` branch and save.
6. GitHub will process it and give you a free URL (like `https://<your-username>.github.io/scm-hud/`).
7. **Copy this URL.**

> **Why do this?** Now, your HUD loads cleanly and instantly. It feels like a real built-in App, not a web page. You can still use Google Apps Script purely as a database API later.

---

## Step 2: Build the HUD Prim in Second Life
1. Log into Second Life and go to a sandbox or quiet area.
2. Right-click the ground and choose **Build**. Create a standard Box.
3. Keep the **Rotation** entirely flat at `X: 0.00000`, `Y: 0.00000`, `Z: 0.00000`.
4. Open the **Object** tab inside the Edit Window and set these exact sizes for a larger beautiful 16:9 ratio:
   * **`X:` `0.010`** (This is the thickness)
   * **`Y:` `0.600`** (This is the width)
   * **`Z:` `0.338`** (This is the height)
5. Right-click the box and select **Attach To -> HUD -> Center**.

---

## Step 3: Add the LSL Code
1. Your box is now attached to your screen. Right-click it and choose **Edit**.
2. Go to the **Contents** tab.
3. Click **New Script**. Double click the new script to open it.
4. Open the `demo-hud.lsl` file I created in your project folder. Copy all the contents.
5. Paste it into the Second Life script editor.
6. Look for `string BROWSER_URL = ...` at the top of the script. Replace `"https://example.com"` with the GitHub URL you created in Step 1.
7. Click **Save** in the script window. 

> *Note: Make sure your script has `integer HUD_FACE = 4;` at the top! Face 4 automatically faces your screen when Rotation is zero! Also, make sure in your Texture tab that Repeats are exactly 1.0 and Offset is 0.0.*

---

## Step 4: Final Testing & Tweaking
* Close the edit window. You should immediately see the beautiful Dark Mode UI glow into existence with a micro-animation.
* Move your mouse over it. Notice that because we used `PRIM_MEDIA_CONTROLS, 1`, the big ugly Second Life address bar **does not drop down** and block the screen!
* Notice the text size! Because we set `WIDTH_PIXELS` to `512`, Second Life stretches things to fit the screen, which effectively zooms up the website to 200%.

If you want to edit the HTML design later, just update `index.html` on GitHub. You'll instantly see those updates on your SL HUD without touching the prim or the LSL script again!
