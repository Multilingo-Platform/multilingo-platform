<#
.SYNOPSIS
    TV3-22 Automated Regression Runner with Safe Evidence Capture.
.DESCRIPTION
    Executes specified gate (Focused, Broad, Postgres), records timestamp, HEAD,
    commands, exit codes, and output logs to .superpowers/tv3-22/<timestamp>/,
    validates environment and workbook checksum invariants, and exits with non-zero
    code if any failure occurs.
.PARAMETER Gate
    The regression gate to run: 'Focused', 'Broad', or 'Postgres'.
.PARAMETER EvidenceRoot
    Optional root directory for evidence. Defaults to '.superpowers/tv3-22'.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('Focused', 'Broad', 'Postgres')]
    [string]$Gate,

    [Parameter(Mandatory = $false)]
    [string]$EvidenceRoot = ".superpowers/tv3-22",

    # R-02 regression probes: run the in-memory Vitest audit probes and exit without
    # executing any gate. Used to prove the audit rejects zero-pass/all-skipped,
    # skipped/todo, missing-summary logs, accepts a valid PASS summary, and keeps FAIL
    # on non-zero exit codes for BOTH `npx vitest` and the Broad `npm test` command.
    [Parameter(Mandatory = $false)]
    [switch]$RunVitestAuditProbes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$EXPECTED_WORKBOOK_SHA256 = "2A9045FE5FAB8562ED675D1EA9991CD476DB32910A5C6507636869FADD8781B8"
$WORKBOOK_PATH = "backend/Exam_Template.xlsx"

# ---------------------------------------------------------------------------
# R-02: Vitest summary audit (single source of truth).
#
# Extracted from Invoke-Step so the same logic serves both real gate steps and
# the built-in regression probes. `npm test -- --maxWorkers=2` (the Broad
# frontend step) delegates to `vitest run`, so it must be routed through this
# audit exactly like explicit `vitest` commands; otherwise the Broad frontend
# step would pass on exit code alone and could hide skipped/summarized-away
# results.
# ---------------------------------------------------------------------------
function Test-VitestCommand {
    param([string]$CommandLine)
    if ($CommandLine -match "vitest") { return $true }
    # Bare `npm test` delegates to vitest in this repository (frontend package.json
    # "test" script); require it to be the actual test command, not e.g. `npm test.e2e`.
    if ($CommandLine -match '(?i)(^|\s)npm\s+test(\s|$)') { return $true }
    return $false
}

function Invoke-VitestSummaryAudit {
    # Deterministic in-memory audit of a Vitest summary against the process exit code.
    # Returns PSCustomObject { ExitCode, Status, Result } where Result carries the
    # same metrics shape used by Invoke-Step (TestsRun/Failures/Errors/Skipped/AuditVerdict/AuditNote).
    param(
        [string]$cleanLog,
        [int]$exitCode
    )

    $m = [PSCustomObject]@{
        TestsRun = $null
        Failures = $null
        Errors = $null
        Skipped = $null
        AuditVerdict = "N/A"
        AuditNote = ""
    }
    $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }

    $matchedVitestSummary = $false
    if ($cleanLog -match '(?m)^\s*Tests\s+(.*?(?:passed|failed|skipped|todo).*?)$') {
        $testsSummaryLine = $Matches[1]
        $matchedVitestSummary = $true

        $vitestTotal = 0
        $vitestPassed = 0
        $vitestFailed = 0
        $vitestSkipped = 0

        if ($testsSummaryLine -match '\((\d+)\)') {
            $vitestTotal = [int]$Matches[1]
        }
        if ($testsSummaryLine -match '(\d+)\s+passed') {
            $vitestPassed = [int]$Matches[1]
        }
        if ($testsSummaryLine -match '(\d+)\s+failed') {
            $vitestFailed = [int]$Matches[1]
        }
        if ($testsSummaryLine -match '(\d+)\s+skipped') {
            $vitestSkipped = [int]$Matches[1]
        }
        if ($testsSummaryLine -match '(\d+)\s+todo') {
            $vitestSkipped += [int]$Matches[1]
        }

        if ($vitestTotal -eq 0 -and ($vitestPassed -gt 0 -or $vitestFailed -gt 0 -or $vitestSkipped -gt 0)) {
            $vitestTotal = $vitestPassed + $vitestFailed + $vitestSkipped
        }

        $m.TestsRun = $vitestTotal
        $m.Failures = $vitestFailed
        $m.Errors = 0
        $m.Skipped = $vitestSkipped

        Write-Host "[VITEST AUDIT] Tests run: $vitestTotal, Passed: $vitestPassed, Failed: $vitestFailed, Skipped: $vitestSkipped" -ForegroundColor Cyan

        if ($vitestFailed -gt 0) {
            $m.AuditVerdict = "TEST_FAILURES"
            $m.AuditNote = "Vitest detected $vitestFailed failure(s)."
            Write-Host "[ERROR] $($m.AuditNote)" -ForegroundColor Red
            $exitCode = 1
            $status = "FAIL"
        }
        elseif ($vitestTotal -eq 0 -or $vitestPassed -eq 0) {
            $m.AuditVerdict = "REJECTED_ZERO_TESTS"
            $m.AuditNote = "Vitest executed 0 tests or 0 passed tests (Total: $vitestTotal, Passed: $vitestPassed)."
            Write-Host "[ERROR] $($m.AuditNote)" -ForegroundColor Red
            $exitCode = 1
            $status = "FAIL"
        }
        elseif ($vitestSkipped -gt 0) {
            $m.AuditVerdict = "REJECTED_SKIPPED_TESTS"
            $m.AuditNote = "Vitest detected $vitestSkipped skipped test(s). Skipped tests are strictly forbidden in regression gates."
            Write-Host "[ERROR] $($m.AuditNote)" -ForegroundColor Red
            $exitCode = 1
            $status = "FAIL"
        }
        elseif ($vitestPassed -ne $vitestTotal) {
            $m.AuditVerdict = "INCONSISTENT_VITEST_COUNTS"
            $m.AuditNote = "Vitest passed count ($vitestPassed) does not match total count ($vitestTotal)."
            Write-Host "[ERROR] $($m.AuditNote)" -ForegroundColor Red
            $exitCode = 1
            $status = "FAIL"
        }
        else {
            $m.AuditVerdict = "VERIFIED_PASS"
            $m.AuditNote = "All $vitestPassed test(s) executed and passed with 0 skipped."
        }
    }

    if (-not $matchedVitestSummary) {
        if ($exitCode -eq 0) {
            $m.AuditVerdict = "MISSING_VITEST_SUMMARY"
            $m.AuditNote = "Vitest command completed with exit code 0 but no 'Tests' summary line was found in output log."
            Write-Host "[ERROR] $($m.AuditNote)" -ForegroundColor Red
            $exitCode = 1
            $status = "FAIL"
        }
    }

    # A non-zero process exit code must never turn into a PASS, even if the summary looks valid.
    if ($exitCode -ne 0) { $status = "FAIL" }

    return [PSCustomObject]@{ ExitCode = $exitCode; Status = $status; Result = $m }
}

