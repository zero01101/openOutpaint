# Updates html files with cache busting urls including file hashes.

# Actual file processing
$htmlfiles = Get-ChildItem -Path . -Recurse -Filter "*.html" | Where {$_.FullName -notlike "*\node_modules\*"} | Resolve-path -relative
foreach ($htmlfile in $htmlfiles) {
    Write-Host "[info] Processing '${htmlfile}' for cache busting..." -ForegroundColor Blue

    $resfiles = (@(Get-ChildItem -Path . -Recurse -Filter "*.css") + (Get-ChildItem -Path . -Recurse -Filter "*.js")) | Resolve-Path -relative

    if ($args[0] -eq "gitadd") {
        $resfiles = (git status -s | Select-String -Pattern "[A-Z]  .+") | ForEach-Object { -split $_.Line | Select-Object -Last 1 }
    }

    foreach ($resfile in $resfiles) {
        $resfile = $resfile -replace '\\', '/' -replace '\./', ''
        # Check if resource is used in html file
        if ($null -ne (Select-String -Path $htmlfile -Pattern $resfile)) {
            $hash = (Get-FileHash $resfile -Algorithm SHA1).Hash
            
            # This is just for cache busting...
            # If 7 first characters of SHA1 is okay for git, it should be more than enough for us
            $hash = $hash.Substring(0, 7).ToLower()

            (Get-Content -Raw -Path $htmlfile).replace('\r\n', "\n") -replace "$resfile(\?v=[a-z0-9]+)?", "${resfile}?v=$hash" | Set-Content $htmlfile
        }
    }
}
