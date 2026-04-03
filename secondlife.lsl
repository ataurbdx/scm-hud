// =========================================================================
// SCM HUD - MASTER RADAR ENGINE (Version 3.0)
// =========================================================================

string BROWSER_URL = "https://ataurbdx.github.io/scm-hud/";
string CLOUD_URL   = "https://script.google.com/macros/s/AKfycbxmP0JWumHog423X-Dq8ZIEYtDoJagl2YCOAd1Lse2I4tyX8mzl2mytkI8Z9uj37OeX/exec";

integer HUD_FACE   = 4;
float   SCAN_INTERVAL = 10.0;
integer RADAR_ACTIVE  = FALSE;

list PREV_AGENTS = []; // To track "New" status

// --- CORE RADAR LOGIC ---
doRadarScan()
{
    list agents = llGetAgentList(AGENT_LIST_REGION, []);
    vector myPos = llGetPos();
    integer count = llGetListLength(agents);
    
    // TRUTH SCAN: What does the server see?
    integer simPop = llGetRegionAgentCount();
    llOwnerSay("DIAGNOSTIC: SIM Population = " + (string)simPop + " | Radar can see = " + (string)count);
    
    if (simPop > count) {
        llOwnerSay("NOTICE: " + (string)(simPop - count) + " person(s) are either hidden or across the border and invisible to scripts.");
    }

    string bulk_data = "["; 
    integer logged_count = 0;
    list current_agents = [];

    integer i;
    for (i = 0; i < count; i++)
    {
        key target = llList2Key(agents, i);
        if (target != llGetOwner()) 
        {
            current_agents += target;
            
            integer is_new = (llListFindList(PREV_AGENTS, [target]) == -1);
            
            string uName = llGetUsername(target);
            string dName = llGetDisplayName(target);
            string fullName = dName + " (" + uName + ")";
            
            // Optimization: Filter out "Resident" suffix if redundant
            if (llSubStringIndex(fullName, " (Resident)") != -1) {
                fullName = dName;
            }

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
        // Silence the 'Saving' message by default for clean chat
        string body = "action=bulk_log&uuid=" + (string)llGetOwner() + "&data=" + llEscapeURL(bulk_data);
        llHTTPRequest(CLOUD_URL, [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded"], body);
    }
}

default
{
    state_entry()
    {
        RADAR_ACTIVE = TRUE;
        llSetTimerEvent(SCAN_INTERVAL);
        llOwnerSay("SCM HUD 4.0 ONLINE. Dynamic Sync Enabled.");
        doRadarScan();
    }

    timer()
    {
        doRadarScan();
    }

    http_response(key id, integer status, list meta, string body)
    {
        if (status == 200 || status == 302) 
        {
            // Parse for dynamic settings
            string freqStr = llJsonGetValue(body, ["radar_scan_freq"]);
            if (freqStr != JSON_INVALID && freqStr != JSON_NULL) 
            {
                float newFreq = (float)freqStr;
                if (newFreq < 5.0) newFreq = 5.0; // Fail-safe
                if (newFreq != SCAN_INTERVAL) 
                {
                    SCAN_INTERVAL = newFreq;
                    llSetTimerEvent(SCAN_INTERVAL);
                    llOwnerSay("SCM: Scan Interval synced to " + (string)((integer)SCAN_INTERVAL) + "s.");
                }
            }
        } 
        else if (status != 0) 
        {
             llOwnerSay("Cloud Sync Error: " + (string)status);
        }
    }

    touch_start(integer n)
    {
        if (llDetectedTouchFace(0) == HUD_FACE)
        {
            RADAR_ACTIVE = !RADAR_ACTIVE;
            if (RADAR_ACTIVE) {
                llOwnerSay("Radar: ON (" + (string)((integer)SCAN_INTERVAL) + "s interval)");
                doRadarScan();
                llSetTimerEvent(SCAN_INTERVAL);
            } else {
                llOwnerSay("Radar: OFF");
                llSetTimerEvent(0);
            }
        }
    }

    on_rez(integer p) { llResetScript(); }
}
