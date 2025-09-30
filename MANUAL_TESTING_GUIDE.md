# Manual Testing Guide for Session Stop Hook Timeline Functionality

## Overview
This guide provides step-by-step instructions for manual testing of the enhanced session stop hook that automatically updates PROJECT_STATUS.md with session summaries.

## Prerequisites

### Setup Requirements
```bash
# Verify hook is installed and executable
ls -la /home/bryan/dashboard/.claude/hooks/stop.py

# Check dependencies
python3 -c "import json, os, sys, subprocess, datetime, pathlib; print('Dependencies OK')"

# Verify observability integration (optional)
curl -f http://localhost:3000/health 2>/dev/null && echo "Observability server available" || echo "Observability server not running (this is OK)"
```

### Environment Configuration
```bash
# Set environment variables for testing
export ENGINEER_NAME="QA Tester"
export TTS_ENABLED="true"  # or "false" for silent testing
export TTS_PROVIDER="pyttsx3"  # for offline testing
```

## Test Scenarios

### Scenario 1: Simple Development Session

**Objective**: Verify basic timeline functionality with simple file operations.

**Steps**:
1. Navigate to a test project directory:
   ```bash
   mkdir -p /tmp/manual_test_simple
   cd /tmp/manual_test_simple
   ```

2. Start a Claude session and perform these actions:
   - Edit a simple file
   - Run a basic command
   - End the session normally

3. **Expected Results**:
   - PROJECT_STATUS.md created in the directory
   - Contains session summary with timestamp
   - TTS notification plays (if enabled)
   - Summary mentions file editing and command execution

**Validation**:
```bash
# Check if PROJECT_STATUS.md was created
ls -la PROJECT_STATUS.md

# View the content
cat PROJECT_STATUS.md

# Verify format and content
grep "## Session Export -" PROJECT_STATUS.md
grep "Session Summary" PROJECT_STATUS.md
```

### Scenario 2: Complex Multi-Tool Session

**Objective**: Test comprehensive activity tracking with multiple tools and file types.

**Steps**:
1. Set up test environment:
   ```bash
   mkdir -p /tmp/manual_test_complex
   cd /tmp/manual_test_complex
   ```

2. In Claude session, perform diverse activities:
   - Create/edit multiple files (.py, .md, .json)
   - Run various commands (install, build, test)
   - Use web search or research features
   - Delegate tasks to sub-agents (if available)

3. **Expected Results**:
   - Detailed summary capturing all tool usage
   - File count and types mentioned
   - Command execution noted
   - Appropriate summary category (e.g., "updating 3 files")

**Validation**:
```bash
# Check summary comprehensiveness
cat PROJECT_STATUS.md | grep -E "(Tools|Modified files|Commands)"

# Verify multiple activities captured
wc -l PROJECT_STATUS.md  # Should have substantial content
```

### Scenario 3: Documentation-Heavy Session

**Objective**: Test detection and categorization of documentation work.

**Steps**:
1. Create documentation test environment:
   ```bash
   mkdir -p /tmp/manual_test_docs
   cd /tmp/manual_test_docs
   ```

2. Focus on documentation activities:
   - Create/update README.md
   - Edit multiple .md files
   - Work on API documentation
   - Update project wiki content

3. **Expected Results**:
   - Summary identifies this as documentation work
   - Uses phrases like "updating documentation" or "updating X docs"
   - File count reflects multiple .md files

**Validation**:
```bash
# Look for documentation-specific summary
grep -i "doc" PROJECT_STATUS.md
grep -E "\.[0-9]+ docs|documentation" PROJECT_STATUS.md
```

### Scenario 4: Hook Development Session

**Objective**: Test special handling of hook development work.

**Steps**:
1. Set up hooks development context:
   ```bash
   mkdir -p /tmp/manual_test_hooks/.claude/hooks
   cd /tmp/manual_test_hooks
   ```

2. Simulate hook development:
   - Edit files in .claude/hooks/ directory
   - Test hook functionality
   - Update configuration files

3. **Expected Results**:
   - Summary identifies hook development work
   - File paths preserve "hooks/" directory context
   - Uses phrases like "updating hooks" or "updating X hooks"

**Validation**:
```bash
# Check for hook-specific content
grep -i "hook" PROJECT_STATUS.md
grep "hooks/" PROJECT_STATUS.md
```

### Scenario 5: Error Conditions Testing

**Objective**: Verify graceful error handling and recovery.

#### 5a. Read-Only Directory Test
```bash
# Create read-only directory
mkdir -p /tmp/readonly_test
chmod 444 /tmp/readonly_test
cd /tmp/readonly_test

# Perform session activities
# End session - should handle gracefully without crashing
```

**Expected**: No crash, error logged to stderr, TTS still works

#### 5b. Invalid Session Log Test
```bash
# Simulate corrupted session logs (advanced testing)
# This requires manipulating session log files during development
```

**Expected**: Partial analysis continues, no crashes

### Scenario 6: Performance Impact Testing

**Objective**: Verify minimal performance impact on session termination.

