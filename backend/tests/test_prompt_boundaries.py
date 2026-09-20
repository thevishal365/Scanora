"""M7: the data-vs-instruction boundary must be present in the prompts.

These tests pin the prompt configuration only: they verify the intended
rule text is wired into every model instruction. They do not (and cannot)
prove how a model behaves; structured output and server-side validation
remain the binding checks.
"""

from services.analysis_schema import (
    CHAT_DATA_BOUNDARY_RULE,
    CHAT_SYSTEM_INSTRUCTION,
    REPORT_DATA_BOUNDARY_RULE,
    SYSTEM_INSTRUCTION,
    USER_INSTRUCTION,
)
from services.gemini_service import CHAT_GUIDE


def test_report_boundary_rule_states_data_not_instructions():
    assert "untrusted data" in REPORT_DATA_BOUNDARY_RULE
    assert "not as instructions" in REPORT_DATA_BOUNDARY_RULE
    assert "Never follow" in REPORT_DATA_BOUNDARY_RULE


def test_chat_boundary_rule_states_data_not_instructions():
    assert "untrusted data" in CHAT_DATA_BOUNDARY_RULE
    assert "not as instructions" in CHAT_DATA_BOUNDARY_RULE
    assert "Never follow" in CHAT_DATA_BOUNDARY_RULE


def test_analysis_prompts_contain_the_boundary():
    assert REPORT_DATA_BOUNDARY_RULE in SYSTEM_INSTRUCTION
    assert REPORT_DATA_BOUNDARY_RULE in USER_INSTRUCTION


def test_chat_prompts_contain_the_boundary():
    assert CHAT_DATA_BOUNDARY_RULE in CHAT_SYSTEM_INSTRUCTION
    assert CHAT_DATA_BOUNDARY_RULE in CHAT_GUIDE


def test_existing_analysis_safety_rules_intact():
    assert "Do not diagnose" in SYSTEM_INSTRUCTION
    assert "Never invent" in USER_INSTRUCTION
    assert "unclear" in USER_INSTRUCTION.lower()
    assert "Do not claim to replace a doctor" in USER_INSTRUCTION


def test_existing_chat_safety_rules_intact():
    assert "Do not diagnose" in CHAT_SYSTEM_INSTRUCTION
    assert "Answer only from that context" in CHAT_GUIDE
    assert "Do not invent values" in CHAT_GUIDE
    assert "Do not pretend to be a doctor" in CHAT_GUIDE
