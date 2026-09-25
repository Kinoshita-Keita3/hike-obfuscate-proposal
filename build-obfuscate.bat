@echo off
rem ==============================================================================
rem Hike WebAssembly Safe Obfuscator (Windows Batch Script Edition)
rem Usage: build-obfuscate.bat --export-symbols symbols.json
rem ==============================================================================

set SYMBOLS_FILE=sample_symbols.json
set RUNTIME_FILE=runtime.js
set OUTPUT_FILE=runtime.min.js

:parse_args
if "%~1"=="" goto run_obfuscator
if "%~1"=="--export-symbols" set SYMBOLS_FILE=%~2& shift & shift & goto parse_args
if "%~1"=="--symbols" set SYMBOLS_FILE=%~2& shift & shift & goto parse_args
if "%~1"=="--runtime" set RUNTIME_FILE=%~2& shift & shift & goto parse_args
if "%~1"=="--out" set OUTPUT_FILE=%~2& shift & shift & goto parse_args
shift
goto parse_args

:run_obfuscator
echo ==================================================================
echo  Hike Wasm Safe Obfuscator Pipeline (Windows Batch Script)
echo ==================================================================

where deno >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Executing obfuscation via Deno engine...
    deno run -A build-obfuscate-standalone.js --export-symbols "%SYMBOLS_FILE%" --runtime "%RUNTIME_FILE%" --runtime-out "%OUTPUT_FILE%"
    goto finish
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Executing obfuscation via Node.js engine...
    node build-obfuscate-standalone.js --export-symbols "%SYMBOLS_FILE%" --runtime "%RUNTIME_FILE%" --runtime-out "%OUTPUT_FILE%"
    goto finish
)

echo [ERROR] Neither Deno nor Node.js runtime was found. Please install Deno or Node.js.
exit /b 1

:finish
echo ==================================================================
echo [SUCCESS] Obfuscation pipeline completed! Output: %OUTPUT_FILE%
echo ==================================================================
