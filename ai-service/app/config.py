"""Configuration and rule catalogue loader for ExportReady AI Service.
Single Source of Truth: loads rules directly from brain/03_rules_knowledge_base/rules_master_25.json.
"""
from pathlib import Path
import json
import os
from typing import List, Dict, Any, Optional

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
BRAIN_DIR = REPO_ROOT / "brain"
RULES_FILE_PATH = BRAIN_DIR / "03_rules_knowledge_base" / "rules_master_25.json"

DEFAULT_SIMILARITY_THRESHOLD = 0.65
SERVICE_PORT = int(os.environ.get("PORT", 8000))
SERVICE_HOST = os.environ.get("HOST", "0.0.0.0")
SERVICE_TOKEN = os.environ.get("SERVICE_TOKEN", "exportready-dev-token")

# Mandatory verbatim advisory disclaimer from brain/07_security_and_compliance/LEGAL_DISCLAIMERS.md
MANDATORY_LEGAL_DISCLAIMER = (
    "ExportReady is an informational decision-support tool. It is not legal, "
    "regulatory or consulting advice, not a certification, audit or inspection, "
    "and does not guarantee FDA clearance, Green List admission or release of any "
    "shipment at the US border. Results depend entirely on the information and "
    "evidence you provide and on the rule base as of the displayed rule versions, "
    "which may lag official changes. Regulatory decisions rest with FDA and the "
    "competent authorities. Consult qualified regulatory professionals before shipping."
)

_cached_rules: Optional[List[Dict[str, Any]]] = None


def load_rules_master(force_reload: bool = False) -> List[Dict[str, Any]]:
    """Loads the 25 master rules directly from brain/03_rules_knowledge_base/rules_master_25.json."""
    global _cached_rules
    if _cached_rules is not None and not force_reload:
        return _cached_rules

    if not RULES_FILE_PATH.exists():
        raise FileNotFoundError(f"Rules master file not found at: {RULES_FILE_PATH}")

    with open(RULES_FILE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list) or len(data) == 0:
        raise ValueError("rules_master_25.json must contain a non-empty array of rules")

    _cached_rules = data
    return _cached_rules
