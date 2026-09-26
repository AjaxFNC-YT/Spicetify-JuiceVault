param(
	[string]$Zip,
	[switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$Repo = "AjaxFNC-YT/Spicetify-JuiceVault"
$AppName = "juicevault"

function Say([string]$Text, [string]$Color = "Gray") {
	Write-Host $Text -ForegroundColor $Color
}

function Invoke-Spicetify([string[]]$Arguments) {
	$ErrorActionPreference = "Continue"
	$output = & spicetify @Arguments 2>&1 | ForEach-Object { "$_" } | Out-String
	if ($LASTEXITCODE -ne 0) { throw "spicetify $($Arguments -join ' ') failed:`n$output" }
	return $output.Trim()
}

function Test-ConfigEntry([string]$Key, [string]$Name) {
	$value = Invoke-Spicetify @("config", $Key)
	return ($value -split "[|\s]+") -contains $Name
}

if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
	Say "Spicetify isn't installed. Install it from https://spicetify.app first, then run this again." "Red"
	exit 1
}

$SpicetifyRoot = Split-Path (Invoke-Spicetify @("-c"))
$AppDir = Join-Path $SpicetifyRoot "CustomApps\$AppName"

foreach ($legacy in @("JuiceVault.js", "juicevault.js")) {
	if (Test-ConfigEntry "extensions" $legacy) {
		Invoke-Spicetify @("config", "extensions", "$legacy-") | Out-Null
		Say "Removed the old JuiceVault extension from Spicetify"
	}
}
$legacyFile = Join-Path $SpicetifyRoot "Extensions\JuiceVault.js"
if (Test-Path $legacyFile) { Remove-Item $legacyFile -Force }

if ($Uninstall) {
	if (Test-ConfigEntry "custom_apps" $AppName) { Invoke-Spicetify @("config", "custom_apps", "$AppName-") | Out-Null }
	if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
	Invoke-Spicetify @("apply") | Out-Null
	Say "JuiceVault was removed. Restart Spotify if it's open." "Green"
	exit 0
}

$Work = Join-Path ([IO.Path]::GetTempPath()) "juicevault-install-$([Guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $Work | Out-Null

try {
	$Source = $null

	if ($Zip) {
		Expand-Archive -Path $Zip -DestinationPath $Work -Force
	} elseif ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot "$AppName\index.js"))) {
		$Source = Join-Path $PSScriptRoot $AppName
	} else {
		Say "Downloading the latest JuiceVault release..."
		$release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ "User-Agent" = "JuiceVault-Installer" }
		$asset = $release.assets | Where-Object { $_.name -like "JuiceVault-*.zip" } | Select-Object -First 1
		if (-not $asset) { throw "The latest release ($($release.tag_name)) has no JuiceVault zip attached." }
		$download = Join-Path $Work $asset.name
		Invoke-WebRequest $asset.browser_download_url -OutFile $download -Headers @{ "User-Agent" = "JuiceVault-Installer" }
		Expand-Archive -Path $download -DestinationPath $Work -Force
	}

	if (-not $Source) {
		$found = Get-ChildItem $Work -Recurse -Filter "index.js" | Where-Object { Test-Path (Join-Path $_.DirectoryName "extension.js") } | Select-Object -First 1
		if (-not $found) { throw "Couldn't find the JuiceVault files in that package." }
		$Source = $found.DirectoryName
	}

	if (Test-Path $AppDir) { Remove-Item $AppDir -Recurse -Force }
	New-Item -ItemType Directory -Path $AppDir | Out-Null
	foreach ($file in @("index.js", "extension.js", "manifest.json")) {
		Copy-Item (Join-Path $Source $file) (Join-Path $AppDir $file) -Force
	}
	Say "Copied JuiceVault to $AppDir"

	if (-not (Test-ConfigEntry "custom_apps" $AppName)) {
		Invoke-Spicetify @("config", "custom_apps", $AppName) | Out-Null
	}

	Say "Applying Spicetify..."
	Invoke-Spicetify @("apply") | Out-Null
	Say "JuiceVault is installed. Restart Spotify and open it from the button in the top bar." "Green"
} finally {
	Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
}
