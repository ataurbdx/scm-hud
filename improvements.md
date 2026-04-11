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

### `contacts` (Detected or Manually Added Avatars)
*Auto-created by radar, or manually created. Single source of truth for an avatar's identity.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `contact_id` | Avatar UUID | String (PK)| Use SL UUID (No auto-increment needed) |
| `user_name` | SL Username | String | |
| `display_name` | SL Display Name| String | |
| `created_at` | First Seen | Datetime | |

### `locations` (Detected or Manually Added Places)
*Auto-created by radar or manually created.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `location_id` | Parcel UUID | String (PK)| Use SL Parcel UUID |
| `location_name` | Custom/Parcel Name| String | E.g., "Ataur's Coffee Shop" |
| `sim_name` | Region Name | String | E.g., "Ahern" |
| `position` | Exact Coordinate | Vector | E.g., `<128, 64, 25>` |
| `created_at` | First Visited | Datetime | |

### `groups` (Custom User Groups)
*Can be pulled via script (active group) or manually created.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `group_id` | Group UUID | String (PK)| Use SL Group UUID |
| `group_name` | Group Name | String | |
| `created_at` | Created Date | Datetime | |

---

## 4. Personal Relational Tables (Your Private Info)

### `user_contacts`
*Your private metadata for a detected avatar. Links to global `contacts`.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `contact_id` | Their UUID | String (FK)| Links to `contacts.contact_id` |
| `cat_ids` | Categories | List | |
| `tag_ids` | Tags | List | |
| `notes` | Private Notes | Text | |
| `created_at` | Link Date | Datetime | |

### `user_locations`
*Your private notes/tags for a specific location.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `location_id` | Location Unique ID| String (FK)| Links to `locations.location_id` |
| `cat_ids` | Categories | List | |
| `tag_ids` | Tags | List | |
| `notes` | Location Notes | Text | |
| `created_at` | Link Date | Datetime | |

### `user_groups`
*Your private notes/tags for a specific group.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `group_id` | Group UUID | String (FK)| Links to `groups.group_id` |
| `cat_ids` | Categories | List | |
| `tag_ids` | Tags | List | |
| `notes` | Group Notes | Text | |
| `created_at` | Link Date | Datetime | |

---

## 5. Metadata & History Tables (Personal Logging)

### `user_categories`
*Your custom UI categories.*
| Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- |
| `owner_uuid` | Your UUID | String | |
| `cat_id` | ID | String (PK)| E.g. `CAT_1` |
| `cat_name` | Label | String | |
| `cat_color` | UI Color | Hex | |
| `cat_icon` | UI Icon | String | |
| `created_at` | Date | Datetime | |

### `user_tags`
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
| `contact_id` | Their UUID | String (FK)| Links to global `contacts` |
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