# A bounded, read-only workload check. No services, priorities, settings or apps are changed.
[CmdletBinding()]
param(
    [ValidateRange(5,120)][int]$Seconds = 30,
    [string]$OutputDirectory,
    [switch]$OpenReport
)
$ErrorActionPreference = 'Stop'

function Get-ProcessSnapshot {
    $result = @{}
    foreach ($process in Get-Process) {
        try {
            $result[$process.Id] = [pscustomobject]@{
                Name = $process.ProcessName
                Started = $process.StartTime.ToUniversalTime().Ticks
                CPU = $process.TotalProcessorTime.TotalSeconds
                MemoryMB = [math]::Round($process.WorkingSet64 / 1MB, 1)
            }
        } catch { } # Protected or exited processes are unavailable, not zero-CPU.
    }
    return $result
}

try {
    if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
        $OutputDirectory = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'Reports'
    }
    Write-Host "Lab Check: observing your current workload for $Seconds seconds."
    Write-Host 'Keep using your apps normally. This check will finish automatically.'
    $os = Get-CimInstance Win32_OperatingSystem
    $system = Get-CimInstance Win32_ComputerSystem
    $logicalProcessors = [int]$system.NumberOfLogicalProcessors
    if ($logicalProcessors -lt 1) { throw 'Could not determine CPU count.' }
    $evePath = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Virtual Machines\EVE-NG\EVE-NG.vmx'
    $eveMemoryMB = $null
    $eveCPU = $null
    $eveState = 'VM file not found'
    if (Test-Path -LiteralPath $evePath) {
        foreach ($line in Get-Content -LiteralPath $evePath) {
            if ($line -match '^\s*memsize\s*=\s*"(\d+)"') { $eveMemoryMB = [int]$Matches[1] }
            if ($line -match '^\s*numvcpus\s*=\s*"(\d+)"') { $eveCPU = [int]$Matches[1] }
        }
        $vmProcesses = @(Get-CimInstance Win32_Process -Filter "Name='vmware-vmx.exe'")
        $matchingVM = @($vmProcesses | Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($evePath,[StringComparison]::OrdinalIgnoreCase) -ge 0 })
        $unknownVM = @($vmProcesses | Where-Object { -not $_.CommandLine })
        if ($matchingVM.Count -gt 0) { $eveState = 'Running' }
        elseif ($unknownVM.Count -gt 0) { $eveState = 'Unknown (VM process details unavailable)' }
        else { $eveState = 'Not running' }
    }

    $before = Get-ProcessSnapshot
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $rows = [Collections.Generic.List[object]]::new()
    $counterPaths = @(
        '\Memory\Available MBytes', '\Memory\% Committed Bytes In Use',
        '\Memory\Pages Input/sec', '\Processor(*)\% Processor Time',
        '\PhysicalDisk(_Total)\Avg. Disk sec/Transfer',
        '\PhysicalDisk(_Total)\Disk Transfers/sec'
    )
    Get-Counter -Counter $counterPaths -SampleInterval 1 -MaxSamples $Seconds | ForEach-Object {
        $values = @{}
        $coreValues = [Collections.Generic.List[double]]::new()
        foreach ($sample in $_.CounterSamples) {
            if ($sample.Status -notin @(0,1)) { throw "A performance counter was unavailable: $($sample.Path)" }
            if ([double]::IsNaN($sample.CookedValue) -or [double]::IsInfinity($sample.CookedValue)) {
                throw "A performance counter returned an invalid number: $($sample.Path)"
            }
            $key = ($sample.Path -replace '^\\\\[^\\]+', '').ToLowerInvariant()
            $values[$key] = [double]$sample.CookedValue
            if ($key -match '^\\processor\(\d+\)\\% processor time$') { $coreValues.Add([double]$sample.CookedValue) }
        }
        $requiredKeys = @(
            '\memory\available mbytes', '\memory\% committed bytes in use',
            '\memory\pages input/sec', '\processor(_total)\% processor time',
            '\physicaldisk(_total)\avg. disk sec/transfer', '\physicaldisk(_total)\disk transfers/sec'
        )
        foreach ($requiredKey in $requiredKeys) {
            if (-not $values.ContainsKey($requiredKey)) { throw "Missing performance counter: $requiredKey" }
        }
        if ($coreValues.Count -eq 0) { throw 'No individual CPU counter readings were returned.' }
        $rows.Add([pscustomobject]@{
            Timestamp = $_.Timestamp.ToString('o')
            CPUPercent = [math]::Round($values['\processor(_total)\% processor time'],2)
            BusiestLogicalCPUPercent = [math]::Round(($coreValues | Measure-Object -Maximum).Maximum,2)
            AvailableMB = $values['\memory\available mbytes']
            CommitPercent = [math]::Round($values['\memory\% committed bytes in use'],2)
            PagesInputPerSecond = [math]::Round($values['\memory\pages input/sec'],2)
            DiskLatencyMs = [math]::Round($values['\physicaldisk(_total)\avg. disk sec/transfer']*1000,3)
            DiskTransfersPerSecond = [math]::Round($values['\physicaldisk(_total)\disk transfers/sec'],2)
        })
    }
    $after = Get-ProcessSnapshot
    $timer.Stop()
    if ($rows.Count -ne $Seconds) { throw "Incomplete sample: got $($rows.Count) of $Seconds readings." }

    $processRows = foreach ($idValue in $after.Keys) {
        $current = $after[$idValue]
        $cpu = $null
        if ($before.ContainsKey($idValue) -and $before[$idValue].Started -eq $current.Started) {
            $cpu = [math]::Max(0,($current.CPU-$before[$idValue].CPU)/$timer.Elapsed.TotalSeconds/$logicalProcessors*100)
        }
        [pscustomobject]@{Name=$current.Name; CPUPercent=$cpu; WorkingSetMB=$current.MemoryMB}
    }
    $apps = @($processRows | Group-Object Name | ForEach-Object {
        $measured = @($_.Group | Where-Object { $null -ne $_.CPUPercent })
        [pscustomobject]@{
            Name = $_.Name
            CPUPercent = $(if ($measured.Count) { [math]::Round(($measured | Measure-Object CPUPercent -Sum).Sum,1) } else { $null })
            WorkingSetMB = [math]::Round(($_.Group | Measure-Object WorkingSetMB -Sum).Sum)
            Processes = $_.Count
            UnmeasuredCPUProcesses = $_.Count-$measured.Count
        }
    })
    $minMemory = ($rows | Measure-Object AvailableMB -Minimum).Minimum
    $meanCPU = [math]::Round(($rows | Measure-Object CPUPercent -Average).Average,1)
    $cpuBusySamples = @($rows | Where-Object { $_.CPUPercent -ge 85 }).Count
    $busyCoreSamples = @($rows | Where-Object { $_.BusiestLogicalCPUPercent -ge 90 }).Count
    $diskTransfers = ($rows | Measure-Object DiskTransfersPerSecond -Sum).Sum
    $weightedDiskMs = $null
    if ($diskTransfers -gt 0) {
        $weightedDiskMs = [math]::Round(($rows | ForEach-Object { $_.DiskLatencyMs*$_.DiskTransfersPerSecond } | Measure-Object -Sum).Sum/$diskTransfers,3)
    }
    $notes = [Collections.Generic.List[string]]::new()
    if ($minMemory -lt 1024) { $notes.Add('Less than 1 GB was available: memory pressure deserves attention. Save and close unused heavy apps before adding a lab.') }
    elseif ($minMemory -lt 2048) { $notes.Add('Less than 2 GB was available: little room for another heavy workload.') }
    if ($eveState -eq 'Not running' -and $null -ne $eveMemoryMB -and $minMemory -lt ($eveMemoryMB+2048)) {
        $notes.Add("EVE is configured for $eveMemoryMB MB. Available RAM was below that plus a 2 GB planning reserve. Save and close unused heavy tabs/apps before a large lab; start only the lab nodes you need. This is a conservative planning check, not an allocation guarantee.")
    }
    if ($cpuBusySamples -ge ($Seconds/3)) { $notes.Add('Overall CPU was at least 85% for a substantial part of the sample. Compare screen sharing at 30 fps, with the same lab and apps.') }
    elseif ($busyCoreSamples -ge ($Seconds/3)) { $notes.Add('At least one logical CPU was busy for a substantial part of the sample. A low overall CPU average does not rule out a single-thread bottleneck.') }
    else { $notes.Add('This short sample did not show sustained overall CPU saturation. It does not establish thermal or GPU headroom.') }
    if ($null -ne $weightedDiskMs -and $weightedDiskMs -gt 20) { $notes.Add('Average observed disk response exceeded 20 ms. Inspect I/O alongside memory pressure before assuming the SSD needs replacing.') }
    $notes.Add('Keep the same lab, call, share quality and tabs when comparing reports. These thresholds flag areas to inspect; they do not diagnose the cause.')

    if (-not (Test-Path -LiteralPath $OutputDirectory)) { New-Item -ItemType Directory -Path $OutputDirectory | Out-Null }
    $prefix = 'Lab-Check-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,6)
    $textPath = Join-Path $OutputDirectory ($prefix+'.txt')
    $jsonPath = Join-Path $OutputDirectory ($prefix+'.json')
    $csvPath = Join-Path $OutputDirectory ($prefix+'.csv')
    $summary = [ordered]@{
        MeasuredAt = (Get-Date).ToString('o'); Samples = $rows.Count
        Model = $system.Model; TotalMemoryGB = [math]::Round($os.TotalVisibleMemorySize/1MB,2)
        AverageCPUPercent = $meanCPU; MinimumAvailableGB = [math]::Round($minMemory/1024,2)
        PeakCommitPercent = ($rows | Measure-Object CommitPercent -Maximum).Maximum
        TransferWeightedDiskLatencyMs = $weightedDiskMs
        EveState = $eveState; EveMemoryMB = $eveMemoryMB; EveVirtualCPUs = $eveCPU
        Notes = @($notes.ToArray()); Apps = $apps
    }
    $summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
    $rows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding UTF8
    $cpuTable = $apps | Where-Object { $null -ne $_.CPUPercent } | Sort-Object CPUPercent -Descending | Select-Object -First 8 Name,CPUPercent,WorkingSetMB,UnmeasuredCPUProcesses | Format-Table -AutoSize | Out-String
    $memoryTable = $apps | Sort-Object WorkingSetMB -Descending | Select-Object -First 8 Name,WorkingSetMB,Processes | Format-Table -AutoSize | Out-String
    $diskText = if ($null -eq $weightedDiskMs) { 'No disk transfers observed' } else { "$weightedDiskMs ms (weighted by transfers)" }
    $report = @"
