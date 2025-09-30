#!/usr/bin/env python3
"""
Performance benchmarks for session stop hook timeline functionality.
Measures execution time, memory usage, and resource impact.
"""

import json
import os
import sys
import time
import psutil
import tempfile
from pathlib import Path
from typing import Dict, List, Tuple
from statistics import mean, stdev

# Add hooks directory to path
sys.path.insert(0, '/home/bryan/dashboard/.claude/hooks')

class PerformanceBenchmark:
    def __init__(self):
        self.results = []
        self.baseline_memory = psutil.virtual_memory().used

    def measure_execution(self, func, *args, **kwargs) -> Dict:
        """Measure execution time and memory usage of a function."""
        # Get initial memory
        process = psutil.Process()
        initial_memory = process.memory_info().rss

        # Measure execution time
        start_time = time.perf_counter()
        try:
            result = func(*args, **kwargs)
            success = True
            error = None
        except Exception as e:
            result = None
            success = False
            error = str(e)

        end_time = time.perf_counter()
        execution_time = end_time - start_time

        # Get final memory
        final_memory = process.memory_info().rss
        memory_delta = final_memory - initial_memory

        return {
            'execution_time': execution_time,
            'memory_delta': memory_delta,
            'initial_memory': initial_memory,
            'final_memory': final_memory,
            'success': success,
            'result': result,
            'error': error
        }

    def benchmark_timeline_update(self, summary_size: str = "small") -> Dict:
        """Benchmark timeline update with different summary sizes."""
        from stop import update_project_status_timeline

        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            # Generate test summaries of different sizes
            summaries = {
                "small": "**Session Summary**: Small test session. Tools: Read, Write.",
                "medium": "**Session Summary**: " + "Medium test session. " * 20 + "Tools: " + ", ".join([f"Tool{i}" for i in range(10)]) + ".",
                "large": "**Session Summary**: " + "Large test session. " * 100 + "Tools: " + ", ".join([f"Tool{i}" for i in range(50)]) + ". Files: " + ", ".join([f"file{i}.py" for i in range(30)]) + "."
            }

            summary = summaries[summary_size]

            # Benchmark the timeline update
            measurement = self.measure_execution(
                update_project_status_timeline,
                temp_dir,
                summary
            )

            measurement['summary_size'] = summary_size
            measurement['summary_length'] = len(summary)

            return measurement

    def benchmark_session_analysis(self, event_count: int = 10) -> Dict:
        """Benchmark session analysis with different numbers of events."""
        from stop import analyze_session_activity

        # Create mock session with specified number of events
        session_id = f"benchmark_session_{event_count}"
        session_log_dir = Path.home() / ".claude" / "sessions" / session_id
        session_log_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Create mock events
            mock_events = []
            for i in range(event_count):
                event = {
                    "tool_name": f"Tool{i % 5}",  # Rotate through 5 tool types
                    "tool_input": {"file_path": f"/tmp/test_file_{i}.py"},
                    "timestamp": f"2024-01-01T12:{i:02d}:00"
                }
                mock_events.append(event)

            # Write mock session log
            with open(session_log_dir / "pre_tool_use.json", 'w') as f:
                json.dump(mock_events, f)

            # Benchmark the analysis
            measurement = self.measure_execution(
                analyze_session_activity,
                session_id
            )

            measurement['event_count'] = event_count
            return measurement

        finally:
            # Cleanup
            if session_log_dir.exists():
                import shutil
                shutil.rmtree(session_log_dir, ignore_errors=True)

    def benchmark_summary_generation(self, complexity: str = "medium") -> Dict:
        """Benchmark summary generation with different complexity levels."""
        from stop import generate_summary

        # Create test analysis data with different complexity
        complex_analysis = {
            "simple": {
                "tools_used": {"Read"},
                "files_modified": {"test.py"},
                "commands_run": [],
                "last_prompt": "simple test",
                "key_actions": [],
                "test_results": None,
                "errors_encountered": False
            },
            "medium": {
                "tools_used": {"Read", "Write", "Edit", "Bash"},
                "files_modified": {f"file{i}.py" for i in range(10)},
                "commands_run": [f"command {i}" for i in range(5)],
                "last_prompt": "medium complexity test with multiple operations",
                "key_actions": ["managed tasks", "searched web"],
                "test_results": "tests run",
                "errors_encountered": False
            },
            "complex": {
                "tools_used": {"Read", "Write", "Edit", "Bash", "Magic", "WebSearch", "Task", "TodoWrite"},
                "files_modified": {f"component{i}.tsx" for i in range(20)} | {f"doc{i}.md" for i in range(10)},
                "commands_run": [f"complex command {i}" for i in range(20)],
                "last_prompt": "complex test with many operations including UI components, documentation, testing, and task delegation",
                "key_actions": ["managed tasks", "searched web", "delegated to sub-agent"],
                "test_results": "comprehensive tests run",
                "errors_encountered": True
            }
        }

        analysis = complex_analysis[complexity]

        # Benchmark summary generation
        measurement = self.measure_execution(
            generate_summary,
            analysis
        )

        measurement['complexity'] = complexity
        measurement['tools_count'] = len(analysis['tools_used'])
        measurement['files_count'] = len(analysis['files_modified'])

        return measurement

    def run_performance_suite(self, iterations: int = 5) -> Dict:
        """Run comprehensive performance benchmarking suite."""
        print("🏃‍♂️ Running Performance Benchmark Suite")
        print("=" * 60)

        all_results = {
            'timeline_updates': [],
            'session_analysis': [],
            'summary_generation': []
        }

        # Benchmark timeline updates
        print("📊 Benchmarking Timeline Updates...")
        for size in ["small", "medium", "large"]:
            print(f"  Testing {size} summaries...")
            for i in range(iterations):
                result = self.benchmark_timeline_update(size)
                all_results['timeline_updates'].append(result)

        # Benchmark session analysis
        print("🔍 Benchmarking Session Analysis...")
        for event_count in [10, 50, 100, 500]:
            print(f"  Testing {event_count} events...")
            for i in range(iterations):
                result = self.benchmark_session_analysis(event_count)
                all_results['session_analysis'].append(result)

        # Benchmark summary generation
        print("📝 Benchmarking Summary Generation...")
        for complexity in ["simple", "medium", "complex"]:
            print(f"  Testing {complexity} complexity...")
            for i in range(iterations):
                result = self.benchmark_summary_generation(complexity)
                all_results['summary_generation'].append(result)

        return all_results

    def analyze_results(self, results: Dict) -> Dict:
        """Analyze benchmark results and generate statistics."""
        analysis = {}

        for category, measurements in results.items():
            category_analysis = {
                'total_tests': len(measurements),
                'successful_tests': sum(1 for m in measurements if m['success']),
                'failed_tests': sum(1 for m in measurements if not m['success']),
                'execution_times': [m['execution_time'] for m in measurements if m['success']],
                'memory_deltas': [m['memory_delta'] for m in measurements if m['success']]
            }

            if category_analysis['execution_times']:
                category_analysis.update({
                    'avg_execution_time': mean(category_analysis['execution_times']),
                    'max_execution_time': max(category_analysis['execution_times']),
                    'min_execution_time': min(category_analysis['execution_times']),
                    'stdev_execution_time': stdev(category_analysis['execution_times']) if len(category_analysis['execution_times']) > 1 else 0
                })

            if category_analysis['memory_deltas']:
                category_analysis.update({
                    'avg_memory_delta': mean(category_analysis['memory_deltas']),
                    'max_memory_delta': max(category_analysis['memory_deltas']),
                    'min_memory_delta': min(category_analysis['memory_deltas'])
                })

            analysis[category] = category_analysis

        return analysis

    def generate_performance_report(self, results: Dict, analysis: Dict):
        """Generate comprehensive performance report."""
        print("\n" + "=" * 80)
        print("⚡ PERFORMANCE BENCHMARK REPORT")
        print("=" * 80)

        # Overall system info
        memory_info = psutil.virtual_memory()
        cpu_info = psutil.cpu_freq()

        print(f"System Memory: {memory_info.total / (1024**3):.1f} GB total, {memory_info.available / (1024**3):.1f} GB available")
        if cpu_info:
            print(f"CPU Frequency: {cpu_info.current:.0f} MHz")

        # Performance thresholds
        PERFORMANCE_THRESHOLDS = {
            'max_execution_time': 0.100,  # 100ms
            'max_memory_usage': 50 * 1024 * 1024,  # 50MB
            'min_success_rate': 0.99  # 99%
        }

        print(f"\n📋 PERFORMANCE THRESHOLDS:")
        print(f"  Max Execution Time: {PERFORMANCE_THRESHOLDS['max_execution_time']*1000:.0f}ms")
        print(f"  Max Memory Usage: {PERFORMANCE_THRESHOLDS['max_memory_usage']/(1024*1024):.0f}MB")
        print(f"  Min Success Rate: {PERFORMANCE_THRESHOLDS['min_success_rate']*100:.0f}%")

        overall_pass = True

        for category, cat_analysis in analysis.items():
            print(f"\n📊 {category.upper().replace('_', ' ')} RESULTS:")
            print(f"  Total Tests: {cat_analysis['total_tests']}")
            print(f"  Success Rate: {cat_analysis['successful_tests']/cat_analysis['total_tests']*100:.1f}%")

            if cat_analysis.get('avg_execution_time'):
                avg_time_ms = cat_analysis['avg_execution_time'] * 1000
                max_time_ms = cat_analysis['max_execution_time'] * 1000
                print(f"  Avg Execution Time: {avg_time_ms:.2f}ms")
                print(f"  Max Execution Time: {max_time_ms:.2f}ms")

                # Check performance thresholds
                if cat_analysis['max_execution_time'] > PERFORMANCE_THRESHOLDS['max_execution_time']:
                    print(f"  ⚠️  WARNING: Max execution time exceeds threshold!")
                    overall_pass = False
                else:
                    print(f"  ✅ Execution time within threshold")

            if cat_analysis.get('avg_memory_delta'):
                avg_memory_mb = cat_analysis['avg_memory_delta'] / (1024 * 1024)
                max_memory_mb = cat_analysis['max_memory_delta'] / (1024 * 1024)
                print(f"  Avg Memory Delta: {avg_memory_mb:.2f}MB")
                print(f"  Max Memory Delta: {max_memory_mb:.2f}MB")

                if cat_analysis['max_memory_delta'] > PERFORMANCE_THRESHOLDS['max_memory_usage']:
                    print(f"  ⚠️  WARNING: Max memory usage exceeds threshold!")
                    overall_pass = False
                else:
                    print(f"  ✅ Memory usage within threshold")

            success_rate = cat_analysis['successful_tests'] / cat_analysis['total_tests']
            if success_rate < PERFORMANCE_THRESHOLDS['min_success_rate']:
                print(f"  ⚠️  WARNING: Success rate below threshold!")
                overall_pass = False

        # Detailed breakdown for timeline updates
        print(f"\n📈 TIMELINE UPDATE BREAKDOWN:")
        timeline_results = results['timeline_updates']
        for size in ["small", "medium", "large"]:
            size_results = [r for r in timeline_results if r.get('summary_size') == size]
            if size_results:
                avg_time = mean([r['execution_time'] for r in size_results]) * 1000
                avg_length = mean([r['summary_length'] for r in size_results])
                print(f"  {size.capitalize()} ({avg_length:.0f} chars): {avg_time:.2f}ms avg")

        # Detailed breakdown for session analysis
        print(f"\n🔍 SESSION ANALYSIS BREAKDOWN:")
        analysis_results = results['session_analysis']
        for event_count in [10, 50, 100, 500]:
            count_results = [r for r in analysis_results if r.get('event_count') == event_count]
            if count_results:
                avg_time = mean([r['execution_time'] for r in count_results]) * 1000
                print(f"  {event_count} events: {avg_time:.2f}ms avg")

        print(f"\n🎯 OVERALL PERFORMANCE ASSESSMENT:")
        if overall_pass:
            print("✅ ALL PERFORMANCE THRESHOLDS MET")
            print("🚀 Session stop hook is optimized for production use")
            print("📊 Performance impact is minimal and acceptable")
        else:
            print("⚠️  SOME PERFORMANCE THRESHOLDS EXCEEDED")
            print("🔧 Consider optimization before production deployment")
            print("📋 Review warning messages above for specific issues")

        print("=" * 80)
        return overall_pass

def main():
    """Main entry point for performance benchmarking."""
    import argparse

    parser = argparse.ArgumentParser(description="Session Stop Hook Performance Benchmarks")
    parser.add_argument("--iterations", "-i", type=int, default=5,
                       help="Number of iterations per test (default: 5)")
    parser.add_argument("--quick", "-q", action="store_true",
                       help="Run quick benchmark (fewer iterations)")

    args = parser.parse_args()

    iterations = 3 if args.quick else args.iterations

    benchmark = PerformanceBenchmark()

    print("⚡ Starting Session Stop Hook Performance Benchmarks")
    print(f"🔄 Running {iterations} iterations per test")

    # Run the benchmark suite
    results = benchmark.run_performance_suite(iterations)

    # Analyze results
    analysis = benchmark.analyze_results(results)

    # Generate report
    performance_pass = benchmark.generate_performance_report(results, analysis)

    return 0 if performance_pass else 1

if __name__ == "__main__":
    sys.exit(main())