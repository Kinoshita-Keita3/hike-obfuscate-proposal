@echo off
echo Building standalone executable hike-obfuscate.exe via Deno...
deno compile --allow-read --allow-write --allow-run --output hike-obfuscate.exe build-obfuscate-standalone.js
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] hike-obfuscate.exe created successfully!
) else (
    echo [ERROR] Failed to compile executable.
)
