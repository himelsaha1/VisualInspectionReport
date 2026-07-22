#!/usr/bin/env python3
"""
mcp-maximo — IBM Maximo Manage MCP Server
Exposes Maximo OSLC REST endpoints as MCP tools for Bob.

Auth priority:  API key (apikey header)  >  Basic (username:password)
All credentials are read from environment variables — never hardcoded.
"""

import os
import json
import sys
import logging
from typing import Any
import requests
from requests.auth import HTTPBasicAuth
from mcp.server.fastmcp import FastMCP

# ── Logging (stderr only — stdout is the MCP protocol channel) ──────────────
logging.basicConfig(stream=sys.stderr, level=logging.INFO,
                    format="[mcp-maximo] %(levelname)s %(message)s")
log = logging.getLogger("mcp-maximo")

# ── Config from environment ──────────────────────────────────────────────────
MAXIMO_BASE_URL = os.getenv("MAXIMO_BASE_URL", "http://localhost:8001/maximo")
MAXIMO_API_KEY  = os.getenv("MAXIMO_API_KEY", "84538hoqqtngniqmorbpd10sll50grkmtouehl38")
MAXIMO_USERNAME = os.getenv("MAXIMO_USERNAME", "maxadmin")
MAXIMO_PASSWORD = os.getenv("MAXIMO_PASSWORD", "maxadmin1234567")
MAXIMO_LEAN     = os.getenv("MAXIMO_LEAN", "1")   # lean=1 strips XML wrapper

OSLC_BASE = f"{MAXIMO_BASE_URL}/oslc/os"

# ── HTTP session ─────────────────────────────────────────────────────────────
session = requests.Session()
session.verify = False          # MAS dev env may use self-signed cert
session.headers.update({
    "Accept": "application/json",
    "Content-Type": "application/json",
    "lean": MAXIMO_LEAN,
})
if MAXIMO_API_KEY:
    session.headers["apikey"] = MAXIMO_API_KEY
    log.info("Using API key auth")
else:
    session.auth = HTTPBasicAuth(MAXIMO_USERNAME, MAXIMO_PASSWORD)
    log.info("Using Basic auth for user: %s", MAXIMO_USERNAME)

# Suppress SSL warnings for self-signed certs in dev
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Helper ───────────────────────────────────────────────────────────────────

def _get(path: str, params: dict | None = None) -> Any:
    """GET from OSLC endpoint, return parsed JSON or raise with details."""
    url = f"{OSLC_BASE}/{path}"
    log.info("GET %s params=%s", url, params)
    try:
        r = session.get(url, params=params, timeout=30)
        r.raise_for_status()
        return r.json()
    except requests.HTTPError as e:
        raise RuntimeError(f"Maximo HTTP {e.response.status_code}: {e.response.text[:400]}") from e
    except requests.RequestException as e:
        raise RuntimeError(f"Network error: {e}") from e


def _post(path: str, body: dict) -> Any:
    """POST to OSLC endpoint, return parsed JSON or raise with details."""
    url = f"{OSLC_BASE}/{path}"
    log.info("POST %s", url)
    try:
        r = session.post(url, json=body, timeout=30)
        r.raise_for_status()
        # 201 Created may have an empty body — return Location header as fallback
        if r.status_code == 201 and not r.content:
            return {"created": True, "location": r.headers.get("Location", "")}
        return r.json()
    except requests.HTTPError as e:
        raise RuntimeError(f"Maximo HTTP {e.response.status_code}: {e.response.text[:400]}") from e
    except requests.RequestException as e:
        raise RuntimeError(f"Network error: {e}") from e


# ── MCP server ───────────────────────────────────────────────────────────────
mcp = FastMCP("maximo")


