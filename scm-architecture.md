# Smart Contact Manager (SCM) HUD - Core Architecture

This document serves as the master blueprint for the SCM HUD project. It defines the business model, the database schema, and the exact flow of data between Second Life, the HTML frontend, and the Google Apps Script backend. Keep this file safe so future AI chats understand exactly how your system works.

## 1. Business Model: Multi-Alt SaaS 
The SCM HUD operates as a scalable Software-as-a-Service (SaaS). 
- **Central Master Registry:** The creator owns a single Master Registry Google Sheet. This sheet simply maps Second Life Avatar UUIDs to customer Google Sheets.
- **Customer Databases:** Customers do NOT dump data into the creator's database. Instead, each customer creates their own blank Google Sheet and shares it with the creator's service email.
- **Multi-Alt Support:** A customer often has multiple Second Life avatars (alts). The customer pastes their single Google Sheet link into the HUD for every alt they own. The Master Engine maps all their alts to that one single database, allowing them to track alt-specific settings and share contacts across their accounts.

## 2. The Smart CRM Database Schema
When a customer registers their sheet, the Master Engine automatically builds the following strict CRM schema natively inside their sheet:

### Users
Tracks the specific alt avatars connected to this database and their individual settings.
- `user_uuid`: The Second Life UUID of the Alt Avatar logging in.
- `user_name`: The core actual Second Life username (e.g. "hridoy22"), NOT the Display Name.
- `theme`: The HUD color theme chosen by the user (e.g. "Blue", "Dark").
- `transparency`: Opacity level of the HUD background (0-100).
- `scale`: Zoom/Scale setting for the HUD UI.
- `shared_mode`: If TRUE, allows this alt's personal contacts to be viewed by other alts in the same database.
- `seen_history`: Toggles whether the radar logs encounters into the database unconditionally.
- `history_delete_days`: How long (in days) before old Encounter logs are automatically purged.
- `history_min_secs`: Minimum time an avatar must be seen before it officially registers as an Encounter.
- `scan_freq`: How often (in seconds) the Second Life LSL script scans the region (e.g. 30).
- `last_login`: Timestamp of the last time this specific alt logged into the HUD.
- `created_at`: The exact calendar date this alt was initially registered to the database.

### Categories
Used to securely organize contacts into distinct folders/groups (e.g. "DJ", "Friends", "Staff").
- `owner_uuid`: The UUID of the Alt that created this category.
- `cat_id`: Unique identifier for the category.
- `cat_name`: Human-readable name of the category.
- `cat_color`: Hex code representing the category color in the UI.
- `cat_icon`: The icon or emoji representing the category.
- `created_at`: Date the category was created.

### Tags
Used to apply multiple micro-labels to a contact for filtering (e.g. "Builder", "Trouble").
- `owner_uuid`: The UUID of the Alt that created this tag.
- `tag_id`: Unique identifier for the tag.
- `tag_name`: Human-readable name of the tag.
- `tag_color`: Hex code representing the tag color in the UI.
- `tag_icon`: The icon representing the tag.
- `created_at`: Date the tag was created.

### Contacts
The vital address book of manually saved or favorited avatars.
- `owner_uuid`: The UUID of the Alt that favorited/saved this contact.
- `contact_uuid`: The target avatar's UUID.
- `contact_name`: The target avatar's name.
- `cat_ids`: Comma-separated list of `cat_id`s applied to this contact.
- `tag_ids`: Comma-separated list of `tag_id`s applied to this contact.
- `notes`: A massive text string containing secret personal notes written about the contact.
- `created_at`: Date the contact was saved.

### Seen_Daily
Aggregates radar scans per day to prevent spam. (Answers: "Who did I see today and for how long?")
- `summary_id`: Unique ID string mathematically formulated as `owner_uuid + target_uuid + date`.
- `owner_uuid`: The Alt who saw the target.
- `target_uuid`: The avatar who walked into radar range.
- `target_name`: The target's name.
- `date`: The calendar date of the encounter.
- `is_protected`: If TRUE, this encounter record is hidden from other Alts sharing the database.
- `total_scans`: A counter incremented every time the radar detects the avatar on that specific date.
- `last_seen_time`: The most recent timestamp they were detected today.

### Encounters
Maps exact geographical locations for every single radar blip. (Answers: "Where exactly did I see them?")
- `summary_id`: Links back to the `Seen_Daily` row.
- `timestamp`: The exact timestamp of the geographical blip.
- `sim_name`: The name of the Second Life region (Sim).
- `sim_pos`: The XYZ vector coordinates of the target in the Region.
- `parcel_name`: The name of the specific parcel they were standing on (e.g. "Main Store").

## 3. The Data Flow Bridge
1. **LSL Script (`secondlife.lsl`):** Scans the region every 30 seconds. Compiles nearby avatars into a JSON array and fires an HTTP POST to the Master Engine.
2. **Master Engine (`engine-script.js`):** Receives the JSON payload, looks up the Avatar's UUID in the Master Registry, opens the mathematically mapped personal Google Sheet, calculates the `summary_id`, and safely logs data into `Seen_Daily` and `Encounters`.
3. **HTML Frontend (`index.html`):** Loads natively inside the Second Life HUD via MoAP (Media on a Prim). It uses JS `fetch()` to hit the Master Engine (`action=get_data`), pulling from the personal sheet to securely visualize the Dashboard.
