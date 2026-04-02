// =========================================================================
// SCM HUD - CORE RADAR & MEDIA SCRIPT (SaaS Edition)
// =========================================================================
// Features: 
// - Automatic User Sync (Fetches scan frequency from Cloud)
// - Professional Radar (Sends Username + Display Name + Location)
// - Media on a Prim (MoAP) with Cache-Busting and UUID tracking
// =========================================================================

string BROWSER_URL = "https://ataurbdx.github.io/scm-hud/";
string CLOUD_URL   = "https://script.google.com/macros/s/AKfycbxmP0JWumHog423X-Dq8ZIEYtDoJagl2YCOAd1Lse2I4tyX8mzl2mytkI8Z9uj37OeX/exec";

integer HUD_FACE   = 4;
integer FRESH_LOAD = TRUE;

float   SCAN_INTERVAL = 30.0;
integer RADAR_ACTIVE  = FALSE;

// --- CORE RADAR LOGIC ---
doRadarScan()
{
    list agents = llGetAgentList(AGENT_LIST_REGION, []);
    integer count = llGetListLength(agents);
    
    // We only log IF there are other people nearby besides the owner
    if (count <= 1) return;

    string bulk_data = "["; 
    integer logged_count = 0;

    integer i;
    for (i = 0; i < count; i++)
    {
        key target = llList2Key(agents, i);
        if (target != llGetOwner()) 
        {
            // Names: "Display Name (Username)"
            string dName = llGetDisplayName(target);
            string uName = llGetUsername(target);
            string fullName = dName + " (" + uName + ")";
            
            vector pos = llList2Vector(llGetObjectDetails(target, [OBJECT_POS]), 0);
            string sim = llGetRegionName();
            string parcel = llList2String(llGetParcelDetails(pos, [PARCEL_DETAILS_NAME]), 0);

            string entry = "{\"target_uuid\":\"" + (string)target + 
                           "\",\"target_name\":\"" + fullName + 
                           "\",\"sim\":\"" + sim + 
                           "\",\"pos\":\"" + (string)pos + 
                           "\",\"parcel\":\"" + parcel + "\"}";
            
            if (logged_count > 0) bulk_data += ",";
            bulk_data += entry;
            logged_count++;
        }
    }
    bulk_data += "]"; 

    if (logged_count > 0) 
    {
        string body = "action=bulk_log&uuid=" + (string)llGetOwner() + "&data=" + llEscapeURL(bulk_data);
        llHTTPRequest(CLOUD_URL, [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded", HTTP_VERIFY_CERT, FALSE], body);
    }
}

// --- INITIALIZE UI ---
refreshUI()
{
    // Build URL with UUID mapping and Cache Buster
    string final_url = BROWSER_URL + "?uuid=" + (string)llGetOwner();
    if (FRESH_LOAD) {
        final_url += "&v=" + (string)llRound(llFrand(9999999.0));
    }
    
    llSetPrimMediaParams(HUD_FACE, [
        PRIM_MEDIA_CURRENT_URL, final_url,
        PRIM_MEDIA_HOME_URL, final_url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_CONTROLS, 1, 
        PRIM_MEDIA_WIDTH_PIXELS, 1024,
        PRIM_MEDIA_HEIGHT_PIXELS, 1024
    ]);
}

default
{
    state_entry()
    {
        // 1. Setup Visuals
        llSetTexture(TEXTURE_TRANSPARENT, ALL_SIDES);
        llSetColor(<1,1,1>, HUD_FACE);
        llScaleTexture(1.0, 1.0, HUD_FACE);
        
        // 2. Load the Web Interface
        refreshUI();

        // 3. Sync with Cloud to get custom settings (like scan frequency)
        string body = "action=sync_user&uuid=" + (string)llGetOwner() + "&name=" + llEscapeURL(llGetUsername(llGetOwner()));
        llHTTPRequest(CLOUD_URL, [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded", HTTP_VERIFY_CERT, FALSE], body);
        
        // 4. Initial Timer (Radar starts after sync or failsafe 10s)
        llSetTimerEvent(10.0);
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (status == 200 || status == 302) 
        {
            // Handle User Sync Response
            if (llSubStringIndex(body, "USER_SYNCED") != -1) 
            {
                list resp = llParseString2List(body, ["|"], []);
                float freq = (float)llList2String(resp, 1);
                if (freq < 10.0) freq = 30.0; // Minimum 10s safety
                
                SCAN_INTERVAL = freq;
                RADAR_ACTIVE = TRUE;
                
                llOwnerSay("SCM Radar Connected. Scanning every " + (string)((integer)SCAN_INTERVAL) + "s.");
                doRadarScan();
                llSetTimerEvent(SCAN_INTERVAL);
            }
        }
    }

    timer()
    {
        if (RADAR_ACTIVE) {
            doRadarScan();
        } else {
            // Failsafe start if sync lagged
            RADAR_ACTIVE = TRUE;
            llSetTimerEvent(SCAN_INTERVAL);
            doRadarScan();
        }
    }

    attach(key id) 
    { 
        if (id) llResetScript(); 
    }
    
    changed(integer change)
    {
        if (change & CHANGED_OWNER) llResetScript();
    }
}
