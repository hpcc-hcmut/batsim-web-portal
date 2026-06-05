"""
Platform validator for SimGrid XML platform files.

SimGrid platform contract:
- Valid XML document
- Root element: <platform> with version attribute (typically "4" or "4.1")
- Must contain at least one zone/AS with computing resources (host or cluster)
- Must have a master_host (used by BatSim as RJMS host)
- Zone routing should not be "None" (causes SimGrid EmptyZone segfault)
"""

import defusedxml.ElementTree as ET
from app.services.validators.validation_result import ValidationResult


def validate_platform(content: str) -> ValidationResult:
    """Validate a SimGrid platform XML string. Returns ValidationResult."""
    result = ValidationResult()

    # Parse XML
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        result.add_error("file", f"Invalid XML: {e}",
                         "Ensure file is well-formed XML")
        return result

    # Check root element
    tag = root.tag.split("}")[-1] if "}" in root.tag else root.tag
    if tag != "platform":
        result.add_error("root", f"Root element must be <platform>, found <{tag}>",
                         "Wrap content in <platform version=\"4\">...</platform>")
        return result

    # Check version attribute
    version = root.get("version")
    if not version:
        result.add_warning("platform.version", "Missing version attribute, BatSim expects version 4+")
    elif not version.startswith("4"):
        result.add_warning("platform.version",
                           f"Version '{version}' detected, BatSim works best with version 4.x")

    # Find zones/AS (SimGrid uses both <zone> and <AS> depending on version)
    zones = root.findall(".//{http://simgrid.org/schema}zone") or []
    zones += root.findall(".//zone") or []
    zones += root.findall(".//{http://simgrid.org/schema}AS") or []
    zones += root.findall(".//AS") or []

    # Check for routing="None" (causes segfault)
    for zone in zones:
        zone_id = zone.get("id", "unknown")
        routing = zone.get("routing", "")
        if routing.lower() == "none":
            result.add_error(f"zone[{zone_id}].routing",
                             "routing='None' causes SimGrid EmptyZone crash",
                             "Change to routing='Full' or another valid routing type")

    # Count compute resources
    hosts = root.findall(".//{http://simgrid.org/schema}host") or []
    hosts += root.findall(".//host") or []
    clusters = root.findall(".//{http://simgrid.org/schema}cluster") or []
    clusters += root.findall(".//cluster") or []

    nb_hosts = len(hosts)
    nb_clusters = len(clusters)

    # Compute total nodes from clusters (parse radical attribute)
    total_compute_nodes = nb_hosts
    for cluster in clusters:
        radical = cluster.get("radical", "")
        total_compute_nodes += _count_radical(radical)

    if nb_hosts == 0 and nb_clusters == 0:
        result.add_error("resources", "No computing resources found",
                         "Add at least one <host> or <cluster> element")

    # Check for master_host
    has_master = False
    for host in hosts:
        if host.get("id") == "master_host":
            has_master = True
            break
    if not has_master:
        result.add_warning("master_host",
                           "No host with id='master_host' found. "
                           "BatSim uses 'master_host' as the RJMS management host by default. "
                           "You can specify a different host via -m flag.")

    # Store metadata
    result.metadata["nb_hosts"] = nb_hosts
    result.metadata["nb_clusters"] = nb_clusters
    result.metadata["total_compute_nodes"] = total_compute_nodes
    # Schedulable hosts = all nodes minus the master (RJMS) host. This is the
    # number jobs can actually run on — used for workload/platform compatibility.
    result.metadata["nb_compute_hosts"] = max(
        total_compute_nodes - (1 if has_master else 0), 0
    )
    result.metadata["platform_version"] = version

    return result


def _count_radical(radical: str) -> int:
    """Count nodes from a SimGrid radical spec like '0-287' or '1-10,20-30'."""
    if not radical:
        return 0
    count = 0
    for part in radical.split(","):
        part = part.strip()
        if "-" in part:
            try:
                start, end = part.split("-", 1)
                count += int(end) - int(start) + 1
            except ValueError:
                count += 1
        else:
            count += 1
    return count
