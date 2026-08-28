# Firewall Monitor

Firewall Monitor is a Cribl app for real-time firewall log investigation. Search, filter, and export Palo Alto Networks traffic logs stored in Cribl Lake — directly from the Cribl UI.

## Summary

Firewall Monitor gives security analysts and network engineers instant access to firewall traffic data without leaving Cribl. Point it at any Lake dataset containing Palo Alto logs, and get a purpose-built search interface with inline filtering, copy-to-clipboard, and CSV export.

## What This App Does

* Primary purpose: Search and investigate firewall traffic logs in Cribl Lake
* Key capabilities:
  * Execute KQL queries against firewall datasets with configurable time ranges
  * Filter results by source IP, destination IP, port, action, and protocol
  * Copy cell values and double-click to drill down into specific IPs or ports
  * Export filtered results to CSV for compliance or offline analysis
  * Fully editable KQL query with time-range placeholders
* Intended users:
  * Security Analyst
  * Network Engineer
  * SOC Operator
* Works with:
  * Cribl Search
  * Cribl Lake
  * Cribl.Cloud

## When To Use This App

* Investigating blocked or allowed traffic to/from specific hosts
* Searching for lateral movement patterns across firewall logs
* Exporting filtered firewall data for audit or compliance reporting
* Quick triage during incident response — filter by IP, port, or action in seconds

## Before You Install

* Required: Cribl.Cloud with Cribl Search and Cribl Lake enabled
* Required: A Lake dataset containing Palo Alto Networks traffic logs
* Required: User must have Search permissions to create and view search jobs
* No external systems or APIs required

## Installation

### Install From Marketplace
1. Go to **Apps** in your Cribl environment.
2. Find **Firewall Monitor** in the Marketplace.
3. Review the app details and complete installation.

### Manual Install
1. Download the `.tgz` package from Releases.
2. In Cribl, go to **Apps** and choose import from file.
3. Upload the `.tgz` file and complete installation.

## Configuration

| Setting | Required | Description | Example |
|---------|----------|-------------|---------|
| Dataset | Yes | Cribl Lake dataset containing firewall logs | `palo-logs` |
| KQL Query | Yes | Search query with `$FROM` and `$TO` time placeholders | See default below |

Default query:
```
dataset="palo-logs"
| where _time >= $FROM and _time <= $TO
| project _time, source_ip, source_port, destination_ip, destination_port, protocol, action, rule_name, application
| sort by _time desc
| limit 1000
```

The query is fully editable. Change field names to match your data, add filters, or adjust the limit.

## How To Use

### First-Run
1. Open the app — you'll see the Configure screen
2. Select your firewall dataset from the dropdown (or type it manually)
3. Review the default KQL query — edit if needed
4. Click **Save**

### Searching
1. Set the time range using the date and time pickers
2. Optionally filter by Source IP, Destination IP, Port, Action, or Protocol
3. Click **Search**
4. Results populate the table — paginated at 100 rows

### Interacting with Results
* **Hover** any cell to see a copy icon — click it to copy the value
* **Double-click** an IP, port, protocol, or action to instantly filter the table
* **Click** an Allow/Deny badge to filter by that action
* **Export** — click Export to download the filtered results as CSV

## Permissions

### Cribl API Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/m/default_search/search/datasets` | List available datasets during configuration |
| GET | `/m/default_search/search/datasets/*/fields` | Discover fields in the selected dataset |
| POST | `/m/default_search/search/jobs` | Execute search queries |
| GET | `/m/default_search/search/jobs/*/results-poll` | Retrieve paginated search results |
| POST | `/m/default_search/search/jobs/*/cancel` | Cancel a running search |

If a user lacks dataset or search permissions, the app will display an error message rather than failing silently.

## External API Access

This app makes no external API calls. All data access is through the Cribl platform APIs.

## Data And Storage

* No persistent storage is used in local development
* In production (Cribl.Cloud), app configuration is stored in the app-scoped KV store
* No data is written to datasets — this app is read-only
* No cleanup required on uninstall

## Support

### Community Built
This app is provided as a community contribution for security teams using Cribl with Palo Alto Networks firewalls. Maintenance and updates depend on the community maintainer.

## Known Limitations

* Queries are limited to 1000 results by default (adjustable in the KQL query)
* The table displays a fixed set of columns — edit the KQL `project` clause to change which fields appear
* Time range uses epoch seconds — subsecond precision is not supported in the picker UI
* Dataset auto-discovery requires Cribl.Cloud (manual entry available as fallback)

## Development

```bash
npm install
npm run dev       # Start dev server at localhost:5173
npm run build     # Production build
npm run package   # Create .tgz for distribution
```

## Project Layout

```text
src/
  App.tsx          — Main application component
  App.css          — Styles
  Settings.tsx     — Configuration drawer
  config.ts        — Config types and default query
  api.ts           — Cribl Search API client
  main.tsx         — Entry point
config/
  policies.yml     — Cribl API permissions
  proxies.yml      — External domain declarations (none)
public/
  favicon.svg
```

## App Metadata

| Field | Value |
|-------|-------|
| App Name | Firewall Monitor |
| App ID | firewall-monitor |
| Version | 1.0.0 |
| Author | Cribl |
| Support Model | community-built |
| Support Label | Community Built |
| License | MIT |
| Product Tags | search, lake |
| Category | Security |
| Audience | analyst, admin |
| Availability | ga |
| Requires External Access | no |
| README Schema Version | 1.0 |
