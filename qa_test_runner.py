#!/usr/bin/env python3
"""
Comprehensive QA test runner for session stop hook timeline functionality.
Implements the testing strategy outlined in SESSION_STOP_HOOK_QA_STRATEGY.md
"""

import json
import os
import sys
import time
import tempfile
import subprocess
import shutil
from pathlib import Path
from typing import Dict, List, Tuple, Any
from datetime import datetime

# Add hooks directory to path
sys.path.insert(0, '/home/bryan/dashboard/.claude/hooks')

class QATestResult:
    def __init__(self, name: str, passed: bool, details: str = "", duration: float = 0.0):
        self.name = name
        self.passed = passed
        self.details = details
        self.duration = duration
        self.timestamp = datetime.now()

class StopHookQARunner:
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.test_results: List[QATestResult] = []
        self.failed_tests: List[str] = []
        self.temp_dirs: List[Path] = []

    def log(self, message: str, level: str = "INFO"):
        """Logging with optional verbosity control."""
        if self.verbose:
            timestamp = datetime.now().strftime("%H:%M:%S")
            print(f"[{timestamp}] {level}: {message}")

    def cleanup_temp_dirs(self):
        """Clean up temporary directories created during testing."""
        for temp_dir in self.temp_dirs:
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
        self.temp_dirs.clear()

    def create_test_environment(self, name: str) -> Path:
        """Create isolated test environment."""
        temp_dir = Path(tempfile.mkdtemp(prefix=f"qa_test_{name}_"))
        self.temp_dirs.append(temp_dir)
        return temp_dir

    def run_test(self, test_func, name: str) -> QATestResult:
        """Run individual test with timing and error handling."""
        self.log(f"Running test: {name}")
        start_time = time.time()

        try:
            passed, details = test_func()
            duration = time.time() - start_time
            result = QATestResult(name, passed, details, duration)

            if passed:
                self.log(f"✅ {name} - PASSED ({duration:.3f}s)")
            else:
                self.log(f"❌ {name} - FAILED ({duration:.3f}s): {details}")
                self.failed_tests.append(name)

        except Exception as e:
            duration = time.time() - start_time
            details = f"Exception: {str(e)}"
            result = QATestResult(name, False, details, duration)
            self.log(f"💥 {name} - ERROR ({duration:.3f}s): {details}")
            self.failed_tests.append(name)

        self.test_results.append(result)
        return result

    # ========== UNIT TESTS ==========

    def test_timeline_basic_creation(self) -> Tuple[bool, str]:
        """Test basic PROJECT_STATUS.md creation."""
        from stop import update_project_status_timeline

        test_dir = self.create_test_environment("basic_creation")
        test_summary = "**Session Summary**: Basic test session. Tools: Read, Write."

        result = update_project_status_timeline(str(test_dir), test_summary)

        if not result:
            return False, "Timeline update returned False"

        status_file = test_dir / "PROJECT_STATUS.md"
        if not status_file.exists():
            return False, "PROJECT_STATUS.md file not created"

        content = status_file.read_text()
        if test_summary not in content:
            return False, "Test summary not found in file content"

        return True, f"File created with {len(content)} characters"

    def test_timeline_append_functionality(self) -> Tuple[bool, str]:
        """Test appending to existing PROJECT_STATUS.md."""
        from stop import update_project_status_timeline

        test_dir = self.create_test_environment("append_test")

        # Create initial file
        first_summary = "**Session Summary**: First session. Tools: Read."
        result1 = update_project_status_timeline(str(test_dir), first_summary)

        # Append second entry
        second_summary = "**Session Summary**: Second session. Tools: Write."
        result2 = update_project_status_timeline(str(test_dir), second_summary)

        if not (result1 and result2):
            return False, "One or both timeline updates failed"

        status_file = test_dir / "PROJECT_STATUS.md"
        content = status_file.read_text()
        entry_count = content.count("## Session Export -")

        if entry_count < 2:
            return False, f"Expected 2+ entries, found {entry_count}"

        if first_summary not in content or second_summary not in content:
            return False, "One or both summaries missing from content"

        return True, f"Successfully appended, {entry_count} total entries"

    def test_error_handling_invalid_directory(self) -> Tuple[bool, str]:
        """Test error handling with invalid directory."""
        from stop import update_project_status_timeline

        invalid_path = "/nonexistent/invalid/path/that/should/not/exist"
        test_summary = "**Session Summary**: Error test."

        result = update_project_status_timeline(invalid_path, test_summary)

        if result:
            return False, "Should have failed with invalid directory"

        return True, "Correctly handled invalid directory"

    def test_session_analysis_empty(self) -> Tuple[bool, str]:
        """Test session analysis with no data."""
        from stop import analyze_session_activity, generate_summary

        # Use non-existent session ID
        analysis = analyze_session_activity("nonexistent_session_id")
        summary = generate_summary(analysis)

        if not summary:
            return False, "Summary generation failed for empty session"

        expected_tools = set()
        if analysis["tools_used"] != expected_tools:
            return False, f"Expected empty tools, got {analysis['tools_used']}"

        return True, f"Generated summary: '{summary}'"

    def test_summary_generation_patterns(self) -> Tuple[bool, str]:
        """Test different summary generation patterns."""
        from stop import generate_summary

        test_cases = [
            {
                "name": "UI Component Work",
                "analysis": {
                    "tools_used": {"Magic", "Write"},
                    "files_modified": {"Button.tsx", "Form.vue"},
                    "commands_run": [],
                    "last_prompt": "create a button component",
                    "key_actions": [],
                    "test_results": None,
                    "errors_encountered": False
                },
                "expected_contains": ["component", "UI"]
            },
            {
                "name": "Documentation Work",
                "analysis": {
                    "tools_used": {"Write", "Edit"},
                    "files_modified": {"README.md", "api.md"},
                    "commands_run": [],
                    "last_prompt": "update the documentation",
                    "key_actions": [],
                    "test_results": None,
                    "errors_encountered": False
                },
                "expected_contains": ["doc"]
            },
            {
                "name": "Hook Development",
                "analysis": {
                    "tools_used": {"Edit", "Bash"},
                    "files_modified": {"hooks/stop.py"},
                    "commands_run": ["python test.py"],
                    "last_prompt": "fix the stop hook",
                    "key_actions": [],
                    "test_results": None,
                    "errors_encountered": False
                },
                "expected_contains": ["hook"]
            }
        ]

        for case in test_cases:
            summary = generate_summary(case["analysis"])
            summary_lower = summary.lower()

            match_found = any(expected in summary_lower for expected in case["expected_contains"])
            if not match_found:
                return False, f"{case['name']}: Expected one of {case['expected_contains']} in '{summary}'"

        return True, "All summary patterns generated correctly"

    # ========== INTEGRATION TESTS ==========

    def test_full_hook_simulation(self) -> Tuple[bool, str]:
        """Test full hook execution simulation."""
        test_dir = self.create_test_environment("full_hook")

        # Create mock session data
        session_data = {
            "session_id": "test_session_full_hook",
            "working_dir": str(test_dir)
        }

        # Create mock session logs
        session_log_dir = Path.home() / ".claude" / "sessions" / session_data["session_id"]
        session_log_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Create mock pre_tool_use.json
            mock_events = [
                {
                    "tool_name": "Edit",
                    "tool_input": {"file_path": str(test_dir / "test.py")},
                    "timestamp": "2024-01-01T12:00:00"
                },
                {
                    "tool_name": "Bash",
                    "tool_input": {"command": "python test.py"},
                    "timestamp": "2024-01-01T12:01:00"
                }
            ]

            with open(session_log_dir / "pre_tool_use.json", 'w') as f:
                json.dump(mock_events, f)

            # Create mock user_prompt_submit.json
            mock_prompts = [
                {
                    "prompt": "Please help me test the session hook functionality",
                    "timestamp": "2024-01-01T12:00:00"
                }
            ]

            with open(session_log_dir / "user_prompt_submit.json", 'w') as f:
                json.dump(mock_prompts, f)

            # Test the analysis and timeline update
            from stop import analyze_session_activity, generate_summary, update_project_status_timeline

            analysis = analyze_session_activity(session_data["session_id"])
            summary = generate_summary(analysis)

            detailed_summary = f"**Session Summary**: {summary}. Tools used: {', '.join(list(analysis['tools_used']))}."
            result = update_project_status_timeline(str(test_dir), detailed_summary)

            if not result:
                return False, "Timeline update failed"

            # Verify the result
            status_file = test_dir / "PROJECT_STATUS.md"
            if not status_file.exists():
                return False, "PROJECT_STATUS.md not created"

            content = status_file.read_text()
            if "Edit" not in content or "Bash" not in content:
                return False, "Expected tools not found in timeline"

            return True, f"Full hook simulation successful, summary: '{summary}'"

        finally:
            # Cleanup mock session logs
            if session_log_dir.exists():
                shutil.rmtree(session_log_dir, ignore_errors=True)

    def test_performance_large_session(self) -> Tuple[bool, str]:
        """Test performance with large session data."""
        test_dir = self.create_test_environment("performance")

        from stop import update_project_status_timeline

        # Create large summary (simulating complex session)
        large_summary = "**Session Summary**: " + "Large session test. " * 100
        large_summary += f"Tools used: {', '.join([f'Tool{i}' for i in range(50)])}. "
        large_summary += f"Files: {', '.join([f'file{i}.py' for i in range(20)])}."

        start_time = time.time()
        result = update_project_status_timeline(str(test_dir), large_summary)
        duration = time.time() - start_time

        if not result:
            return False, "Timeline update failed for large session"

        # Performance threshold: should complete within 100ms for large sessions
        if duration > 0.1:
            return False, f"Performance too slow: {duration:.3f}s (threshold: 0.1s)"

        return True, f"Large session processed in {duration:.3f}s"

    # ========== EDGE CASE TESTS ==========

    def test_special_characters_in_paths(self) -> Tuple[bool, str]:
        """Test handling of special characters in file paths."""
        from stop import update_project_status_timeline

        # Create directory with special characters
        test_dir = self.create_test_environment("special_chars")
        special_subdir = test_dir / "test with spaces & símböls"
        special_subdir.mkdir()

        test_summary = "**Session Summary**: Testing special characters. Files: file with spaces.txt, file_with_üñíčødé.js"

        result = update_project_status_timeline(str(special_subdir), test_summary)

        if not result:
            return False, "Failed to handle special characters in directory path"

        status_file = special_subdir / "PROJECT_STATUS.md"
        if not status_file.exists():
            return False, "PROJECT_STATUS.md not created in special character directory"

        # Verify content can be read back
        try:
            content = status_file.read_text(encoding='utf-8')
            if test_summary not in content:
                return False, "Special character content not preserved"
        except UnicodeDecodeError:
            return False, "Unicode decode error when reading back content"

        return True, "Special characters handled correctly"

    def test_concurrent_timeline_updates(self) -> Tuple[bool, str]:
        """Test concurrent timeline updates (simulated)."""
        from stop import update_project_status_timeline

        test_dir = self.create_test_environment("concurrent")

        # Simulate rapid sequential updates (threading would be more complex)
        summaries = [
            "**Session Summary**: Concurrent test 1. Tools: Read.",
            "**Session Summary**: Concurrent test 2. Tools: Write.",
            "**Session Summary**: Concurrent test 3. Tools: Edit.",
        ]

        results = []
        for i, summary in enumerate(summaries):
            result = update_project_status_timeline(str(test_dir), summary)
            results.append(result)
            time.sleep(0.01)  # Small delay to simulate timing

        if not all(results):
            return False, f"Not all updates succeeded: {results}"

        # Verify all entries are present
        status_file = test_dir / "PROJECT_STATUS.md"
        content = status_file.read_text()
        entry_count = content.count("## Session Export -")

        if entry_count < 3:
            return False, f"Expected 3 entries, found {entry_count}"

        # Check all summaries are present
        for summary in summaries:
            if summary not in content:
                return False, f"Summary missing: {summary[:50]}..."

        return True, f"All {len(summaries)} concurrent updates successful"

    def test_malformed_session_data(self) -> Tuple[bool, str]:
        """Test handling of malformed session data."""
        from stop import analyze_session_activity

        # Create session with malformed JSON
        session_id = "malformed_test_session"
        session_log_dir = Path.home() / ".claude" / "sessions" / session_id
        session_log_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Create malformed JSON file
            with open(session_log_dir / "pre_tool_use.json", 'w') as f:
                f.write('{"invalid": json data without closing brace')

            # Should not crash
            analysis = analyze_session_activity(session_id)

            # Should return empty/default analysis
            if analysis["tools_used"] or analysis["files_modified"]:
                return False, "Should have returned empty analysis for malformed data"

            return True, "Malformed session data handled gracefully"

        finally:
            if session_log_dir.exists():
                shutil.rmtree(session_log_dir, ignore_errors=True)

    # ========== TEST ORCHESTRATION ==========

    def run_unit_tests(self) -> int:
        """Run all unit tests."""
        self.log("🧪 Running Unit Tests", "PHASE")

        unit_tests = [
            (self.test_timeline_basic_creation, "Timeline Basic Creation"),
            (self.test_timeline_append_functionality, "Timeline Append Functionality"),
            (self.test_error_handling_invalid_directory, "Error Handling Invalid Directory"),
            (self.test_session_analysis_empty, "Session Analysis Empty"),
            (self.test_summary_generation_patterns, "Summary Generation Patterns"),
        ]

        passed = 0
        for test_func, name in unit_tests:
            result = self.run_test(test_func, f"Unit: {name}")
            if result.passed:
                passed += 1

        self.log(f"Unit Tests: {passed}/{len(unit_tests)} passed")
        return passed

    def run_integration_tests(self) -> int:
        """Run all integration tests."""
        self.log("🔗 Running Integration Tests", "PHASE")

        integration_tests = [
            (self.test_full_hook_simulation, "Full Hook Simulation"),
            (self.test_performance_large_session, "Performance Large Session"),
        ]

        passed = 0
        for test_func, name in integration_tests:
            result = self.run_test(test_func, f"Integration: {name}")
            if result.passed:
                passed += 1

        self.log(f"Integration Tests: {passed}/{len(integration_tests)} passed")
        return passed

    def run_edge_case_tests(self) -> int:
        """Run all edge case tests."""
        self.log("⚠️ Running Edge Case Tests", "PHASE")

        edge_tests = [
            (self.test_special_characters_in_paths, "Special Characters in Paths"),
            (self.test_concurrent_timeline_updates, "Concurrent Timeline Updates"),
            (self.test_malformed_session_data, "Malformed Session Data"),
        ]

        passed = 0
        for test_func, name in edge_tests:
            result = self.run_test(test_func, f"Edge Case: {name}")
            if result.passed:
                passed += 1

        self.log(f"Edge Case Tests: {passed}/{len(edge_tests)} passed")
        return passed

    def generate_report(self) -> bool:
        """Generate comprehensive test report."""
        total_tests = len(self.test_results)
        passed_tests = sum(1 for r in self.test_results if r.passed)
        total_duration = sum(r.duration for r in self.test_results)

        print("\n" + "=" * 80)
        print("📊 SESSION STOP HOOK QA TEST REPORT")
        print("=" * 80)
        print(f"Test Execution Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total Tests Run: {total_tests}")
        print(f"Tests Passed: {passed_tests}")
        print(f"Tests Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Total Duration: {total_duration:.3f}s")
        print(f"Average Test Duration: {total_duration/total_tests:.3f}s")

        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({len(self.failed_tests)}):")
            for test_name in self.failed_tests:
                failed_result = next((r for r in self.test_results if r.name == test_name), None)
                if failed_result:
                    print(f"  • {test_name}: {failed_result.details}")

        print(f"\n📈 PERFORMANCE SUMMARY:")
        slowest_tests = sorted(self.test_results, key=lambda r: r.duration, reverse=True)[:5]
        for i, test in enumerate(slowest_tests, 1):
            status = "✅" if test.passed else "❌"
            print(f"  {i}. {status} {test.name}: {test.duration:.3f}s")

        success = len(self.failed_tests) == 0

        if success:
            print(f"\n🎉 ALL TESTS PASSED! Session stop hook is ready for production.")
            print(f"✅ Timeline functionality is working correctly")
            print(f"✅ Error handling is robust")
            print(f"✅ Performance is within acceptable limits")
        else:
            print(f"\n⚠️ SOME TESTS FAILED - Review required before production deployment")
            print(f"📋 Review failed tests and fix issues")
            print(f"🔄 Re-run tests after fixes")

        print("=" * 80)
        return success

    def run_all_tests(self) -> bool:
        """Run comprehensive test suite."""
        print("🚀 Starting Session Stop Hook Comprehensive QA Testing")
        print("=" * 80)

        try:
            # Run test phases
            unit_passed = self.run_unit_tests()
            integration_passed = self.run_integration_tests()
            edge_passed = self.run_edge_case_tests()

            # Generate final report
            return self.generate_report()

        finally:
            # Always cleanup
            self.cleanup_temp_dirs()

def main():
    """Main entry point for QA testing."""
    import argparse

    parser = argparse.ArgumentParser(description="Session Stop Hook QA Test Runner")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose output")
    parser.add_argument("--quick", "-q", action="store_true",
                       help="Run only essential tests (faster)")

    args = parser.parse_args()

    runner = StopHookQARunner(verbose=args.verbose)

    if args.quick:
        # Quick test mode - run only critical tests
        print("🏃 Running Quick Test Mode")
        runner.run_test(runner.test_timeline_basic_creation, "Quick: Basic Creation")
        runner.run_test(runner.test_timeline_append_functionality, "Quick: Append Functionality")
        runner.run_test(runner.test_full_hook_simulation, "Quick: Full Simulation")
        success = runner.generate_report()
    else:
        # Full test suite
        success = runner.run_all_tests()

    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())