function Invoke-VitestAuditProbes {
    # In-memory regression probes for the R-02 finding: no filesystem writes, no gates.
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host " VITEST AUDIT REGRESSION PROBES (R-02) - in-memory, no gates run" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan

    $failures = 0

    # 1. Routing probes: prove the Broad frontend command is audited.
    $probeColorOk = "Green"
    $probeColorFail = "Red"
    $routeCases = @(
        @{ Name = "Broad frontend command 'npm test -- --maxWorkers=2' routes to Vitest audit"; Command = "npm test -- --maxWorkers=2"; Expect = $true },
        @{ Name = "'npx vitest run src/x.test.ts' routes to Vitest audit"; Command = "npx vitest run src/x.test.ts"; Expect = $true },
        @{ Name = "'npm run lint' must NOT route to Vitest audit"; Command = "npm run lint"; Expect = $false }
    )
    foreach ($rc in $routeCases) {
        $routed = Test-VitestCommand -CommandLine $rc.Command
        $pass = ($routed -eq $rc.Expect)
        if (-not $pass) { $failures += 1 }
        Write-Host ("[PROBE {0}] {1} -> routed={2} (expected={3})" -f ($(if ($pass) { "PASS" } else { "FAIL" })), $rc.Name, $routed, $rc.Expect) -ForegroundColor ($(if ($pass) { $probeColorOk } else { $probeColorFail }))
    }

    # 2. Summary-audit probes: rejection cases, acceptance case, and exit-code honesty.
    $logCases = @(
        @{ Name = "valid full-PASS summary accepted"; Log = " Test Files  9 passed (9)`n`n     Tests  130 passed (130)`n"; Exit = 0; ExpectVerdict = "VERIFIED_PASS"; ExpectExit = 0 },
        @{ Name = "all-skipped 'Tests 3 skipped (3)' rejected (zero passed)"; Log = "     Tests  3 skipped (3)`n"; Exit = 0; ExpectVerdict = "REJECTED_ZERO_TESTS"; ExpectExit = 1 },
        @{ Name = "passed+todo summary rejected as skipped"; Log = "     Tests  2 passed (2) | 1 todo (1)`n"; Exit = 0; ExpectVerdict = "REJECTED_SKIPPED_TESTS"; ExpectExit = 1 },
        @{ Name = "passed+skipped summary rejected"; Log = "     Tests  3 passed (3) | 3 skipped (3)`n"; Exit = 0; ExpectVerdict = "REJECTED_SKIPPED_TESTS"; ExpectExit = 1 },
        @{ Name = "missing summary rejected"; Log = " RUN v5.0.3`n`n      done.`n"; Exit = 0; ExpectVerdict = "MISSING_VITEST_SUMMARY"; ExpectExit = 1 },
        @{ Name = "all-failed summary keeps FAIL"; Log = "     Tests  3 failed (3)`n"; Exit = 1; ExpectVerdict = "TEST_FAILURES"; ExpectExit = 1 },
        @{ Name = "non-zero exit keeps FAIL despite valid summary"; Log = "     Tests  3 passed (3)`n"; Exit = 1; ExpectVerdict = "VERIFIED_PASS"; ExpectExit = 1 }
    )
    foreach ($lc in $logCases) {
        $probeResult = Invoke-VitestSummaryAudit -cleanLog $lc.Log -exitCode $lc.Exit
        $pass = ($probeResult.Result.AuditVerdict -eq $lc.ExpectVerdict -and $probeResult.ExitCode -eq $lc.ExpectExit)
        if (-not $pass) { $failures += 1 }
        Write-Host ("[PROBE {0}] {1} -> verdict={2} exit={3} (expected verdict={4} exit={5})" -f ($(if ($pass) { "PASS" } else { "FAIL" })), $lc.Name, $probeResult.Result.AuditVerdict, $probeResult.ExitCode, $lc.ExpectVerdict, $lc.ExpectExit) -ForegroundColor ($(if ($pass) { $probeColorOk } else { $probeColorFail }))
    }

    if ($failures -gt 0) {
        Write-Host "[VITEST PROBES] RESULT: FAIL ($failures probe(s) failed)" -ForegroundColor Red
        return $false
    }
    Write-Host "[VITEST PROBES] RESULT: PASS (all probes passed)" -ForegroundColor Green
    return $true
}

