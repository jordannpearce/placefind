!include "MUI2.nsh"

!ifndef APPDIR
  !define APPDIR "..\\release\\win-unpacked"
!endif
!ifndef OUTFILE
  !define OUTFILE "..\\release\\PlaceFind-Setup-1.0.0.exe"
!endif
!ifndef VERSION
  !define VERSION "1.0.0"
!endif

Name "PlaceFind"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\\PlaceFind"
InstallDirRegKey HKCU "Software\\PlaceFind" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Unicode True
BrandingText "PlaceFind ${VERSION}"

!ifndef ICON
  !define ICON "..\\release\\.icon-ico\\icon.ico"
!endif

!define MUI_ABORTWARNING
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"

!insertmacro MUI_PAGE_LICENSE "license.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "${APPDIR}\\*.*"
  CreateShortcut "$DESKTOP\\PlaceFind.lnk" "$INSTDIR\\PlaceFind.exe"
  CreateDirectory "$SMPROGRAMS\\PlaceFind"
  CreateShortcut "$SMPROGRAMS\\PlaceFind\\PlaceFind.lnk" "$INSTDIR\\PlaceFind.exe"
  CreateShortcut "$SMPROGRAMS\\PlaceFind\\Uninstall PlaceFind.lnk" "$INSTDIR\\Uninstall.exe"
  WriteUninstaller "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\PlaceFind" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind" "DisplayName" "PlaceFind"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind" "Publisher" "PlaceFind"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind" "UninstallString" "$INSTDIR\\Uninstall.exe"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind" "DisplayIcon" "$INSTDIR\\PlaceFind.exe"
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind" "NoModify" 1
  WriteRegDWORD HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\\PlaceFind.lnk"
  RMDir /r "$SMPROGRAMS\\PlaceFind"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PlaceFind"
  DeleteRegKey HKCU "Software\\PlaceFind"
  RMDir /r "$INSTDIR"
SectionEnd
