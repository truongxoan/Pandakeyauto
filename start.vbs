Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = currentDir & "\node_modules\electron\dist\electron.exe"

WshShell.CurrentDirectory = currentDir

' Tat tien trinh electron cu bi treo neu co
WshShell.Run "taskkill /f /im electron.exe", 0, True

' Khoi chay Electron truc tiep
If fso.FileExists(electronExe) Then
    WshShell.Run """" & electronExe & """ .", 1, False
Else
    WshShell.Run "cmd /c npm start", 0, False
End If