if ($RunVitestAuditProbes) {
    $probesOk = Invoke-VitestAuditProbes
    if ($probesOk) { exit 0 } else { exit 1 }
}

# 1. Initialize Run Context
$runStartTime = Get-Date
$timestamp = $runStartTime.ToUniversalTime().ToString("yyyyMMdd_HHmmssZ")
$repoRoot = (Get-Location).Path
$evidenceDir = Join-Path $repoRoot (Join-Path $EvidenceRoot $timestamp)

if (-not (Test-Path $evidenceDir)) {
    [System.IO.Directory]::CreateDirectory($evidenceDir) | Out-Null
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " MULTILINGO TV3-22 REGRESSION RUNNER" -ForegroundColor Cyan
Write-Host " Gate:         $Gate" -ForegroundColor Yellow
Write-Host " Timestamp:    $timestamp" -ForegroundColor Yellow
Write-Host " Evidence Dir: $evidenceDir" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan

# 2. Check Git Baseline
$gitHead = (git rev-parse HEAD).Trim()
$gitBranch = (git rev-parse --abbrev-ref HEAD).Trim()
$gitStatusRaw = (git status --short)
$gitStatusList = @()
if ($gitStatusRaw) {
    foreach ($line in ($gitStatusRaw -split "`r?`n")) {
        $trimmed = $line.TrimEnd()
        if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
            $code = $trimmed.Substring(0, 2).Trim()
            $path = $trimmed.Substring(2).Trim()
            $gitStatusList += [PSCustomObject]@{
                Status = $code
                Path = $path
            }
        }
    }
}

Write-Host "[GIT] HEAD:   $gitHead" -ForegroundColor Gray
Write-Host "[GIT] Branch: $gitBranch" -ForegroundColor Gray
Write-Host "[GIT] Changes: $($gitStatusList.Count) file(s)" -ForegroundColor Gray

# 3. Check Workbook Invariant (Before Run)
function Verify-WorkbookChecksum {
    param([string]$Stage)
    if (-not (Test-Path $WORKBOOK_PATH)) {
        Write-Error "CRITICAL: Workbook template $WORKBOOK_PATH not found at $Stage!"
        return $false
    }
    $actualHash = (Get-FileHash -Path $WORKBOOK_PATH -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actualHash -ne $EXPECTED_WORKBOOK_SHA256) {
        Write-Error "CRITICAL: Workbook template SHA256 mismatch at $Stage! Expected: $EXPECTED_WORKBOOK_SHA256, Actual: $actualHash"
        return $false
    }
    Write-Host "[INTEGRITY] $Stage Workbook SHA-256 verified: $actualHash" -ForegroundColor Green
    return $true
}

if (-not (Verify-WorkbookChecksum -Stage "Pre-Run")) {
    exit 1
}

# 4. Check Environment Variables (Safe reporting: name & status only)
$trackedEnvVars = @(
    "TV3_PG_TEST_URL",
    "TV3_PG_TEST_USER",
    "TV3_PG_TEST_PASSWORD",
    "TW03_POSTGRES_TEST_URL",
    "TW03_POSTGRES_TEST_USER",
    "TW03_POSTGRES_TEST_PASSWORD",
    "TW04_POSTGRES_TEST_URL",
    "TW04_POSTGRES_TEST_USER",
    "TW04_POSTGRES_TEST_PASSWORD",
    "GEMINI_API_KEY"
)

$envReport = @()
Write-Host "`n[ENVIRONMENT CONFIGURATION]" -ForegroundColor Cyan
foreach ($varName in $trackedEnvVars) {
    $val = [System.Environment]::GetEnvironmentVariable($varName)
    $isConfigured = -not [string]::IsNullOrEmpty($val)
    $statusText = if ($isConfigured) { "Configured" } else { "Not Configured" }
    $color = if ($isConfigured) { "Green" } else { "DarkGray" }
    Write-Host "  - $varName : $statusText" -ForegroundColor $color
    $envReport += [PSCustomObject]@{
        Name = $varName
        Configured = $isConfigured
    }
}

