// ==========================================
// DEMO HUD WEB SCRIPT FOR SECOND LIFE
// Aspect Ratio: 16:9 | Zoom: 200%
// ==========================================

// Change this URL to your GitHub Pages URL (or your local test file path)
// Example: "https://minionslayer.github.io/hud/index.html"
string BROWSER_URL = "https://ataurbdx.github.io/scm-hud/"; 

// Which face of the prim to put the web view. 
// Face 5 is highly recommended for standard SL boxes.
integer HUD_FACE = 4; 

// SET TO TRUE DURING DEVELOPMENT: Forces SL to fetch fresh HTML by bypassing cache.
// SET TO FALSE FOR LIVE USERS: Allows normal caching so it loads faster for them.
integer FRESH_LOAD = TRUE;

default
{
    state_entry()
    {
        // 1. Hide all faces, then show only the HUD_FACE
        llSetTexture(TEXTURE_TRANSPARENT, ALL_SIDES);
        llSetColor(<1,1,1>, HUD_FACE);
        
        // 2. Make sure the texture isn't squashed or offset
        llScaleTexture(1.0, 1.0, HUD_FACE);
        llOffsetTexture(0.0, 0.0, HUD_FACE);
        llRotateTexture(0.0, HUD_FACE);
        
        // 3. Build the URL (and apply Cache Buster if FRESH_LOAD is TRUE!)
        string final_url = BROWSER_URL;
        if (FRESH_LOAD) 
        {
            final_url = final_url + "?v=" + (string)llRound(llFrand(9999999.0));
        }
        
        // 4. Load the Web View (Using a large 1024x1024 canvas for crisp text)
        llSetPrimMediaParams(HUD_FACE, [
            PRIM_MEDIA_CURRENT_URL, final_url,
            PRIM_MEDIA_HOME_URL, final_url,  // <--- Makes the Home button work!
            PRIM_MEDIA_AUTO_PLAY, TRUE,
            PRIM_MEDIA_AUTO_SCALE, TRUE,
            PRIM_MEDIA_CONTROLS, 1, 
            PRIM_MEDIA_WIDTH_PIXELS, 1024,
            PRIM_MEDIA_HEIGHT_PIXELS, 1024
        ]);

        llOwnerSay("SCM HUD Core initialized. HTML is loaded.");
    }
    // When worn or attached, reset the script so SL fetches the newest URL
    attach(key id) 
    { 
        if (id) llResetScript(); 
    }
}
