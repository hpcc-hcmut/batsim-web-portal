"""Tests for platform validator."""

import pytest
from app.services.validators.platform_validator import validate_platform


class TestPlatformValidatorValidInputs:
    """Test platform validator with valid inputs."""

    def test_valid_minimal_platform(self):
        """Test validation of minimal valid platform."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
        <host id="compute1" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True
        assert len(result.errors) == 0

    def test_valid_platform_with_cluster(self):
        """Test validation of platform with cluster."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <cluster id="cluster1" radical="0-287"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True

    def test_valid_platform_no_version_warning(self):
        """Test validation warns when version is missing."""
        content = """<?xml version="1.0"?>
<platform>
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True
        assert any("version" in w.field for w in result.warnings)

    def test_valid_platform_version_3_warning(self):
        """Test validation warns for non-4.x version."""
        content = """<?xml version="1.0"?>
<platform version="3">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True
        assert any("version" in w.field and "4.x" in w.message for w in result.warnings)

    def test_valid_platform_multiple_zones(self):
        """Test validation with multiple zones."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
        <host id="compute1" power="100"/>
    </zone>
    <zone id="AS1" routing="Full">
        <host id="compute2" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True

    def test_valid_platform_mixed_hosts_clusters(self):
        """Test validation with both hosts and clusters."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
        <cluster id="cluster1" radical="0-15"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True

    def test_valid_platform_with_namespace(self):
        """Test validation with SimGrid XML namespace."""
        content = """<?xml version="1.0"?>
<platform version="4" xmlns="http://simgrid.org/schema">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True


class TestPlatformValidatorInvalidXML:
    """Test platform validator with invalid XML."""

    def test_invalid_xml_syntax(self):
        """Test validation fails on invalid XML."""
        result = validate_platform("<platform><host></zone>")
        assert result.valid is False
        assert len(result.errors) == 1
        assert result.errors[0].field == "file"
        assert "Invalid XML" in result.errors[0].error

    def test_empty_xml(self):
        """Test validation fails on empty XML."""
        result = validate_platform("")
        assert result.valid is False

    def test_not_xml(self):
        """Test validation fails on non-XML content."""
        result = validate_platform("not xml at all")
        assert result.valid is False


class TestPlatformValidatorRootElement:
    """Test platform validator root element checks."""

    def test_wrong_root_element(self):
        """Test validation fails with wrong root element."""
        content = """<?xml version="1.0"?>
<topology version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
    </zone>
</topology>"""
        result = validate_platform(content)
        assert result.valid is False
        assert result.errors[0].field == "root"
        assert "must be <platform>" in result.errors[0].error

    def test_wrong_root_as(self):
        """Test validation fails with AS as root."""
        content = """<?xml version="1.0"?>
<AS version="4" id="AS0" routing="Full">
    <host id="master_host" power="100"/>
</AS>"""
        result = validate_platform(content)
        assert result.valid is False


class TestPlatformValidatorResources:
    """Test platform validator resource checks."""

    def test_no_resources_error(self):
        """Test validation fails when no hosts or clusters."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is False
        assert any("No computing resources" in e.error for e in result.errors)

    def test_single_host(self):
        """Test validation succeeds with single host."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="compute1" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True

    def test_metadata_single_host(self):
        """Test metadata extraction with single host."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.metadata["nb_hosts"] == 1
        assert result.metadata["nb_clusters"] == 0
        assert result.metadata["total_compute_nodes"] == 1

    def test_metadata_multiple_hosts(self):
        """Test metadata extraction with multiple hosts."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
        <host id="compute1" power="100"/>
        <host id="compute2" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.metadata["nb_hosts"] == 3


class TestPlatformValidatorClusters:
    """Test platform validator cluster handling."""

    def test_single_cluster(self):
        """Test validation with single cluster."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <cluster id="cluster0" radical="0-15"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True
        assert result.metadata["nb_clusters"] == 1

    def test_cluster_radical_range(self):
        """Test metadata extraction from cluster radical."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <cluster id="cluster0" radical="0-9"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.metadata["total_compute_nodes"] == 10  # 0-9 inclusive

    def test_cluster_radical_multiple_ranges(self):
        """Test metadata extraction with multiple radical ranges."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <cluster id="cluster0" radical="0-9,20-29"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        # 0-9 (10 nodes) + 20-29 (10 nodes) = 20 nodes
        assert result.metadata["total_compute_nodes"] == 20

    def test_cluster_radical_single_item(self):
        """Test metadata extraction with single item in radical."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <cluster id="cluster0" radical="0"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.metadata["total_compute_nodes"] == 1


class TestPlatformValidatorRouting:
    """Test platform validator routing checks."""

    def test_routing_none_error(self):
        """Test validation fails with routing='None'."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="None">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is False
        assert any("routing='None' causes" in e.error for e in result.errors)

    def test_routing_none_case_insensitive(self):
        """Test validation catches 'none' in any case."""
        for routing in ["None", "NONE", "none", "NoNe"]:
            content = f"""<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="{routing}">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
            result = validate_platform(content)
            assert result.valid is False

    def test_routing_full_valid(self):
        """Test validation succeeds with routing='Full'."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True

    def test_routing_dijkstra_valid(self):
        """Test validation succeeds with routing='Dijkstra'."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Dijkstra">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True

    def test_routing_missing_default(self):
        """Test validation with missing routing attribute."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        # Missing routing is allowed (defaults to something)
        assert result.valid is True


class TestPlatformValidatorMasterHost:
    """Test platform validator master_host checks."""

    def test_has_master_host(self):
        """Test validation with master_host present."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
        <host id="compute1" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True
        assert not any("master_host" in w.message for w in result.warnings)

    def test_no_master_host_warning(self):
        """Test validation warns when master_host is missing."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="compute1" power="100"/>
        <host id="compute2" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True
        assert any("master_host" in w.message for w in result.warnings)

    def test_master_host_in_cluster(self):
        """Test validation with master_host in hosts (not cluster)."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
        <cluster id="cluster0" radical="0-9"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.valid is True
        assert not any("master_host" in w.message for w in result.warnings)


class TestPlatformValidatorMetadata:
    """Test platform validator metadata extraction."""

    def test_metadata_hosts_clusters_combined(self):
        """Test metadata with both hosts and clusters."""
        content = """<?xml version="1.0"?>
<platform version="4">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
        <host id="compute1" power="100"/>
        <cluster id="cluster0" radical="0-19"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.metadata["nb_hosts"] == 2
        assert result.metadata["nb_clusters"] == 1
        assert result.metadata["total_compute_nodes"] == 22  # 2 hosts + 20 from cluster

    def test_metadata_version(self):
        """Test metadata captures platform version."""
        content = """<?xml version="1.0"?>
<platform version="4.1">
    <zone id="AS0" routing="Full">
        <host id="master_host" power="100"/>
    </zone>
</platform>"""
        result = validate_platform(content)
        assert result.metadata["platform_version"] == "4.1"
