// =========================================================================
// SCM HUD - MASTER RADAR ENGINE (Version 6.1)
// Improvements: getSafeName, integer dist, memory guard, jump/skip fix
// =========================================================================

string CLOUD_URL      = "https://script.google.com/macros/s/AKfycbxmP0JWumHog423X-Dq8ZIEYtDoJagl2YCOAd1Lse2I4tyX8mzl2mytkI8Z9uj37OeX/exec";

integer HUD_FACE      = 4;
float   SCAN_INTERVAL = 10.0;
integer RADAR_ACTIVE  = TRUE;

list PREV_AGENTS = [];

// --- SAFE NAME HELPER ---
string getSafeName(key id)
{
    string display = llGetDisplayName(id);
    if (display == "") display = llKey2Name(id);
    return display + " (" + llGetUsername(id) + ")";
}

// --- CORE RADAR LOGIC ---
doRadarScan()
{
    // All declarations at top (LSL rule)
    list    agents        = llGetAgentList(AGENT_LIST_REGION, []);
    vector  myPos         = llGetPos();
    integer total         = llGetListLength(agents);
    list    last_seen     = PREV_AGENTS;
    string  bulk_data     = "";
    string  body          = "";
    string  entry         = "";
    vector  pos           = ZERO_VECTOR;
    float   dist          = 0.0;
    key     target        = NULL_KEY;
    integer is_new        = 0;
    integer count         = 0;
    integer i             = 0;

    for (i = 0; i < total; i++)
    {
        target = llList2Key(agents, i);
        if (target == llGetOwner()) jump skip;

        pos  = llList2Vector(llGetObjectDetails(target, [OBJECT_POS]), 0);
        dist = llVecDist(myPos, pos);

        is_new = 0;
        if (llListFindList(last_seen, [target]) == -1)
        {
            is_new = 1;
            last_seen += [target];
        }

        // Booster v6.1: Compressed keys + integer dist (no parcel to save space)
        entry =
            "{\"id\":\"" + (string)target +
            "\",\"n\":\"" + llEscapeURL(getSafeName(target)) +
            "\",\"s\":\"" + llEscapeURL(llGetRegionName()) +
            "\",\"p\":\"" + (string)pos +
            "\",\"d\":"  + (string)((integer)dist) +
            ",\"w\":"    + (string)is_new + "}";

        if (bulk_data == "") bulk_data = "[" + entry;
        else                 bulk_data += "," + entry;
        count++;

        // Every 12 avatars flush a safe packet (stay under 2KB)
        if (count >= 12)
        {
            body = "action=bulk_log&uuid=" + (string)llGetOwner() +
                   "&data=" + llEscapeURL(bulk_data + "]");
            llHTTPRequest(CLOUD_URL,
                [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded"],
                body);
            bulk_data = "";
            count = 0;
        }

        @skip;
    }

    // Send the final (or only) batch
    if (bulk_data != "")
    {
        body = "action=bulk_log&uuid=" + (string)llGetOwner() +
               "&data=" + llEscapeURL(bulk_data + "]");
        llHTTPRequest(CLOUD_URL,
            [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/x-www-form-urlencoded"],
            body);
    }

    // Memory guard: reset list if it grows too large
    if (llGetListLength(last_seen) > 150) last_seen = [];
    PREV_AGENTS = last_seen;
}

default
{
    state_entry()
    {
        RADAR_ACTIVE = TRUE;
        llSetTimerEvent(SCAN_INTERVAL);
        llOwnerSay("SCM HUD v6.1 ONLINE");
        doRadarScan();
    }

    timer()
    {
        if (RADAR_ACTIVE) doRadarScan();
    }

    http_response(key request_id, integer status, list meta, string resp_body)
    {
        if (status == 200 || status == 302)
        {
            string freqStr = llJsonGetValue(resp_body, ["radar_scan_freq"]);
            if (freqStr != JSON_INVALID && freqStr != JSON_NULL)
            {
                float newFreq = (float)freqStr;
                if (newFreq < 5.0) newFreq = 5.0;
                if (newFreq != SCAN_INTERVAL)
                {
                    SCAN_INTERVAL = newFreq;
                    llSetTimerEvent(SCAN_INTERVAL);
                    llOwnerSay("Scan synced: " + (string)((integer)SCAN_INTERVAL) + "s");
                }
            }
        }
        else if (status != 0)
        {
            llOwnerSay("Cloud Error: " + (string)status);
        }
    }

    touch_start(integer n)
    {
        if (llDetectedTouchFace(0) == HUD_FACE)
        {
            RADAR_ACTIVE = !RADAR_ACTIVE;
            llOwnerSay("Radar: " + (RADAR_ACTIVE ? "ON" : "OFF"));
            llSetTimerEvent(RADAR_ACTIVE ? SCAN_INTERVAL : 0);
        }
    }

    on_rez(integer p) { llResetScript(); }
}