LAB CHECK
Measured: $($summary.MeasuredAt) | $Seconds one-second readings

Average CPU: $meanCPU%
Lowest available RAM: $($summary.MinimumAvailableGB) GB of $($summary.TotalMemoryGB) GB
Peak committed memory: $($summary.PeakCommitPercent)% of the commit limit
Disk response: $diskText
EVE: $eveState | Configured RAM: $eveMemoryMB MB | Virtual CPUs: $eveCPU

WHAT TO CONSIDER
$($notes -join "`r`n`r`n")

BUSIEST APPS (CPU percentage of the whole machine)
$cpuTable
LARGEST APP WORKING SETS
$memoryTable
READING THIS REPORT
This is a passive sample, not a stress test or a speed improvement.
App working sets include shared pages and should not be added as an exact RAM budget.
New, exited, or protected processes may not have complete CPU measurements.
If UnmeasuredCPUProcesses is above zero, that app's CPU figure is partial.
The sampler itself uses a little CPU and memory. Temperature, GPU load, and call
quality are not measured. Pages Input/sec in the CSV also includes file-backed
memory; it does not by itself prove pagefile thrashing. No settings were changed.

Saved measurements: $csvPath
Structured summary: $jsonPath
"@
    $report | Set-Content -LiteralPath $textPath -Encoding UTF8
    Write-Host $report
    Write-Host "Report saved: $textPath"
    if ($OpenReport) { Start-Process -FilePath 'notepad.exe' -ArgumentList ('"'+$textPath+'"') }
} catch {
    Write-Error -Message ("Lab Check could not complete: "+$_.Exception.Message) -ErrorAction Continue
    if ($OpenReport) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
}
