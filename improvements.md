Maintain strictly:
1. current time system

# Database Normalization Schema

Here is the structured schema based on the improvements for relational tables (Globals vs. User Specific) and separating the Master DB from the User DB.

## 1. Master Database (Routing & Registration)
Used ONLY to connect a HUD to the user's personal Google Sheet. No settings stored here.

| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `user_uuid` | SL Avatar UUID | String (Key) | Primary Router Key |
| `user_name` | SL Username | String | Example: ataurbdx |
| `display_name` | SL Display Name| String | Example: Ataur |
| `google_sheet_id` | DB Link | String | User's Personal DB ID |
| `created_at` | Join Date | Datetime | |

---

## 2. User Database (Personal Google Sheet)

### Settings (User Preferences)
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `user_uuid` | Your UUID | String (Key) | |
| `user_name` | Your Username | String | |
| `display_name` | Your Display Name| String | Displayed as `Display Name (user_name)` |
| `theme` | UI Theme | String | |
| `transparency`| UI Alpha | Float | |
| `scale` | UI Size | Float | |
| `scan_frequency` | HUD speed | Integer | Synced with SL HUD and Web refresh |
| `is_protected` | Sharing mode | Integer | |

---

## 3. Global Tables (Unique Entities)

### `avatars` (Detected or Manually Added Avatars)
*Auto-created by radar, or manually created. Single source of truth for an avatar's identity.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `avatar_id` | Avatar UUID | String (PK)| Use SL UUID (No auto-increment needed) |
| `user_name` | SL Username | String | |
| `display_name` | SL Display Name| String | |
| `created_at` | First Seen | Datetime | |


### `avatar_by` (Radar Detection Pivot Table)
*Pivot table mapping which user detected which global avatar. The same avatar can be scanned by many users, creating one pivot row for each.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | Who scanned them |
| `avatar_id` | Their UUID | String (FK)| Links to global `avatars.avatar_id` |
| `created_at` | Link Date | Datetime | When you first detected them |


### `user_avatars` (Manual Friends List)
*Strictly your manually added friends list. Distinct from automated radar detections.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `avatar_id` | Avatar UUID | String (FK)| Links to global `avatars.avatar_id` |
| `label` | Label | String | E.g. "Friend", "Partner" |
| `cat_ids` | Categories | List | Your categories for this friend |
| `tag_ids` | Tags | List | Your tags for this friend |
| `notes` | Private Notes | Text | Your notes for this friend |
| `created_at` | Added Date | Datetime | |

### `landmarks` (Detected or Manually Added Places)
*Auto-created by radar or manually created.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `landmark_id` | Parcel UUID | String (PK)| Use SL Parcel UUID |
| `landmark_name` | Custom/Parcel Name| String | E.g., "Ataur's Coffee Shop" |
| `sim_name` | Region Name | String | E.g., "Ahern" |
| `position` | Exact Coordinate | Vector | E.g., `<128, 64, 25>` |
| `created_at` | First Visited | Datetime | |

### `landmark_by` (Location Visit Pivot Table)
*Pivot table mapping which user visited which global landmark. Multiple users visiting the same spot creates unique pivot entries.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | Who visited |
| `landmark_id` | Landmark ID | String (FK)| Links to global `landmarks.landmark_id` |
| `created_at` | Link Date | Datetime | When you first visited |

### `user_landmarks` (Manual Saved Locations / Landmarks)
*Strictly your manually saved locations. This is your personal "Landmarks" list.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `landmark_id` | Landmark ID | String (FK)| Links to global `landmarks.landmark_id` |
| `label` | Custom Label | String | Your name for this landmark |
| `cat_ids` | Categories | List | Your categories for this spot |
| `tag_ids` | Tags | List | Your tags for this spot |
| `notes` | Location Notes | Text | Your private notes |
| `created_at` | Added Date | Datetime | |

### `groups` (Custom User Groups)
*Can be pulled via script (active group) or manually created.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `group_id` | Group UUID | String (PK)| Use SL Group UUID |
| `group_name` | Group Name | String | |
| `created_at` | Created Date | Datetime | |

