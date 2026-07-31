#!/usr/bin/env python3
"""
mock_server.py — Local mock Maximo OSLC REST server (localhost:8001)

Serves OSLC-shaped JSON responses that match what a real Maximo Manage
instance would return. Seeded from the same asset/inspection data used
by the React UI stubs.

Run:
    uvx --with flask --with flask-cors run python mcp-maximo/mock_server.py
OR:
    python3 mcp-maximo/mock_server.py   (if flask is installed)
"""

import json, random, string, uuid
from datetime import datetime, timezone
from flask import Flask, jsonify, request, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Seed data (mirrors src/mock-data/) ──────────────────────────────────────

ASSETS = [
    {"assetnum": "BFP-001", "description": "Boiler Feed Pump A",                  "siteid": "BEDFORD", "location": "PLANT-A-LEVEL-2",    "assettype": "PUMP",     "status": "OPERATING", "serialnum": "SN-BFP-2018"},
    {"assetnum": "CWP-002", "description": "Cooling Water Pump B",                 "siteid": "BEDFORD", "location": "PLANT-A-LEVEL-1",    "assettype": "PUMP",     "status": "OPERATING", "serialnum": "SN-CWP-2019"},
    {"assetnum": "HPP-003", "description": "High Pressure Steam Pipe 3-Inch",      "siteid": "BEDFORD", "location": "PLANT-B-PIPE-RACK-01","assettype": "PIPE",     "status": "OPERATING", "serialnum": "SN-HPP-2017"},
    {"assetnum": "CST-004", "description": "Chemical Storage Tank T-04",           "siteid": "BEDFORD", "location": "PLANT-B-TANK-FARM",   "assettype": "TANK",     "status": "DEACTIVATED","serialnum": "SN-CST-2015"},
    {"assetnum": "PWT-005", "description": "Process Water Tank T-05",              "siteid": "BEDFORD", "location": "PLANT-A-TANK-FARM",   "assettype": "TANK",     "status": "OPERATING", "serialnum": "SN-PWT-2016"},
    {"assetnum": "GV-006",  "description": "Gate Valve GV-06",                     "siteid": "BEDFORD", "location": "PLANT-A-LEVEL-1",    "assettype": "VALVE",    "status": "OPERATING", "serialnum": "SN-GV-2020"},
    {"assetnum": "CB-007",  "description": "Conveyor Belt C-07",                   "siteid": "BEDFORD", "location": "WAREHOUSE-LEVEL-1",  "assettype": "CONVEYOR", "status": "OPERATING", "serialnum": "SN-CB-2019"},
    {"assetnum": "DM-008",  "description": "Drive Motor M-08",                     "siteid": "BEDFORD", "location": "PLANT-B-LEVEL-1",    "assettype": "MOTOR",    "status": "OPERATING", "serialnum": "SN-DM-2018"},
    {"assetnum": "LOP-009", "description": "Lube Oil Pump P-09",                   "siteid": "BEDFORD", "location": "PLANT-A-LEVEL-1",    "assettype": "PUMP",     "status": "OPERATING", "serialnum": "SN-LOP-2021"},
    {"assetnum": "DPH-010", "description": "Discharge Pipe Header DH-10",          "siteid": "BEDFORD", "location": "PLANT-B-PIPE-RACK-02","assettype": "PIPE",    "status": "OPERATING", "serialnum": "SN-DPH-2017"},
]

LOCATIONS = [
    {"location": "PLANT-A-LEVEL-1",    "description": "Plant A — Ground Level",      "siteid": "BEDFORD", "type": "OPERLOC"},
    {"location": "PLANT-A-LEVEL-2",    "description": "Plant A — Mezzanine Level",   "siteid": "BEDFORD", "type": "OPERLOC"},
    {"location": "PLANT-A-TANK-FARM",  "description": "Plant A — Tank Farm",         "siteid": "BEDFORD", "type": "OPERLOC"},
    {"location": "PLANT-B-LEVEL-1",    "description": "Plant B — Ground Level",      "siteid": "BEDFORD", "type": "OPERLOC"},
    {"location": "PLANT-B-PIPE-RACK-01","description": "Plant B — Pipe Rack 01",     "siteid": "BEDFORD", "type": "OPERLOC"},
    {"location": "PLANT-B-PIPE-RACK-02","description": "Plant B — Pipe Rack 02",     "siteid": "BEDFORD", "type": "OPERLOC"},
    {"location": "PLANT-B-TANK-FARM",  "description": "Plant B — Tank Farm",         "siteid": "BEDFORD", "type": "OPERLOC"},
    {"location": "WAREHOUSE-LEVEL-1",  "description": "Warehouse — Ground Level",    "siteid": "BEDFORD", "type": "OPERLOC"},
]