**Steps**:
1. Set up performance test:
   ```bash
   mkdir -p /tmp/performance_test
   cd /tmp/performance_test
   ```

2. Create large session activity:
   - Edit many files (10+)
   - Run numerous commands
   - Generate substantial session logs

3. Measure session termination time:
   ```bash
   # Time the session end (manual observation)
   time <end Claude session>
   ```

**Expected**: Session termination adds <100ms overhead

### Scenario 7: Integration Testing

#### 7a. With Observability Server
```bash
# Start observability server if available
# Perform session activities
# Verify events are sent to server
```

#### 7b. Without Observability Server
```bash
# Stop observability server
# Perform session activities
# Verify graceful fallback behavior
```

#### 7c. TTS Configuration Testing
```bash
# Test different TTS settings
export TTS_ENABLED="false"  # Silent mode
export TTS_PROVIDER="openai"  # Different provider
export TTS_PROVIDER="elevenlabs"  # Premium provider
```

## Long-Running Tests

### 24-Hour Stability Test
1. Set up monitoring script:
   ```bash
   #!/bin/bash
   # monitor_timeline.sh
   COUNTER=0
   while true; do
       echo "Test session $COUNTER at $(date)"
       # Perform automated session activities
       sleep 300  # 5-minute intervals
       ((COUNTER++))
   done
   ```

2. Monitor for:
   - Memory leaks
   - Performance degradation
   - File corruption
   - Error accumulation

### Stress Testing
1. Rapid session termination:
   ```bash
   # Simulate multiple rapid session ends
   for i in {1..50}; do
       echo "Session $i"
       # Quick session activities
       # Immediate termination
   done
   ```

2. Large session simulation:
   ```bash
   # Create sessions with extensive activity
   # Monitor resource usage and performance
   ```

## Validation Criteria

### Success Criteria
- [ ] PROJECT_STATUS.md created in all scenarios
- [ ] Timeline entries have proper format and timestamps
- [ ] Session summaries are accurate and meaningful
- [ ] TTS notifications work reliably (when enabled)
- [ ] No crashes or errors in any test scenario
- [ ] Performance impact is minimal (<100ms)
- [ ] Error conditions handled gracefully

### Failure Criteria (Any of these indicates issues)
- [ ] PROJECT_STATUS.md not created when expected
- [ ] Corrupted or malformed timeline entries
- [ ] Inaccurate or meaningless summaries
- [ ] Session termination crashes or hangs
- [ ] Significant performance degradation
- [ ] Data loss or corruption

## Troubleshooting

### Common Issues and Solutions

#### PROJECT_STATUS.md Not Created
```bash
# Check directory permissions
ls -ld .
# Check hook execution
ls -la ~/.claude/hooks/stop.py
# Check for errors in stderr output
```

#### Inaccurate Summaries
```bash
# Check session log availability
ls -la ~/.claude/sessions/*/
# Verify session data
cat ~/.claude/sessions/latest/pre_tool_use.json
```

#### Performance Issues
```bash
# Monitor resource usage
top -p $(pgrep -f stop.py)
# Check for large session logs
du -sh ~/.claude/sessions/*
```

#### TTS Not Working
```bash
# Test TTS directly
speak "Test message"
# Check environment variables
echo $TTS_ENABLED $TTS_PROVIDER
```

## Manual Test Report Template

```markdown
# Manual Test Report - Session Stop Hook Timeline

**Test Date**: ___________
**Tester**: ___________
**Environment**: ___________

## Test Results Summary
- Total Scenarios Tested: ___/7
- Scenarios Passed: ___
- Scenarios Failed: ___
- Overall Success Rate: ___%

## Detailed Results

### Scenario 1: Simple Development Session
- [x] PASS / [ ] FAIL
- Notes: ________________________

### Scenario 2: Complex Multi-Tool Session
- [x] PASS / [ ] FAIL
- Notes: ________________________

### Scenario 3: Documentation-Heavy Session
- [x] PASS / [ ] FAIL
- Notes: ________________________

### Scenario 4: Hook Development Session
- [x] PASS / [ ] FAIL
- Notes: ________________________

### Scenario 5: Error Conditions Testing
- [x] PASS / [ ] FAIL
- Notes: ________________________

### Scenario 6: Performance Impact Testing
- [x] PASS / [ ] FAIL
- Performance Measurement: ___ms
- Notes: ________________________

### Scenario 7: Integration Testing
- [x] PASS / [ ] FAIL
- Notes: ________________________

## Issues Discovered
1. ________________________________
2. ________________________________
3. ________________________________

## Recommendations
1. ________________________________
2. ________________________________
3. ________________________________

## Overall Assessment
[ ] READY FOR PRODUCTION
[ ] NEEDS MINOR FIXES
[ ] NEEDS MAJOR REVISION
[ ] NOT READY

**Signature**: ___________
```

## Conclusion

This manual testing guide provides comprehensive coverage of real-world usage scenarios. Combined with the automated testing suite, it ensures the session stop hook timeline functionality is thoroughly validated before production deployment.

**Remember**: Manual testing complements automated testing by validating user experience and real-world integration scenarios that are difficult to automate.