### `group_by` (Group Interaction Pivot Table)
*Pivot table mapping which users interacted with/scanned which global groups.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `group_id` | Group UUID | String (FK)| Links to global `groups.group_id` |
| `created_at` | Link Date | Datetime | |

### `user_groups` (Manual Group Tracking)
*Groups you have manually joined or are tracking specifically.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `group_id` | Group UUID | String (FK)| Links to global `groups.group_id` |
| `label` | Label | String | Custom Name for this group |
| `cat_ids` | Categories | List | |
| `tag_ids` | Tags | List | |
| `notes` | Group Notes | Text | |
| `created_at` | Added Date | Datetime | |

---

## 5. Metadata & History Tables (Personal Logging)

### `categories`
*Your custom UI categories.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `cat_id` | ID | String (PK)| E.g. `CAT_1` |
| `cat_name` | Label | String | |
| `cat_color` | UI Color | Hex | |
| `cat_icon` | UI Icon | String | |
| `created_at` | Date | Datetime | |

### `tags`
*Your custom UI tags.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `tag_id` | ID | String (PK)| E.g. `TAG_1` |
| `tag_name` | Label | String | |
| `tag_color` | UI Color | Hex | |
| `tag_icon` | UI Icon | String | |
| `created_at` | Date | Datetime | |

### `history_daily` (Parent Table - LEVEL 1)
*Daily summaries of who you encountered (Date).*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `avatar_id` | Their UUID | String (FK)| Links to global `avatars` |
| `date` | SL Date | Date | YYYY-MM-DD |
| `history_daily_id` | Join Key | String (PK)| Hash: `owner + contact + date` |
| `is_protected`| Protection | Integer| 0=Auto-delete, 1=Keep |

### `history_locations` (Location Log - LEVEL 2)
*Summarizes all time spent with someone at a specific location that day (Date + Location).*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `history_daily_id` | Parent Key | String (FK)| Links to `history_daily.history_daily_id` |
| `history_location_id`| Join Key | String (PK)| Hash: `history_daily_id + location_id` |
| `location_id` | Parcel UUID | String (FK)| Links to global `locations` |
| `total_visits` | Count | Integer | Times bumped into at this location |

### `history_sessions` (Time Log - LEVEL 3)
*Every specific radar drop-in/drop-out time block (Date + Location + Time).*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `history_location_id`| Parent Key | String (FK)| Links to `history_locations.history_location_id` |
| `first_seen` | Arrival Time | Datetime | |
| `last_seen` | Still there | Datetime | |
| `dist` | Distance | Float | Meters far |

---

## 6. Real-World Scenario Flow

### The Avatar-By Pivot Architecture
To ensure high-performance data processing, radar logging treats avatars globally, but maps their relationship to you locally securely.

**Example 1: Radar Detects a New Avatar (User 1)**
1. **User 1**'s HUD detects **Avatar A**.
2. Script checks the global `avatars` table. Avatar A does not exist.
3. Script creates exactly one record for Avatar A in `avatars` (Global entity).
4. Script creates a pivot record in `avatar_by` stating that **User 1** detected **Avatar A**.

**Example 2: Another User Detects the Same Avatar (User 2)**
1. **User 2**'s HUD detects **Avatar A**.
2. Script checks `avatars`. Avatar A already exists! It skips creating a duplicate global record.
3. Script creates a pivot record in `avatar_by` stating that **User 2** detected **Avatar A**.
*(Result: Avatar A has only ONE global identity, but TWO independent log files tracking who saw them).*

**Example 3: Adding a Friend**
1. User 1 looks at the People list and clicks "Add Friend" on an avatar they scanned.
2. The script adds a row mapping User 1 to the avatar in the `user_avatars` table. This serves as the manual friends tracker, fully separated from passive radar tracking.

**Example 4: Detecting a Location and Saving a Landmark**
1. **User 1** visits a new sim.
2. Script checks the global `landmarks` table. The parcel is not there.
3. Script creates a global record in `landmarks`.
4. Script creates a pivot record in `landmark_by` mapping User 1 to the location.
5. User 1 decided they like the place and clicks "Save Landmark". 
6. Script creates a record in `user_landmarks` with a custom label (e.g., "Favorite Chill Spot"), linking User 1 to the global `landmarks` record.