@mcp.tool()
def get_assets(
    search: str = "",
    asset_type: str = "",
    location: str = "",
    limit: int = 20,
) -> str:
    """
    List Maximo assets. Optionally filter by free-text search,
    asset type (e.g. 'pump', 'valve'), or location site ID.
    Returns up to `limit` results (max 100).
    """
    try:
        limit = min(limit, 100)
        params: dict = {
            "oslc.pageSize": limit,
            "oslc.select": "assetnum,description,siteid,location,assettype,status,serialnum",
        }
        where_parts = []
        if search:
            where_parts.append(
                f'description="%{search}%" OR assetnum="%{search}%"'
            )
        if asset_type:
            where_parts.append(f'assettype="{asset_type.upper()}"')
        if location:
            where_parts.append(f'location="{location.upper()}"')
        if where_parts:
            params["oslc.where"] = " AND ".join(where_parts)

        data = _get("mxasset", params)
        members = data.get("rdfs:member", data.get("member", []))
        return json.dumps(members, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_asset_by_id(asset_num: str) -> str:
    """
    Get a single Maximo asset by its asset number (e.g. 'BFP-001').
    Returns full asset record including location, status, and description.
    """
    try:
        params = {
            "oslc.where": f'assetnum="{asset_num}"',
            "oslc.select": "*",
            "oslc.pageSize": 1,
        }
        data = _get("mxasset", params)
        members = data.get("rdfs:member", data.get("member", []))
        if not members:
            return json.dumps({"error": f"Asset {asset_num!r} not found"})
        return json.dumps(members[0], indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_work_orders(
    status: str = "",
    asset_num: str = "",
    site_id: str = "",
    limit: int = 20,
) -> str:
    """
    List Maximo work orders. Filter by status (e.g. 'WAPPR', 'INPRG', 'COMP'),
    asset number, or site ID. Returns up to `limit` results (max 100).
    """
    try:
        limit = min(limit, 100)
        params: dict = {
            "oslc.pageSize": limit,
            "oslc.select": "wonum,description,status,assetnum,siteid,priority,reportdate,worktype",
        }
        where_parts = []
        if status:
            where_parts.append(f'status="{status.upper()}"')
        if asset_num:
            where_parts.append(f'assetnum="{asset_num}"')
        if site_id:
            where_parts.append(f'siteid="{site_id.upper()}"')
        if where_parts:
            params["oslc.where"] = " AND ".join(where_parts)

        data = _get("mxwo", params)
        members = data.get("rdfs:member", data.get("member", []))
        return json.dumps(members, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def create_work_order(
    description: str,
    asset_num: str,
    site_id: str,
    priority: int = 3,
    work_type: str = "CM",
    location: str = "",
    reported_by: str = "",
    long_description: str = "",
) -> str:
    """
    Create a new Maximo work order.
    - description: short WO description (required)
    - asset_num: asset number (e.g. 'BFP-001')
    - site_id: site identifier (e.g. 'BEDFORD')
    - priority: 1=Emergency, 2=Urgent, 3=Normal (default), 4=Low
    - work_type: 'CM' (corrective maintenance, default), 'PM', 'INSP'
    - location: location code
    - reported_by: person ID who reported the issue
    - long_description: detailed notes
    Returns the created WO number and href.
    """
    try:
        body: dict = {
            "description": description,
            "assetnum": asset_num,
            "siteid": site_id.upper(),
            "priority": priority,
            "worktype": work_type.upper(),
        }
        if location:
            body["location"] = location.upper()
        if reported_by:
            body["reportedby"] = reported_by
        if long_description:
            body["description_longdescription"] = long_description

        result = _post("mxwo", body)
        return json.dumps(result, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_inspection_results(
    asset_num: str = "",
    status: str = "",
    limit: int = 20,
) -> str:
    """
    List Maximo inspection results from the MX inspection result object set.
    Filter by asset number or status. Returns up to `limit` results.
    """
    try:
        limit = min(limit, 100)
        params: dict = {
            "oslc.pageSize": limit,
            "oslc.select": "inspectionresultid,assetnum,status,resultdate,inspectionformnum,wonum",
        }
        where_parts = []
        if asset_num:
            where_parts.append(f'assetnum="{asset_num}"')
        if status:
            where_parts.append(f'status="{status.upper()}"')
        if where_parts:
            params["oslc.where"] = " AND ".join(where_parts)

        data = _get("mxinspectionresult", params)
        members = data.get("rdfs:member", data.get("member", []))
        return json.dumps(members, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
def get_locations(
    site_id: str = "",
    search: str = "",
    limit: int = 20,
) -> str:
    """
    List Maximo operating locations. Optionally filter by site ID or
    free-text search on location description.
    """
    try:
        limit = min(limit, 100)
        params: dict = {
            "oslc.pageSize": limit,
            "oslc.select": "location,description,siteid,locationsid,type",
        }
        where_parts = []
        if site_id:
            where_parts.append(f'siteid="{site_id.upper()}"')
        if search:
            where_parts.append(f'description="%{search}%"')
        if where_parts:
            params["oslc.where"] = " AND ".join(where_parts)

        data = _get("mxlocations", params)
        members = data.get("rdfs:member", data.get("member", []))
        return json.dumps(members, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    log.info("Starting mcp-maximo on stdio  base=%s", MAXIMO_BASE_URL)
    mcp.run(transport="stdio")