# Mutable in-memory stores (seeded once, mutated by POST calls)
WORK_ORDERS: list[dict] = [
    {"wonum": "WO-10045", "description": "Boiler feed pump — bearing inspection",    "status": "COMP",  "assetnum": "BFP-001", "siteid": "BEDFORD", "priority": 2, "reportdate": "2025-05-10T08:30:00Z", "worktype": "CM"},
    {"wonum": "WO-10038", "description": "Steam pipe corrosion — external visual",   "status": "COMP",  "assetnum": "HPP-003", "siteid": "BEDFORD", "priority": 3, "reportdate": "2025-05-08T14:00:00Z", "worktype": "INSP"},
    {"wonum": "WO-10031", "description": "Conveyor belt — alignment check",          "status": "COMP",  "assetnum": "CB-007",  "siteid": "BEDFORD", "priority": 3, "reportdate": "2025-05-07T09:00:00Z", "worktype": "PM"},
    {"wonum": "WO-10025", "description": "Drive motor — thermal hotspot follow-up",  "status": "COMP",  "assetnum": "DM-008",  "siteid": "BEDFORD", "priority": 2, "reportdate": "2025-05-06T13:30:00Z", "worktype": "CM"},
    {"wonum": "WO-10052", "description": "Gate valve — packing gland leak",          "status": "WAPPR", "assetnum": "GV-006",  "siteid": "BEDFORD", "priority": 1, "reportdate": "2025-05-13T07:45:00Z", "worktype": "CM"},
    {"wonum": "WO-10058", "description": "Cooling water pump — vibration analysis",  "status": "INPRG", "assetnum": "CWP-002", "siteid": "BEDFORD", "priority": 2, "reportdate": "2025-05-09T11:00:00Z", "worktype": "CM"},
]

INSPECTION_RESULTS: list[dict] = [
    {"inspectionresultid": "IR-001", "assetnum": "BFP-001", "status": "COMPLETE",    "resultdate": "2025-05-10T09:15:00Z", "inspectionformnum": "FORM-PUMP-01",  "wonum": "WO-10045"},
    {"inspectionresultid": "IR-002", "assetnum": "HPP-003", "status": "COMPLETE",    "resultdate": "2025-05-08T15:30:00Z", "inspectionformnum": "FORM-PIPE-01",  "wonum": "WO-10038"},
    {"inspectionresultid": "IR-003", "assetnum": "CST-004", "status": "INPROG",      "resultdate": "2025-05-12T10:05:00Z", "inspectionformnum": "FORM-TANK-01",  "wonum": None},
    {"inspectionresultid": "IR-004", "assetnum": "CWP-002", "status": "FAILED",      "resultdate": "2025-05-09T11:45:00Z", "inspectionformnum": "FORM-PUMP-01",  "wonum": None},
    {"inspectionresultid": "IR-005", "assetnum": "GV-006",  "status": "PENDING",     "resultdate": "2025-05-13T07:45:00Z", "inspectionformnum": "FORM-VALVE-01", "wonum": None},
    {"inspectionresultid": "IR-006", "assetnum": "CB-007",  "status": "COMPLETE",    "resultdate": "2025-05-07T09:50:00Z", "inspectionformnum": "FORM-CONV-01",  "wonum": "WO-10031"},
    {"inspectionresultid": "IR-007", "assetnum": "DM-008",  "status": "COMPLETE",    "resultdate": "2025-05-06T14:15:00Z", "inspectionformnum": "FORM-MOTOR-01", "wonum": "WO-10025"},
]

# ── Helpers ──────────────────────────────────────────────────────────────────

def _oslc_wrap(members: list, resource_type: str) -> dict:
    """Wrap a list in an OSLC rdfs:member envelope."""
    return {
        "rdfs:member": members,
        "oslc:responseInfo": {
            "oslc:totalCount": len(members),
        },
        "rdf:type": resource_type,
    }