# Pre-flight Check for Postgres Gate (Requires 3 isolated database environments)
if ($Gate -eq "Postgres") {
    $tv3PgUrl = [System.Environment]::GetEnvironmentVariable("TV3_PG_TEST_URL")
    $tv3PgUser = [System.Environment]::GetEnvironmentVariable("TV3_PG_TEST_USER")
    $tv3PgPass = [System.Environment]::GetEnvironmentVariable("TV3_PG_TEST_PASSWORD")
    $tw03PgUrl = [System.Environment]::GetEnvironmentVariable("TW03_POSTGRES_TEST_URL")
    $tw04PgUrl = [System.Environment]::GetEnvironmentVariable("TW04_POSTGRES_TEST_URL")

    $missingPgVars = @()
    if ([string]::IsNullOrEmpty($tv3PgUrl)) { $missingPgVars += "TV3_PG_TEST_URL (Group 1: TV3 Lifecycle/Writing)" }
    if ([string]::IsNullOrEmpty($tv3PgUser)) { $missingPgVars += "TV3_PG_TEST_USER (Group 1: TV3 Lifecycle/Writing)" }
    if ([string]::IsNullOrEmpty($tv3PgPass)) { $missingPgVars += "TV3_PG_TEST_PASSWORD (Group 1: TV3 Lifecycle/Writing)" }
    if ([string]::IsNullOrEmpty($tw03PgUrl)) { $missingPgVars += "TW03_POSTGRES_TEST_URL (Group 2: TW-03 Playback Isolation)" }
    if ([string]::IsNullOrEmpty($tw04PgUrl)) { $missingPgVars += "TW04_POSTGRES_TEST_URL (Group 3: TW-04 Concurrency Isolation)" }

    if ($missingPgVars.Count -gt 0) {
        Write-Host "`n[ERROR] Gate Postgres requires all 3 isolated database environments:" -ForegroundColor Red
        Write-Host "  - Group 1 (TV3): TV3_PG_TEST_URL, TV3_PG_TEST_USER, TV3_PG_TEST_PASSWORD" -ForegroundColor Red
        Write-Host "  - Group 2 (TW-03 Playback): TW03_POSTGRES_TEST_URL" -ForegroundColor Red
        Write-Host "  - Group 3 (TW-04 Concurrency): TW04_POSTGRES_TEST_URL" -ForegroundColor Red
        Write-Host "`nMissing environment variable(s):" -ForegroundColor Red
        foreach ($m in $missingPgVars) {
            Write-Host "  * $m" -ForegroundColor Red
        }
        Write-Host "Test skip or missing credentials is an immediate blocker for Postgres Gate." -ForegroundColor Red

        $failureManifest = [PSCustomObject]@{
            Gate = $Gate
            Timestamp = $timestamp
            GitHead = $gitHead
            GitBranch = $gitBranch
            Status = "BLOCKED"
            Reason = "Missing required PostgreSQL credentials: $($missingPgVars -join '; ')"
            DurationSeconds = 0
            Steps = @()
            GitStatus = $gitStatusList
            Environment = $envReport
        }
        $failureManifest | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $evidenceDir "manifest.json") -Encoding UTF8

        $failureMd = @"
# Gate Postgres — BLOCKED

- **Timestamp:** $timestamp
- **Git HEAD:** ``$gitHead`` ($gitBranch)
- **Status:** **BLOCKED**
- **Reason:** Missing required PostgreSQL environment variables. Tests cannot be skipped or counted as PASS without real execution.

### Missing Configurations:
"@
        foreach ($m in $missingPgVars) {
            $failureMd += "`n- $m"
        }

        $failureMd += @"


## Environment Variable Status (Non-sensitive)

| Variable | Status |
|---|---|
"@
        foreach ($ev in $envReport) {
            $stText = if ($ev.Configured) { "Configured" } else { "Not Configured" }
            $failureMd += "`n| $($ev.Name) | $stText |"
        }

        $failureMd += @"


## Working Tree Git Status

| Status | File Path |
|---|---|
"@
        if ($gitStatusList.Count -eq 0) {
            $failureMd += "`n| Clean | Working tree clean (no uncommitted changes) |"
        } else {
            foreach ($gs in $gitStatusList) {
                $failureMd += "`n| $($gs.Status) | ``$($gs.Path)`` |"
            }
        }

        Set-Content (Join-Path $evidenceDir "summary.md") $failureMd -Encoding UTF8
        exit 1
    }
}

# 5. Command Runner Function
$stepsResults = @()

