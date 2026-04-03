# SCM HUD - Database Schema Design (v3.0 - PERFECT)

This is the final serial order for your professional "History + Encounters" system.

## Table 1: `Users` (HUD Preferences)
| # | Column | Description | Data Type | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `user_uuid` | Your UUID | String (Key) | Primary User |
| 2 | `user_name` | Your Username | String | Account Name (not Display) |
| 3 | `theme` | UI Theme | String | e.g., 'Blue', 'Dark' |
| 4 | `transparency`| UI Alpha | Float | 0.0 to 1.0 |
| 5 | `scale` | UI Size | Float | HUD Zoom |
| 6 | `shared_status` | Sharing mode | Integer | 0=Private, 1=Shared |
| 7 | `history_status` | Recording mode| Integer | 0=Off, 1=On |
| 8 | `history_clean_freq`| Auto-Cleanup | Integer | Days before delete |
| 9 | `radar_scan_freq` | HUD speed | Integer | Seconds (e.g., 1 or 10) |
| 10 | `created_at` | Joined on | Datetime | Initial record |
| 11 | `updated_at` | Last login | Datetime | Last active |

---

## Table 2: `Categories`
| # | Column | Description | Data Type |
| :--- | :--- | :--- | :--- |
| 1 | `owner_uuid` | Your UUID | String |
| 2 | `cat_id` | ID | String |
| 3 | `cat_name` | Label | String |
| 4 | `cat_color` | UI Color | Hex |
| 5 | `cat_icon` | UI Icon | String |
| 6 | `created_at` | Date | Datetime |

---

## Table 3: `Tags`
| # | Column | Description | Data Type |
| :--- | :--- | :--- | :--- |
| 1 | `owner_uuid` | Your UUID | String |
| 2 | `tag_id` | ID | String |
| 3 | `tag_name` | Label | String |
| 4 | `tag_color` | UI Color | Hex |
| 5 | `tag_icon` | UI Icon | String |
| 6 | `created_at` | Date | Datetime |

---

## Table 4: `Contacts`
| # | Column | Description | Data Type |
| :--- | :--- | :--- | :--- |
| 1 | `owner_uuid` | Your UUID | String |
| 2 | `contact_uuid`| Their UUID | String |
| 3 | `contact_name`| Their name | String |
| 4 | `cat_ids` | Category links | List (IDs) |
| 5 | `tag_ids` | Tag links | List (IDs) |
| 6 | `notes` | Your notes | Text |
| 7 | `created_at` | Date added | Datetime |

---

## Table 5: `History` (Parent Table)
| # | Column | Description | Data Type |
| :--- | :--- | :--- | :--- |
| 1 | `date` | SL Date | Date (YYYY-MM-DD) |
| 2 | `target_name` | Name | String |
| 3 | `summary_id` | Join Key | String (Owner_Target_Date) |
| 4 | `owner_uuid` | Your UUID | String |
| 5 | `target_uuid` | Avatar seen | String |
| 6 | `total_scans` | Encounter count| Integer |
| 7 | `is_protected`| Protection | Integer (0/1) |

---

## Table 6: `Encounters` (Child Log)
| # | Column | Description | Data Type |
| :--- | :--- | :--- | :--- |
| 1 | `summary_id` | Link to History| String |
| 2 | `first_seen` | Arrival Time | Time/Datetime |
| 3 | `last_seen` | Still there | Time/Datetime |
| 4 | `dist` | Meters Far | Float |
| 5 | `sim_name` | Region | String |
| 6 | `sim_pos` | Location | Vector |
| 7 | `parcel_name`| Land Name | String |
