param(
    [Parameter(Mandatory = $true)][int]$ExamId,
    [string]$BaseUrl = 'http://localhost:8088'
)

$ErrorActionPreference = 'Stop'
if ($BaseUrl -notmatch '^http://(localhost|127\.0\.0\.1):\d+$') { throw 'Only a local application target is allowed.' }
if (-not $env:NLTV_SMOKE_ACCESS_TOKEN) { throw 'Set NLTV_SMOKE_ACCESS_TOKEN to an authenticated local admin token.' }
$nltvHeaders = @{ Authorization = 'Bearer ' + $env:NLTV_SMOKE_ACCESS_TOKEN }
function Invoke-NltvApi([string]$Method, [string]$Path, $Body = $null) {
    $request = @{ Method = $Method; Uri = "$BaseUrl/api/v1$Path"; Headers = $nltvHeaders; TimeoutSec = 30 }
    if ($null -ne $Body) { $request.ContentType = 'application/json'; $request.Body = ConvertTo-Json -InputObject $Body -Depth 60 -Compress }
    $response = Invoke-RestMethod @request
    if (-not $response.success) { throw "API failed: $Method $Path" }
    return $response.data
}
function Assert-Nltv([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}

$structure = Invoke-NltvApi GET "/exams/$ExamId/structure"
Assert-Nltv ($structure.code -eq 'NLTV-SAMPLE-T1-V1' -and $structure.examLanguage -eq 'vi') 'Unexpected published exam identity.'
Assert-Nltv ($structure.sections.Count -eq 3 -and $structure.durationMinutes -eq 180) 'Unexpected structure/duration.'
$bundle = Invoke-NltvApi GET "/admin/exams/$ExamId/dataset-export"
$approved = Get-Content (Join-Path $PSScriptRoot '../../backend/src/main/resources/datasets/exams/nltv-sample-test-1.v2.json') -Raw | ConvertFrom-Json
Assert-Nltv ($bundle.checksum -eq $approved.checksum) 'Stored content differs from the approved runtime bundle.'
$results = @()

foreach ($mode in @('PRACTICE', 'MOCK_TEST')) {
    $workspace = Invoke-NltvApi POST '/attempts' @{ examId = $ExamId; testScope = 'FULL_EXAM'; testMode = $mode }
    $attemptId = $workspace.attemptId
    $safeJson = ConvertTo-Json -InputObject $workspace -Depth 60 -Compress
    Assert-Nltv ($safeJson -notmatch '"(correct_answer|correctAnswer|explanation|grading_key|gradingKey|alternates)"\s*:') 'Workspace exposed private grading fields.'
    if ($mode -eq 'MOCK_TEST') {
        $minutes = ([datetime]$workspace.deadline - [datetime]$workspace.startTime).TotalMinutes
        Assert-Nltv ($minutes -eq 180) 'Mock deadline is not 180 minutes.'
    } else { Assert-Nltv ($null -eq $workspace.deadline) 'Practice must not have a deadline.' }

    $allAnswers = @()
    $essayAnswers = @()
    for ($sectionIndex = 0; $sectionIndex -lt 3; $sectionIndex++) {
        $sectionAnswers = @()
        foreach ($sourcePart in $bundle.request.sections[$sectionIndex].parts) {
            $part = $structure.sections[$sectionIndex].parts | Where-Object { $_.partNumber -eq $sourcePart.partNumber }
            Assert-Nltv ($null -ne $part) 'A real Part ID is missing.'
            $answers = @()
            foreach ($group in $sourcePart.contentData.question_groups) {
                foreach ($question in $group.questions) {
                    $answer = $question.correct_answer
                    if ($question.type -eq 'ESSAY') {
                        $answer = 'Bài viết smoke test NLTV: lưu nguyên văn tiếng Việt, không chấm AI.'
                        $essayAnswers += @{ partId = $part.id; questionId = $question.question_id; text = $answer }
                    }
                    $answers += @{ question_id = $question.question_id; answer = $answer }
                }
            }
            $sectionAnswers += @{ part_id = $part.id; answers = $answers }
        }
        $allAnswers += $sectionAnswers
        $saved = Invoke-NltvApi PUT "/attempts/$attemptId/answers" @{ version = $workspace.version; answers = $sectionAnswers }
        $workspace = Invoke-NltvApi GET "/attempts/$attemptId/workspace"
        Assert-Nltv ($workspace.version -eq $saved.version) 'Resume version differs from autosave acknowledgement.'
        if ($mode -eq 'MOCK_TEST' -and $sectionIndex -lt 2) {
            $sectionId = $structure.sections[$sectionIndex].id
            $null = Invoke-NltvApi POST "/attempts/$attemptId/sections/$sectionId/lock"
            $workspace = Invoke-NltvApi GET "/attempts/$attemptId/workspace"
            Assert-Nltv ($workspace.lockedSections -contains $sectionId) 'Locked section was not restored.'
        }
    }
    Assert-Nltv ($essayAnswers.Count -eq 2) 'Expected two essay responses.'
    foreach ($essay in $essayAnswers) {
        $savedPart = $workspace.savedAnswers | Where-Object { $_.part_id -eq $essay.partId }
        $savedQuestion = $savedPart.answers | Where-Object { $_.question_id -eq $essay.questionId }
        Assert-Nltv ($savedQuestion.answer -ceq $essay.text) 'Essay was lost or changed during autosave/resume.'
    }
    $submit = @{ reason = 'MANUAL'; baseVersion = $workspace.version; finalAnswers = $allAnswers }
    $null = Invoke-NltvApi POST "/attempts/$attemptId/submit" $submit
    $null = Invoke-NltvApi POST "/attempts/$attemptId/submit" $submit
    $result = Invoke-NltvApi GET "/attempts/$attemptId/result"
    Assert-Nltv ($result.resultSummary.objective.total -eq 105) 'Objective total must be 105.'
    Assert-Nltv ($result.resultSummary.objective.rawScore -eq 105) 'Correct answers did not grade as 105 raw points.'
    Assert-Nltv ($result.resultSummary.writing.tasks.Count -eq 2) 'Expected two Writing tasks in result.'
    foreach ($task in $result.resultSummary.writing.tasks) {
        Assert-Nltv ($null -eq $task.score) 'Vietnamese essay unexpectedly received an AI score.'
        $feedback = Invoke-NltvApi GET "/attempts/$attemptId/writing-feedback?partId=$($task.partId)"
        Assert-Nltv ($feedback.tasks.Count -eq 1) 'Expected one scoped essay feedback task.'
        $essayFeedback = $feedback.tasks[0]
        Assert-Nltv ($essayFeedback.status -eq 'UNAVAILABLE' -and $essayFeedback.reasonCode -eq 'UNSUPPORTED_LANGUAGE' -and $null -eq $essayFeedback.overall) 'Vietnamese essay unexpectedly received supported AI feedback.'
    }
    foreach ($part in $structure.sections.parts) { $null = Invoke-NltvApi GET "/attempts/$attemptId/review/$($part.id)" }
    $results += [pscustomobject]@{ mode = $mode; attemptId = $attemptId; objectiveTotal = 105; rawScore = 105; essayRestore = 'PASS'; reviewParts = 9; status = $result.status }
}
$results | ConvertTo-Json -Depth 5
