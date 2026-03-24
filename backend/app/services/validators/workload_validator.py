"""
Workload validator for BatSim JSON workload format.

BatSim workload contract:
- Root must be a JSON object
- Required: "nb_res" (int > 0), "jobs" (non-empty array), "profiles" (dict)
- Each job: "id" (int >= 0), "subtime" (number >= 0), "res" (int > 0),
            "walltime" (number > 0), "profile" (str referencing profiles dict)
- Each profile: key is string ID, value has "type" (str) + type-specific fields
"""

import json
from app.services.validators.validation_result import ValidationResult

VALID_PROFILE_TYPES = {"delay", "parallel", "parallel_homogeneous",
                       "parallel_homogeneous_total", "composed",
                       "parallel_homogeneous_pfs", "data_staging",
                       "send", "receive"}


def validate_workload(content: str) -> ValidationResult:
    """Validate a BatSim workload JSON string. Returns ValidationResult."""
    result = ValidationResult()

    # Parse JSON
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        result.add_error("file", f"Invalid JSON: {e.msg} at line {e.lineno}",
                         "Ensure file is valid JSON")
        return result

    if not isinstance(data, dict):
        result.add_error("file", "Root must be a JSON object", "Wrap content in {}")
        return result

    # Validate nb_res
    if "nb_res" not in data:
        result.add_error("nb_res", "Required field missing",
                         "Add 'nb_res' with the number of computing resources")
    elif not isinstance(data["nb_res"], int) or data["nb_res"] <= 0:
        result.add_error("nb_res", "Must be a positive integer",
                         "Set to the total number of computing resources")

    # Validate profiles (before jobs, since jobs reference profiles)
    profile_ids = set()
    if "profiles" not in data:
        result.add_error("profiles", "Required field missing",
                         "Add 'profiles' dict with at least one profile")
    elif not isinstance(data["profiles"], dict):
        result.add_error("profiles", "Must be a dictionary",
                         "Use format: {\"1\": {\"type\": \"delay\", \"delay\": 10}}")
    else:
        profile_ids = set(data["profiles"].keys())
        if len(profile_ids) == 0:
            result.add_error("profiles", "Must contain at least one profile",
                             "Add a profile like {\"1\": {\"type\": \"delay\", \"delay\": 10}}")
        for pid, profile in data["profiles"].items():
            if not isinstance(profile, dict):
                result.add_error(f"profiles.{pid}", "Profile must be a dict",
                                 "Use {\"type\": \"delay\", \"delay\": 10}")
                continue
            if "type" not in profile:
                result.add_error(f"profiles.{pid}", "Missing 'type' field",
                                 f"Add 'type', valid types: {', '.join(sorted(VALID_PROFILE_TYPES))}")
            elif profile["type"] not in VALID_PROFILE_TYPES:
                result.add_warning(f"profiles.{pid}.type",
                                   f"Unknown profile type '{profile['type']}', "
                                   f"known types: {', '.join(sorted(VALID_PROFILE_TYPES))}")

    # Validate jobs
    if "jobs" not in data:
        result.add_error("jobs", "Required field missing",
                         "Add 'jobs' array with at least one job")
    elif not isinstance(data["jobs"], list):
        result.add_error("jobs", "Must be an array",
                         "Use format: [{\"id\": 0, \"subtime\": 0, ...}]")
    elif len(data["jobs"]) == 0:
        result.add_error("jobs", "Must contain at least one job",
                         "Add at least one job object")
    else:
        seen_ids = set()
        for i, job in enumerate(data["jobs"]):
            prefix = f"jobs[{i}]"
            if not isinstance(job, dict):
                result.add_error(prefix, "Job must be a dict", "")
                continue

            # Required fields
            if "id" not in job:
                result.add_error(f"{prefix}.id", "Required field missing", "Add integer job ID")
            elif not isinstance(job["id"], int) or job["id"] < 0:
                result.add_error(f"{prefix}.id", "Must be a non-negative integer", "")
            else:
                if job["id"] in seen_ids:
                    result.add_error(f"{prefix}.id", f"Duplicate job ID: {job['id']}", "Each job needs a unique ID")
                seen_ids.add(job["id"])

            if "subtime" not in job:
                result.add_error(f"{prefix}.subtime", "Required field missing",
                                 "Add submission time (>= 0)")
            elif not isinstance(job["subtime"], (int, float)) or job["subtime"] < 0:
                result.add_error(f"{prefix}.subtime", "Must be a non-negative number", "")

            if "res" not in job:
                result.add_error(f"{prefix}.res", "Required field missing",
                                 "Add number of requested resources (> 0)")
            elif not isinstance(job["res"], int) or job["res"] <= 0:
                result.add_error(f"{prefix}.res", "Must be a positive integer", "")
            elif "nb_res" in data and isinstance(data["nb_res"], int) and job["res"] > data["nb_res"]:
                result.add_warning(f"{prefix}.res",
                                   f"Requests {job['res']} resources but platform has {data['nb_res']}")

            if "walltime" not in job:
                result.add_warning(f"{prefix}.walltime", "Missing walltime, job may run indefinitely")
            elif not isinstance(job["walltime"], (int, float)) or job["walltime"] <= 0:
                result.add_error(f"{prefix}.walltime", "Must be a positive number", "")

            if "profile" not in job:
                result.add_error(f"{prefix}.profile", "Required field missing",
                                 "Reference a profile ID from the profiles dict")
            elif str(job["profile"]) not in profile_ids and profile_ids:
                result.add_error(f"{prefix}.profile",
                                 f"References non-existent profile '{job['profile']}'",
                                 f"Available profiles: {', '.join(sorted(profile_ids))}")

    # Store extracted metadata (including parsed data to avoid double-parse)
    result.metadata["nb_res"] = data.get("nb_res")
    result.metadata["job_count"] = len(data.get("jobs", []))
    result.metadata["profile_count"] = len(data.get("profiles", {}))
    result.metadata["_parsed_data"] = data

    return result
