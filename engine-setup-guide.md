# Smart Radar - SaaS Master Engine Setup Guide

This guide will walk you through deploying your Google Apps Script Master Engine. This engine receives data from Second Life and actively routes it to your users' personal Google Sheets.

## Step 1: Create the Master Registry Sheet
This file is owned by YOU, the SaaS creator. It acts as the database that remembers which UUID belongs to which Google Sheet.

1. Go to Google Sheets and create a completely blank spreadsheet.
2. Name it something like `SCM HUD Master Registry`.

## Step 2: Deploy the Google Apps Script
1. On your Master Registry sheet, click **Extensions > Apps Script**.
2. Delete any default code in that window.
3. Open the `engine-script.js` file from your computer (the one we just created).
4. Copy all the code inside `engine-script.js` and paste it completely into the Google Apps Script editor.
5. Click the **Save** (floppy disk) icon.

## Step 3: Publish the Master Engine Web App
1. In the top right corner of the Google Apps Script editor, click the blue **Deploy** button.
2. Select **New deployment**.
3. Click the gear icon next to "Select type" and choose **Web app**.
4. Fill out the deployment settings exactly like this:
    - **Description:** "Master Engine API V1"
    - **Execute as:** "Me (your specific google email)"
    - **Who has access:** "Anyone" *(This is extremely important! If it isn't set to Anyone, Second Life will be blocked from reaching it!)*
5. Click **Deploy**.
6. Google will ask you to authorize access. Click **Authorize access**, choose your Google account, verify that you trust it by clicking **Advanced**, and click "Go to project (unsafe)".
7. Once deployed, Google will give you a **Web app URL** (it starts with `https://script.google.com/macros/s/...`).
8. **Copy this Web app URL and keep it safe.** This is the secret API URL we will put into the Second Life HUD and the HTML code later!

## Step 4: The Golden Rule for Your Users
Because your Master Engine accesses spreadsheets owned by other people (your customers), Google's strict corporate security requires your customers to explicitly grant your script permission. 

Whenever a customer buys and registers your HUD, they **MUST** share their personal Google Sheet with your specific Google Account email (the one running the Master Engine). 

**Instructions you must give your customers to use the HUD:**
> "To use this HUD, create a blank Google Sheet. Click the green 'Share' button in the top right. Type in `[YOUR EMAIL HERE]` and give it **Editor** permissions. Finally, copy your sheet URL and paste it into the HUD Settings menu!"

If they do not grant your email `Editor` permissions, Google will block your script from touching their spreadsheet, and the HUD will throw a registration error.
