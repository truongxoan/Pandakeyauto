Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
cliPath = currentDir & "\node_modules\electron\cli.js"

WshShell.CurrentDirectory = currentDir

' Tắt các tiến trình electron cũ bị treo để giải phóng Single Instance Lock
WshShell.Run "taskkill /f /im electron.exe", 0, True

' Khởi chạy Electron hoàn toàn ẩn cửa sổ CMD (Style 0 = Hidden)
If fso.FileExists(cliPath) Then
    WshShell.Run "cmd /c node """ & cliPath & """ .", 0, False
Else
    WshShell.Run "cmd /c npm start", 0, False
End If