def _apply_where(records: list[dict], where: str) -> list[dict]:
    """
    Minimal OSLC where-clause parser.
    Supports:  field="value"  and  field="%value%"  joined by AND.
    Case-insensitive substring match for % patterns, exact match otherwise.
    """
    if not where:
        return records
    results = records
    for clause in where.split(" AND "):
        clause = clause.strip()
        if '=' not in clause:
            continue
        field, raw_val = clause.split('=', 1)
        field = field.strip().lower()
        raw_val = raw_val.strip().strip('"')
        is_like = raw_val.startswith('%') or raw_val.endswith('%')
        val = raw_val.strip('%').lower()
        filtered = []
        for rec in results:
            rec_val = str(rec.get(field, '')).lower()
            if is_like:
                if val in rec_val:
                    filtered.append(rec)
            else:
                if rec_val == val:
                    filtered.append(rec)
        results = filtered
    return results


def _check_auth(req) -> bool:
    """Accept any non-empty apikey header or Basic auth — POC only."""
    if req.headers.get("apikey"):
        return True
    auth = req.authorization
    if auth and auth.username:
        return True
    return False

# ── Routes ───────────────────────────────────────────────────────────────────

@app.before_request
def require_auth():
    if request.method == "OPTIONS":
        return  # CORS preflight
    if not _check_auth(request):
        return Response(
            json.dumps({"Error": "BMXAA9549E - Authentication required"}),
            status=401,
            mimetype="application/json",
        )


@app.get("/maximo/oslc/os/mxasset")
def get_assets():
    page_size = int(request.args.get("oslc.pageSize", 20))
    where     = request.args.get("oslc.where", "")
    results   = _apply_where(ASSETS, where)[:page_size]
    return jsonify(_oslc_wrap(results, "mxasset"))


@app.get("/maximo/oslc/os/mxwo")
def get_work_orders():
    page_size = int(request.args.get("oslc.pageSize", 20))
    where     = request.args.get("oslc.where", "")
    results   = _apply_where(WORK_ORDERS, where)[:page_size]
    return jsonify(_oslc_wrap(results, "mxwo"))


@app.post("/maximo/oslc/os/mxwo")
def create_work_order():
    body = request.get_json(force=True) or {}
    wo_num = f"WO-{random.randint(10000, 99999)}"
    now    = datetime.now(timezone.utc).isoformat()
    new_wo = {
        "wonum":       wo_num,
        "description": body.get("description", ""),
        "status":      "WAPPR",
        "assetnum":    body.get("assetnum", ""),
        "siteid":      body.get("siteid", "BEDFORD"),
        "priority":    body.get("priority", 3),
        "reportdate":  now,
        "worktype":    body.get("worktype", "CM"),
        "description_longdescription": body.get("description_longdescription", ""),
        "location":    body.get("location", ""),
        "reportedby":  body.get("reportedby", ""),
        "href":        f"http://localhost:8001/maximo/oslc/os/mxwo/{wo_num}",
    }
    WORK_ORDERS.insert(0, new_wo)
    return jsonify(new_wo), 201


@app.get("/maximo/oslc/os/mxinspectionresult")
def get_inspection_results():
    page_size = int(request.args.get("oslc.pageSize", 20))
    where     = request.args.get("oslc.where", "")
    results   = _apply_where(INSPECTION_RESULTS, where)[:page_size]
    return jsonify(_oslc_wrap(results, "mxinspectionresult"))


@app.get("/maximo/oslc/os/mxlocations")
def get_locations():
    page_size = int(request.args.get("oslc.pageSize", 20))
    where     = request.args.get("oslc.where", "")
    results   = _apply_where(LOCATIONS, where)[:page_size]
    return jsonify(_oslc_wrap(results, "mxlocations"))


@app.get("/health")
def health():
    return jsonify({"status": "ok", "server": "mcp-maximo-mock", "port": 8001})


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("━" * 60)
    print("  Maximo Mock Server  →  http://localhost:8001")
    print("  Auth: any non-empty apikey header or Basic creds")
    print("━" * 60)
    app.run(host="0.0.0.0", port=8001, debug=False)
