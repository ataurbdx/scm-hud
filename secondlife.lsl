// =========================================================================
// SCM HUD - PROFESSIONAL RADAR & MEDIA SCRIPT (Version 2.1)
// =========================================================================

string BROWSER_URL = "https://ataurbdx.github.io/scm-hud/";
string CLOUD_URL   = "https://script.google.com/macros/s/AKfycbxmP0JWumHog423X-Dq8ZIEYtDoJagl2YCOAd1Lse2I4tyX8mzl2mytkI8Z9uj37OeX/exec";

integer HUD_FACE   = 4;
float   SCAN_INTERVAL = 10.0;
integer RADAR_ACTIVE  = FALSE;

list PREV_AGENTS = [];

// --- CORE RADAR LOGIC ---
doRadarScan()
{
    // DUAL SCAN: Region-wide agents + Proximity sensor
    list agents = llGetAgentList(AGENT_LIST_REGION, []);
    vector myPos = llGetPos();
    
    // The Professional Radar is now more aggressive
    // We add everyone from the region list
    integer count = llGetListLength(agents);
    
    string bulk_data = "["; 
    integer logged_count = 0;
    list current_agents = [];

    integer i;
    for (i = 0; i < count; i++)
    {
        key target = llList2Key(agents, i);
        // We track everyone. If you're missing 2 people, it's likely they were Child Agents.
        // I will keep the owner filter so your history is clean, but let's see everyone else.
        if (target != llGetOwner()) 
        {
            current_agents += target;
            
            integer is_new = (llListFindList(PREV_AGENTS, [target]) == -1);
            
            string dName = llGetDisplayName(target);
            string uName = llGetUsername(target);
            string fullName = dName + " (" + uName + ")";
            
            vector pos = llList2Vector(llGetObjectDetails(target, [OBJECT_POS]), 0);
            float dist = llVecDist(pos, myPos);
            string sim = llGetRegionName();
            string parcel = llList2String(llGetParcelDetails(pos, [PARCEL_DETAILS_NAME]), 0);

            string entry = "{\"target_uuid\":\"" + (string)target + 
                           "\",\"target_name\":\"" + fullName + 
                           "\",\"sim\":\"" + sim + 
                           "\",\"pos\":\"" + (string)pos + 
                           "\",\"parcel\":\"" + llEscapeURL(parcel) + 
                           "\",\"dist\":" + (string)dist + 
                           ",\"new\":" + (string)is_new + "}";
            
            if (logged_count > 0) bulk_data += ",";
            bulk_data += entry;
            logged_count++;
        }
    }
    bulk_data += "]"; 
    PREV_AGENTS = current_agents; 

    if (logged_count > 0) 
    {
        llOwnerSay("Radar: Found " + (string)logged_count + " people. Saving...");
        string body = "action=bulk_log&uuid=" + (string)llGetOwner() + "&data=" + llEscapeURL(bulk_data);
        llHTTPRequest(CLOUD_URL, [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded"], body);
    }
}

refreshUI()
{
    // Build URL with Account Username (e.g. milfshefali)
    string uName = llGetUsername(llGetOwner());
    string final_url = BROWSER_URL + "?uuid=" + (string)llGetOwner() + "&name=" + llEscapeURL(uName);
    final_url += "&v=" + (string)llRound(llFrand(999999.0));
    
    llSetPrimMediaParams(HUD_FACE, [
        PRIM_MEDIA_CURRENT_URL, final_url,
        PRIM_MEDIA_HOME_URL, final_url,
        PRIM_MEDIA_AUTO_PLAY, TRUE,
        PRIM_MEDIA_AUTO_SCALE, TRUE,
        PRIM_MEDIA_CONTROLS, 0,
        PRIM_MEDIA_WIDTH_PIXELS, 1024,
        PRIM_MEDIA_HEIGHT_PIXELS, 1024
    ]);
}

default
{
    state_entry()
    {
        llSetTexture(TEXTURE_TRANSPARENT, ALL_SIDES);
        llSetColor(<1,1,1>, HUD_FACE);
        llOwnerSay("SCM Professional 3.0 started.");
        
        // --- POWER START ---
        refreshUI();
        llSetTimerEvent(SCAN_INTERVAL);
        doRadarScan(); // Immediate first scan
        
        // Sync with Cloud for frequency settings
        string body = "?action=sync_user&uuid=" + (string)llGetOwner() + "&name=" + llEscapeURL(llGetUsername(llGetOwner()));
        llHTTPRequest(CLOUD_URL + body, [HTTP_METHOD, "GET"], "");
    }

    attach(key id)
    {
        if (id) 
        {
            PREV_AGENTS = []; 
            refreshUI();
            doRadarScan();
            
            // Force Cloud Sync on every attach
            string body = "?action=sync_user&uuid=" + (string)llGetOwner() + "&name=" + llEscapeURL(llGetUsername(llGetOwner()));
            llHTTPRequest(CLOUD_URL + body, [HTTP_METHOD, "GET"], "");
        }
    }

    timer()
    {
        if (RADAR_ACTIVE) doRadarScan();
    }

    http_response(key id, integer status, list meta, string body)
    {
        // 200 = Success, 302 = Google Redirect (also Success for POST)
        if (status == 200 || status == 302) 
        {
            if (llSubStringIndex(body, "USER_SYNCED") != -1) 
            {
                list resp = llParseString2List(body, ["|"], []);
                float freq = (float)llList2String(resp, 1);
                if (freq < 10.0) freq = 10.0;
                SCAN_INTERVAL = freq;
                RADAR_ACTIVE = TRUE;
                llSetTimerEvent(SCAN_INTERVAL);
                llOwnerSay("SCM Connected. Radar Active (" + (string)((integer)SCAN_INTERVAL) + "s).");
            }
            else if (llSubStringIndex(body, "LOG_ERROR") != -1)
            {
                llOwnerSay("Cloud Warning: " + body);
            }
        }
        else
        {
            llOwnerSay("SCM Error: Cloud server unreachable (HTTP " + (string)status + ")");
        }
    }

    changed(integer change) { if (change & CHANGED_OWNER) llResetScript(); }
}