function Invoke-Step {
    param(
        [string]$StepId,
        [string]$Description,
        [string]$WorkingDirectory,
        [string]$CommandLine,
        # Only the Broad backend step may have environment-gated skipped tests.
        # Pass an explicit, exact class allowlist; every other gate forbids skips entirely.
        [string[]]$AllowedSkippedClasses = @()
    )

    Write-Host "`n----------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "STEP: $StepId - $Description" -ForegroundColor Yellow
    Write-Host "CWD:  $WorkingDirectory" -ForegroundColor Gray
    Write-Host "CMD:  $CommandLine" -ForegroundColor Gray
    Write-Host "----------------------------------------------------------------" -ForegroundColor Yellow

    $logFileName = "$StepId.log"
    $logFilePath = Join-Path $evidenceDir $logFileName

    $stepSw = [System.Diagnostics.Stopwatch]::StartNew()
    $stepStart = Get-Date

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c `"$CommandLine > `"`"$logFilePath`"`" 2>&1`""
    $psi.WorkingDirectory = (Get-Item $WorkingDirectory).FullName
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    $process = [System.Diagnostics.Process]::Start($psi)
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $stepSw.Stop()

    $duration = [math]::Round($stepSw.Elapsed.TotalSeconds, 2)
    $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }

    # Parse and validate test output if log exists
    $testMetrics = [PSCustomObject]@{
        TestsRun = $null
        Failures = $null
        Errors = $null
        Skipped = $null
        AuditVerdict = "N/A"
        AuditNote = ""
    }

    if (Test-Path $logFilePath) {
        $logRaw = Get-Content -Raw $logFilePath
        $cleanLog = $logRaw -replace '\x1b\[[0-9;]*[a-zA-Z]', ''
        if ($CommandLine -match "mvnw.*test") {
            # Maven marks the aggregate summary line with [WARNING] (skipped>0) or [ERROR] (failures>0);
            # only accept the summary when the counts are present, regardless of the marker.
            if ($cleanLog -match '\[INFO\] Results:[\s\S]*?\[(?:INFO|WARNING|ERROR)\] Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)') {
                $testsRun = [int]$Matches[1]
                $failures = [int]$Matches[2]
                $errors = [int]$Matches[3]
                $skipped = [int]$Matches[4]
                $testMetrics.TestsRun = $testsRun
                $testMetrics.Failures = $failures
                $testMetrics.Errors = $errors
                $testMetrics.Skipped = $skipped
                Write-Host "[SUREFIRE AUDIT] Tests run: $testsRun, Failures: $failures, Errors: $errors, Skipped: $skipped" -ForegroundColor Cyan

                if ($testsRun -eq 0) {
                    $testMetrics.AuditVerdict = "REJECTED_ZERO_TESTS"
                    $testMetrics.AuditNote = "Step executed 0 tests. Zero-test execution is strictly forbidden in regression gates."
                    Write-Host "[ERROR] $($testMetrics.AuditNote)" -ForegroundColor Red
                    $exitCode = 1
                    $status = "FAIL"
                }
                elseif ($skipped -gt 0 -and $AllowedSkippedClasses.Count -eq 0) {
                    $testMetrics.AuditVerdict = "REJECTED_SKIPPED_TESTS"
                    $testMetrics.AuditNote = "Step detected $skipped skipped test(s). Skipped tests are strictly forbidden in regression gates."
                    Write-Host "[ERROR] $($testMetrics.AuditNote)" -ForegroundColor Red
                    $exitCode = 1
                    $status = "FAIL"
                }
                elseif ($skipped -gt 0 -and $AllowedSkippedClasses.Count -gt 0) {
                    # Fail-closed skip audit for the Broad step: every skipped class must be one of the
                    # explicitly allow-listed environment-gated/opt-in classes, verified against the
                    # real Surefire XML reports (not assumptions from the console log).
                    # StrictMode-safe accessors (GetAttribute/ChildNodes LocalName) instead of dynamic
                    # .skipped properties, which throw PropertyNotFoundException under Set-StrictMode Latest.
                    $reportsDir = Join-Path (Get-Item $WorkingDirectory).FullName "target\surefire-reports"
                    $skippedClasses = New-Object System.Collections.Generic.List[string]
                    $skippedTestcaseCount = 0
                    foreach ($reportXml in (Get-ChildItem -Path $reportsDir -Filter *.xml -ErrorAction SilentlyContinue)) {
                        try {
                            $suite = [xml](Get-Content $reportXml.FullName -Raw)
                            foreach ($case in @($suite.testsuite.ChildNodes)) {
                                if ($case.NodeType -ne [System.Xml.XmlNodeType]::Element -or $case.LocalName -ne 'testcase') { continue }
                                $hasSkippedNode = @($case.ChildNodes | Where-Object { $_.LocalName -eq 'skipped' }).Count -gt 0
                                if ($hasSkippedNode) {
                                    $skippedTestcaseCount += 1
                                    $className = $case.GetAttribute('classname')
                                    if ($className -and -not $skippedClasses.Contains($className)) {
                                        $skippedClasses.Add($className)
                                    }
                                }
                            }
                        } catch {
                            $testMetrics.AuditVerdict = "REJECTED_SKIP_AUDIT_FAILURE"
                            $testMetrics.AuditNote = "Could not read/parse Surefire report '$($reportXml.Name)' to audit skipped classes: $($_.Exception.Message)"
                            Write-Host "[ERROR] $($testMetrics.AuditNote)" -ForegroundColor Red
                            $exitCode = 1
                            $status = "FAIL"
                            break
                        }
                    }

                    if ($testMetrics.AuditVerdict -ne "REJECTED_SKIP_AUDIT_FAILURE") {
                        $unexpectedSkips = $skippedClasses | Where-Object { $AllowedSkippedClasses -notcontains $_ }
                        if ($unexpectedSkips -and @($unexpectedSkips).Count -gt 0) {
                            $testMetrics.AuditVerdict = "REJECTED_UNEXPECTED_SKIPPED_TESTS"
                            $testMetrics.AuditNote = "Step detected skipped test(s) outside the documented allowlist: $(@($unexpectedSkips) -join ', ')."
                            Write-Host "[ERROR] $($testMetrics.AuditNote)" -ForegroundColor Red
                            $exitCode = 1
                            $status = "FAIL"
                        }
                        elseif ($skippedTestcaseCount -ne $skipped) {
                            $testMetrics.AuditVerdict = "INCONSISTENT_SKIPPED_COUNTS"
                            $testMetrics.AuditNote = "Surefire summary reported $skipped skipped test(s) but XML reports contain $skippedTestcaseCount skipped test case(s) across: $($skippedClasses -join ', ')."
                            Write-Host "[ERROR] $($testMetrics.AuditNote)" -ForegroundColor Red
                            $exitCode = 1
                            $status = "FAIL"
                        }
                        else {
                            $testMetrics.AuditVerdict = "PASS_WITH_DOCUMENTED_SKIPS"
                            $testMetrics.AuditNote = "All $testsRun test(s) executed with 0 failures/errors; $skipped skipped test(s) confined to the documented environment-gated/opt-in classes: $($skippedClasses -join ', ')."
                            Write-Host "[SUREFIRE AUDIT] $($testMetrics.AuditNote)" -ForegroundColor Cyan
                        }
                    }
                }
                elseif ($failures -gt 0 -or $errors -gt 0) {
                    $testMetrics.AuditVerdict = "TEST_FAILURES"
                    $testMetrics.AuditNote = "Step detected $failures failure(s) and $errors error(s)."
                    $exitCode = 1
                    $status = "FAIL"
                }
                else {
                    $testMetrics.AuditVerdict = "VERIFIED_PASS"
                    $testMetrics.AuditNote = "All $testsRun test(s) executed and passed with 0 skipped."
                }
            } else {
                if ($exitCode -eq 0) {
                    $testMetrics.AuditVerdict = "MISSING_SUREFIRE_SUMMARY"
                    $testMetrics.AuditNote = "Maven exited with code 0 but no Surefire 'Results:' summary was found in output log."
                    Write-Host "[ERROR] $($testMetrics.AuditNote)" -ForegroundColor Red
                    $exitCode = 1
                    $status = "FAIL"
                }
            }
        }
        elseif (Test-VitestCommand -CommandLine $CommandLine) {
            $vitestAudit = Invoke-VitestSummaryAudit -cleanLog $cleanLog -exitCode $exitCode
            $testMetrics = $vitestAudit.Result
            $exitCode = $vitestAudit.ExitCode
            $status = $vitestAudit.Status
        }
    }

    $statusColor = if ($exitCode -eq 0) { "Green" } else { "Red" }
    Write-Host "RESULT: $status (Exit Code: $exitCode, Duration: ${duration}s)" -ForegroundColor $statusColor
    Write-Host "LOG:    $logFilePath" -ForegroundColor Gray

    # Print log tail for immediate visibility
    if (Test-Path $logFilePath) {
        # @() guarantees an array even for single-line (scalar String) or empty ($null) files;
        # required because Set-StrictMode -Version Latest makes $string.Count/$null.Count throw.
        $lines = @(Get-Content $logFilePath)
        $tail = if ($lines.Count -gt 25) { $lines[($lines.Count - 25)..($lines.Count - 1)] } else { $lines }
        Write-Host "--- Tail of $logFileName ---" -ForegroundColor DarkGray
        foreach ($line in $tail) {
            Write-Host "  $line" -ForegroundColor DarkGray
        }
        Write-Host "--- End of Tail ---" -ForegroundColor DarkGray
    }

    $stepRecord = [PSCustomObject]@{
        StepId = $StepId
        Description = $Description
        WorkingDirectory = $WorkingDirectory
        CommandLine = $CommandLine
        LogFile = $logFileName
        ExitCode = $exitCode
        Status = $status
        DurationSeconds = $duration
        AuditVerdict = $testMetrics.AuditVerdict
        AuditNote = $testMetrics.AuditNote
        TestsRun = $testMetrics.TestsRun
        Failures = $testMetrics.Failures
        Errors = $testMetrics.Errors
        Skipped = $testMetrics.Skipped
        StartTime = $stepStart.ToUniversalTime().ToString("o")
        EndTime = (Get-Date).ToUniversalTime().ToString("o")
    }

    $script:stepsResults += $stepRecord

    if ($exitCode -ne 0) {
        Write-Host "`n[FATAL] Step $StepId failed with exit code $exitCode ($($testMetrics.AuditNote)). Aborting gate execution immediately (no retry)." -ForegroundColor Red
        return $false
    }
    return $true
}

