# SalonAI Phase 8.4.3 R3.4

R3.4 fixes the image URL failure seen after R3.3 had already downloaded 205 images.

The previous synchroniser wrote the catalogue only at the very end, so the failed run correctly left the JSON without image references. However, it had already replaced the media directory and therefore left partial image files in the worktree.

R3.4 fixes both issues:

- normalises absolute, protocol-relative (`//...`) and relative (`/...`) image URLs;
- downloads everything into a staging directory first;
- keeps the active catalogue and media untouched if any image fails;
- swaps the staged media into place only after the entire download succeeds;
- writes the enriched catalogue only after media staging succeeds;
- includes the product name, internal SKU, image number and source URL in any future image error.

Run from VS Code PowerShell:

```powershell
Set-Location "C:\Users\Francesco\Desktop\CS_Projects\SalonAI_V2\SalonAI"

Expand-Archive `
  -LiteralPath "$env:USERPROFILE\Downloads\SalonAI_Phase_8_4_3_Davines_Media_R3_4.zip" `
  -DestinationPath "." `
  -Force

& ".\Verify-Phase843-R34.ps1"

node --check ".\backend\scripts\syncDavinesSummerMedia.js"

Set-Location ".\backend"
node ".\scripts\syncDavinesSummerMedia.js" --dry-run
Write-Host "R3.4 DRY RUN:" $LASTEXITCODE
```

After the dry run passes, run:

```powershell
node ".\scripts\syncDavinesSummerMedia.js"
Write-Host "R3.4 MEDIA SYNC:" $LASTEXITCODE
```

Do not run the MongoDB `--apply` step until the completed media sync and catalogue counts have been checked.