# 6. Execute Gate Plan
$gateSuccess = $true

if ($Gate -eq "Focused") {
    # 6.1 Backend Focused Suite
    $backendFocusedList = @(
        "ExamReviewContractIT",
        "ListeningPlaybackContractIT",
        "PracticeFeedbackContractIT",
        "ResultSummaryContractIT",
        "TestAttemptResumeControllerIT",
        "WritingFeedbackContractIT",
        "WritingHintsContractIT",
        "WritingGradingLifecycleIT",
        "SubmitAttemptImmutableKeysTest"
    )

    if (Test-Path "backend/src/test/java/com/multilingo/backend/modules/testing/controller/Tv3LifecycleContractIT.java") {
        $backendFocusedList += "Tv3LifecycleContractIT"
    } else {
        Write-Host "[PLANNED] Tv3LifecycleContractIT not present yet (scheduled for TV3-22-02)" -ForegroundColor DarkGray
    }
    if (Test-Path "backend/src/test/java/com/multilingo/backend/modules/testing/controller/Tv3AccessContractIT.java") {
        $backendFocusedList += "Tv3AccessContractIT"
    } else {
        Write-Host "[PLANNED] Tv3AccessContractIT not present yet (scheduled for TV3-22-02)" -ForegroundColor DarkGray
    }

    $backendFocusedDTest = ($backendFocusedList -join ",")
    $backendCmd = ".\mvnw.cmd test `"-Dtest=$backendFocusedDTest`""

    $ok = Invoke-Step -StepId "01_backend_focused" `
                      -Description "Backend focused contract and lifecycle tests" `
                      -WorkingDirectory "backend" `
                      -CommandLine $backendCmd
    if (-not $ok) { $gateSuccess = $false }

    # 6.2 Frontend Focused Suite (Run only if backend passed)
    if ($gateSuccess) {
        $frontendFocusedFiles = @(
            "src/features/exam/__tests__/AudioPlayer.test.tsx",
            "src/features/exam/__tests__/QuestionPalette.test.tsx",
            "src/features/exam/__tests__/examPartUtils.test.ts",
            "src/features/exam/__tests__/OfficialExamWorkspaceContract.test.tsx",
            "src/features/exam/__tests__/WorkspacePage.test.tsx",
            "src/features/exam/__tests__/ToeicWorkspaceContract.test.tsx"
        )

        if (Test-Path "frontend/src/features/exam/__tests__/tv3LifecycleContract.test.tsx") {
            $frontendFocusedFiles += "src/features/exam/__tests__/tv3LifecycleContract.test.tsx"
        } else {
            Write-Host "[PLANNED] tv3LifecycleContract.test.tsx not present yet (scheduled for TV3-22-03)" -ForegroundColor DarkGray
        }
        if (Test-Path "frontend/src/features/exam/__tests__/autosaveSubmitContract.test.tsx") {
            $frontendFocusedFiles += "src/features/exam/__tests__/autosaveSubmitContract.test.tsx"
        }
        if (Test-Path "frontend/src/features/exam/__tests__/writingFeedbackPageContract.test.tsx") {
            $frontendFocusedFiles += "src/features/exam/__tests__/writingFeedbackPageContract.test.tsx"
        }

        $frontendFilesArg = ($frontendFocusedFiles -join " ")
        $frontendCmd = "npx vitest run $frontendFilesArg --maxWorkers=2"

        $ok = Invoke-Step -StepId "02_frontend_focused" `
                          -Description "Frontend focused contract and workspace tests" `
                          -WorkingDirectory "frontend" `
                          -CommandLine $frontendCmd
        if (-not $ok) { $gateSuccess = $false }
    }
}
elseif ($Gate -eq "Broad") {
    # Step 1: Backend broad suite (explicitly excluding GenerateTemplateTest)
    # Environment-gated/opt-in tests are skipped when their prerequisites are absent
    # (PostgreSQL ITs without DB env, opt-in ETS workbook audit). The skipped set is
    # verified against real Surefire reports; anything else outside this allowlist fails the gate.
    $broadAllowedSkippedClasses = @(
        "com.multilingo.backend.modules.exam.service.ETSWorkbookAuditTest",
        "com.multilingo.backend.modules.exam.service.OfficialCatalogPostgresIT",
        "com.multilingo.backend.modules.testing.adapter.repository.AttemptListeningPlaybackPostgresIT",
        "com.multilingo.backend.modules.testing.repository.ExamReviewPostgresIT",
        "com.multilingo.backend.modules.testing.repository.ResultScorePrecisionPostgresIT",
        "com.multilingo.backend.modules.testing.repository.WritingGradingPostgresIT",
        "com.multilingo.backend.modules.testing.repository.WritingHintPostgresIT",
        "com.multilingo.backend.modules.testing.repository.WritingHintPostgresTransactionIT",
        "com.multilingo.backend.modules.testing.service.ListeningPlaybackStartConcurrencyPostgresIT",
        "com.multilingo.backend.modules.testing.service.support.WritingGradingPostgresTransactionIT"
    )
    $ok = Invoke-Step -StepId "01_backend_broad" `
                      -Description "Backend broad test suite (excluding GenerateTemplateTest)" `
                      -WorkingDirectory "backend" `
                      -CommandLine ".\mvnw.cmd clean test `"-Dtest=*,!GenerateTemplateTest`"" `
                      -AllowedSkippedClasses $broadAllowedSkippedClasses
    if (-not $ok) { $gateSuccess = $false }

    # Step 2: Frontend full test suite with maxWorkers=2
    if ($gateSuccess) {
        $ok = Invoke-Step -StepId "02_frontend_full" `
                          -Description "Frontend full test suite with --maxWorkers=2" `
                          -WorkingDirectory "frontend" `
                          -CommandLine "npm test -- --maxWorkers=2"
        if (-not $ok) { $gateSuccess = $false }
    }

    # Step 3: Frontend lint
    if ($gateSuccess) {
        $ok = Invoke-Step -StepId "03_frontend_lint" `
                          -Description "Frontend linter check" `
                          -WorkingDirectory "frontend" `
                          -CommandLine "npm run lint"
        if (-not $ok) { $gateSuccess = $false }
    }

    # Step 4: Frontend build
    if ($gateSuccess) {
        $ok = Invoke-Step -StepId "04_frontend_build" `
                          -Description "Frontend production build" `
                          -WorkingDirectory "frontend" `
                          -CommandLine "npm run build"
        if (-not $ok) { $gateSuccess = $false }
    }

    # Step 5: Git diff hygiene
    if ($gateSuccess) {
        $ok = Invoke-Step -StepId "05_git_diff_check" `
                          -Description "Git diff hygiene check" `
                          -WorkingDirectory "." `
                          -CommandLine "git diff --check"
        if (-not $ok) { $gateSuccess = $false }
    }
}
elseif ($Gate -eq "Postgres") {
    # Step 1: TV3 Lifecycle & Writing Postgres Suites
    $pgCmd1 = ".\mvnw.cmd test `"-Dtest=ResultScorePrecisionPostgresIT,ExamReviewPostgresIT,WritingHintPostgresIT,WritingHintPostgresTransactionIT,WritingGradingPostgresIT,WritingGradingPostgresTransactionIT`""
    $ok = Invoke-Step -StepId "01_postgres_tv3_suites" `
                      -Description "TV3 Score Precision, Review, Hints, and Grading Postgres IT" `
                      -WorkingDirectory "backend" `
                      -CommandLine $pgCmd1
    if (-not $ok) { $gateSuccess = $false }

    # Step 2: TOEIC Playback Postgres Suites
    if ($gateSuccess) {
        $pgCmd2 = ".\mvnw.cmd test `"-Dtest=AttemptListeningPlaybackPostgresIT,ListeningPlaybackStartConcurrencyPostgresIT`""
        $ok = Invoke-Step -StepId "02_postgres_playback_suites" `
                          -Description "Attempt Listening Playback and Concurrency Postgres IT" `
                          -WorkingDirectory "backend" `
                          -CommandLine $pgCmd2
        if (-not $ok) { $gateSuccess = $false }
    }
}

# 7. Check Workbook Invariant (After Run)
$postRunWorkbookOk = Verify-WorkbookChecksum -Stage "Post-Run"
if (-not $postRunWorkbookOk) {
    $gateSuccess = $false
}

# 8. Produce Final Manifest & Summary Artifacts
$totalDuration = [math]::Round(((Get-Date) - $runStartTime).TotalSeconds, 2)
$overallStatus = if ($gateSuccess) { "PASS" } else { "FAIL" }

$manifest = [PSCustomObject]@{
    Gate = $Gate
    Timestamp = $timestamp
    GitHead = $gitHead
    GitBranch = $gitBranch
    Status = $overallStatus
    DurationSeconds = $totalDuration
    WorkbookHashVerified = $postRunWorkbookOk
    Steps = $stepsResults
    GitStatus = $gitStatusList
    Environment = $envReport
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content (Join-Path $evidenceDir "manifest.json") -Encoding UTF8

# Markdown Summary
$summaryMd = @"
# TV3-22 Regression Run Summary — Gate $Gate

- **Status:** **$overallStatus**
- **Timestamp:** $timestamp
- **Git HEAD:** ``$gitHead`` ($gitBranch)
- **Duration:** ${totalDuration}s
- **Workbook Template SHA-256:** ``$EXPECTED_WORKBOOK_SHA256`` (Verified: $postRunWorkbookOk)
- **Evidence Directory:** ``$evidenceDir``

## Steps Summary

| Step ID | Description | Working Directory | Exit Code | Status | Duration | Tests Run | Skipped | Audit Verdict |
|---|---|---|---|---|---|---|---|---|
"@

foreach ($st in $stepsResults) {
    $testsRunStr = if ($null -ne $st.TestsRun) { $st.TestsRun } else { "N/A" }
    $skippedStr = if ($null -ne $st.Skipped) { $st.Skipped } else { "N/A" }
    $verdictStr = if ($null -ne $st.AuditVerdict) { $st.AuditVerdict } else { "N/A" }
    $summaryMd += "`n| $($st.StepId) | $($st.Description) | $($st.WorkingDirectory) | $($st.ExitCode) | $($st.Status) | $($st.DurationSeconds)s | $testsRunStr | $skippedStr | $verdictStr |"
}

$summaryMd += @"


## Environment Variable Status (Non-sensitive)

| Variable | Status |
|---|---|
"@

foreach ($ev in $envReport) {
    $stText = if ($ev.Configured) { "Configured" } else { "Not Configured" }
    $summaryMd += "`n| $($ev.Name) | $stText |"
}

$summaryMd += @"


## Working Tree Git Status

| Status | File Path |
|---|---|
"@

if ($gitStatusList.Count -eq 0) {
    $summaryMd += "`n| Clean | Working tree clean (no uncommitted changes) |"
} else {
    foreach ($gs in $gitStatusList) {
        $summaryMd += "`n| $($gs.Status) | ``$($gs.Path)`` |"
    }
}

Set-Content (Join-Path $evidenceDir "summary.md") $summaryMd -Encoding UTF8

Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host " GATE $Gate OVERALL RESULT: $overallStatus (${totalDuration}s)" -ForegroundColor $(if ($gateSuccess) { "Green" } else { "Red" })
Write-Host " Evidence artifacts written to:" -ForegroundColor Cyan
Write-Host "   - Manifest: $(Join-Path $evidenceDir 'manifest.json')" -ForegroundColor Gray
Write-Host "   - Summary:  $(Join-Path $evidenceDir 'summary.md')" -ForegroundColor Gray
Write-Host "================================================================" -ForegroundColor Cyan

if (-not $gateSuccess) {
    exit 1
}
exit 0
