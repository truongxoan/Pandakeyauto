using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class SwitchMouse {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    public static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_LAYERED = 0x80000;
    public const int WS_EX_TOOLWINDOW = 0x80;
    public const int LWA_ALPHA = 0x2;

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern bool ClipCursor(IntPtr lpRect);

    [DllImport("user32.dll")]
    public static extern bool ClipCursor(ref RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool ReleaseCapture();

    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref int pvParam, uint fWinIni);

    [DllImport("user32.dll")]
    public static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);

    public const uint SPI_GETMOUSESPEED = 0x0070;
    public const uint SPI_SETMOUSESPEED = 0x0071;

    // Tốc độ PC gốc — lưu ngay khi khởi động
    private static int originalPcMouseSpeed = -1;

    private static void SnapshotPcMouseSpeed() {
        try {
            int cur = 0;
            if (SystemParametersInfo(SPI_GETMOUSESPEED, 0, ref cur, 0) && cur >= 1 && cur <= 20) {
                originalPcMouseSpeed = cur;
                string snapFile = Path.Combine(Path.GetTempPath(), "pandakey_pc_mouse_speed.txt");
                File.WriteAllText(snapFile, cur.ToString());
            }
        } catch {}
    }

    private static int GetOriginalPcSpeed() {
        if (originalPcMouseSpeed >= 1 && originalPcMouseSpeed <= 20)
            return originalPcMouseSpeed;
        try {
            string snapFile = Path.Combine(Path.GetTempPath(), "pandakey_pc_mouse_speed.txt");
            if (File.Exists(snapFile)) {
                int val;
                if (int.TryParse(File.ReadAllText(snapFile).Trim(), out val) && val >= 1 && val <= 20)
                    return val;
            }
        } catch {}
        return -1;
    }

    public static void RestorePcMouseSpeed() {
        try {
            int orig = GetOriginalPcSpeed();
            if (orig >= 1 && orig <= 20) {
                SystemParametersInfo(SPI_SETMOUSESPEED, 0, (IntPtr)orig, 0);
            }
        } catch {}
    }

    // Win32 Low-Level Keyboard & Mouse Hooks
    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
    private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    public static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    public static extern bool TranslateMessage([In] ref MSG lpMsg);

    [DllImport("user32.dll")]
    public static extern IntPtr DispatchMessage([In] ref MSG lpMsg);

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MSLLHOOKSTRUCT {
        public POINT pt;
        public uint mouseData;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public const int WH_KEYBOARD_LL = 13;
    public const int WH_MOUSE_LL = 14;

    public const int WM_KEYDOWN = 0x0100;
    public const int WM_KEYUP = 0x0101;
    public const int WM_SYSKEYDOWN = 0x0104;
    public const int WM_SYSKEYUP = 0x0105;

    public const int WM_MOUSEMOVE = 0x0200;
    public const int WM_LBUTTONDOWN = 0x0201;
    public const int WM_LBUTTONUP = 0x0202;
    public const int WM_RBUTTONDOWN = 0x0204;
    public const int WM_RBUTTONUP = 0x0205;
    public const int WM_MBUTTONDOWN = 0x0207;
    public const int WM_MBUTTONUP = 0x0208;
    public const int WM_XBUTTONDOWN = 0x020B;
    public const int WM_XBUTTONUP = 0x020C;

    public const byte VK_MENU = 0x12;      // Alt
    public const byte VK_LMENU = 0xA4;     // Left Alt
    public const byte VK_RMENU = 0xA5;     // Right Alt
    public const byte VK_RCONTROL = 0xA3;  // Right Ctrl
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    // Sentinel in dwExtraInfo for key events WE synthesize (RCtrl/Alt release).
    // The low-level hook must ignore those, otherwise our own release events
    // re-enter the hook and re-trigger a toggle (Alt auto-repeat / loop bug).
    public const int SYNTHETIC_EXTRA_INFO = 0x50414E44; // "PAND"
    private static volatile bool suppressAltUntilUp = false;
    private static int lastRectRefreshTick = 0;
    public const uint MOUSEEVENTF_LEFTUP   = 0x0004;

    public const int SW_RESTORE = 9;
    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;

    // ⭐ Bộ nhớ đệm trạng thái trong RAM để phản hồi 0ms độ trễ tuyệt đối
    private static volatile bool isInsidePhone = false;

    // Cache toạ độ & Handle Scrcpy để không gọi Win32 API liên tục trong Hook chuột
    private static IntPtr cachedScrcpyHwnd = IntPtr.Zero;
    private static int cachedLeft = 0;
    private static int cachedTop = 0;
    private static int cachedRight = 0;
    private static int cachedBottom = 0;
    private static int cachedMidX = 0;
    private static int cachedMidY = 0;

    private static int savedPcX = -1;
    private static int savedPcY = -1;
    private static IntPtr lastPcWindow = IntPtr.Zero;

    private static string GetStateFilePath() {
        return Path.Combine(Path.GetTempPath(), "pandakey_mouse_state.txt");
    }

    private static string ReadState() {
        try {
            string file = GetStateFilePath();
            if (File.Exists(file)) {
                return File.ReadAllText(file).Trim().ToLowerInvariant();
            }
        } catch {}
        return "pc";
    }

    private static void SaveState(string state) {
        // Atomic write: a one-shot process and the --watch process both touch
        // this file; a half-written read used to desync them.
        try {
            string file = GetStateFilePath();
            string tmp = file + ".tmp";
            File.WriteAllText(tmp, state);
            if (File.Exists(file)) File.Delete(file);
            File.Move(tmp, file);
        } catch {}
    }

    // savedPcX/Y + lastPcWindow used to live ONLY in RAM of whichever process
    // happened to capture. A toggle run as a separate one-shot process then
    // released to a wrong (center-screen) position with no PC window to focus.
    // Persist them so ANY process releases exactly where the user left PC.
    private static string GetCursorFilePath() {
        return Path.Combine(Path.GetTempPath(), "pandakey_pc_cursor.txt");
    }
    private static void PersistPcCursor() {
        try {
            File.WriteAllText(GetCursorFilePath(),
                savedPcX + "," + savedPcY + "," + lastPcWindow.ToInt64());
        } catch {}
    }
    private static void LoadPcCursor() {
        if (savedPcX >= 0 && savedPcY >= 0) return;
        try {
            string f = GetCursorFilePath();
            if (!File.Exists(f)) return;
            string[] parts = File.ReadAllText(f).Trim().Split(',');
            if (parts.Length >= 2) {
                int x, y; long h;
                if (int.TryParse(parts[0], out x)) savedPcX = x;
                if (int.TryParse(parts[1], out y)) savedPcY = y;
                if (parts.Length >= 3 && long.TryParse(parts[2], out h)) lastPcWindow = new IntPtr(h);
            }
        } catch {}
    }

    public static string GetToggleRequestPath() {
        return Path.Combine(Path.GetTempPath(), "pandakey_mouse_toggle_request.txt");
    }

    public static void UpdateScrcpyRectCache(IntPtr hwnd) {
        if (hwnd == IntPtr.Zero) return;
        cachedScrcpyHwnd = hwnd;
        RECT clientRect;
        if (GetClientRect(hwnd, out clientRect)) {
            POINT topLeft = new POINT { X = clientRect.Left, Y = clientRect.Top };
            POINT botRight = new POINT { X = clientRect.Right, Y = clientRect.Bottom };
            ClientToScreen(hwnd, ref topLeft);
            ClientToScreen(hwnd, ref botRight);
            cachedLeft = topLeft.X;
            cachedTop = topLeft.Y;
            cachedRight = botRight.X;
            cachedBottom = botRight.Y;
            cachedMidX = (cachedLeft + cachedRight) / 2;
            cachedMidY = (cachedTop + cachedBottom) / 2;
        }
    }

    public static IntPtr GetScrcpyWindow() {
        if (cachedScrcpyHwnd != IntPtr.Zero && IsWindow(cachedScrcpyHwnd)) {
            return cachedScrcpyHwnd;
        }

        IntPtr scrcpyHwnd = IntPtr.Zero;

        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            StringBuilder cls = new StringBuilder(256);
            GetClassName(hWnd, cls, 256);
            if (cls.ToString() == "SDL_app") {
                scrcpyHwnd = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);

        if (scrcpyHwnd == IntPtr.Zero) {
            scrcpyHwnd = FindWindow("SDL_app", null);
        }

        if (scrcpyHwnd == IntPtr.Zero) {
            Process[] procs = Process.GetProcessesByName("scrcpy");
            if (procs != null && procs.Length > 0) {
                foreach (Process p in procs) {
                    if (p.MainWindowHandle != IntPtr.Zero) {
                        scrcpyHwnd = p.MainWindowHandle;
                        break;
                    }
                }
            }
        }

        if (scrcpyHwnd != IntPtr.Zero) {
            UpdateScrcpyRectCache(scrcpyHwnd);
        }

        return scrcpyHwnd;
    }

    public static void ReleaseToPc(IntPtr scrcpyHwnd) {
        try {
            isInsidePhone = false;
            suppressAltUntilUp = true; // swallow auto-repeat + the real Alt-UP of this same press
            LoadPcCursor();

            // 1. Tháo toàn bộ khóa chuột ngay lập tức
            ReleaseCapture();
            ClipCursor(IntPtr.Zero);

            // 2. Gửi tín hiệu ungrab cho Scrcpy (RCtrl) và nhả sạch modifier keys
            keybd_event(VK_RCONTROL, 0x1D, KEYEVENTF_EXTENDEDKEY, SYNTHETIC_EXTRA_INFO);
            keybd_event(VK_RCONTROL, 0x1D, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, SYNTHETIC_EXTRA_INFO);

            // Nhả phím Alt, Ctrl, Shift để tuyệt đối không bị dính phím
            keybd_event(VK_MENU, 0x38, KEYEVENTF_KEYUP, SYNTHETIC_EXTRA_INFO);
            keybd_event(0x11, 0x1D, KEYEVENTF_KEYUP, SYNTHETIC_EXTRA_INFO); // VK_CONTROL
            keybd_event(0x10, 0x2A, KEYEVENTF_KEYUP, SYNTHETIC_EXTRA_INFO); // VK_SHIFT

            // 3. Khôi phục focus ứng dụng PC
            if (lastPcWindow != IntPtr.Zero && IsWindow(lastPcWindow) && lastPcWindow != scrcpyHwnd) {
                SetForegroundWindow(lastPcWindow);
            } else {
                SetForegroundWindow(GetDesktopWindow());
            }

            // 4. Trả con trỏ chuột về vị trí máy tính ban đầu
            int screenW = GetSystemMetrics(SM_CXSCREEN);
            int screenH = GetSystemMetrics(SM_CYSCREEN);

            int targetX = savedPcX;
            int targetY = savedPcY;

            if (targetX < 0 || targetY < 0 || targetX >= screenW || targetY >= screenH) {
                targetX = screenW / 2;
                targetY = screenH / 2;
            }

            SetCursorPos(targetX, targetY);

            // 5. Khôi phục tốc độ chuột gốc của PC
            RestorePcMouseSpeed();

            SaveState("pc");
            Console.WriteLine("RELEASED_TO_PC");
        } catch (Exception ex) {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }

    public static void CaptureToPhone(IntPtr scrcpyHwnd) {
        try {
            if (scrcpyHwnd == IntPtr.Zero) return;

            // 1. Lưu lại cửa sổ và tọa độ chuột PC hiện tại
            IntPtr fg = GetForegroundWindow();
            if (fg != scrcpyHwnd && fg != IntPtr.Zero) {
                lastPcWindow = fg;
            }

            POINT pt;
            if (GetCursorPos(out pt)) {
                // Only remember a PC position that is OUTSIDE the phone window;
                // re-capturing must never overwrite it with the phone centre.
                bool insideRect = cachedRight > cachedLeft &&
                    pt.X >= cachedLeft && pt.X <= cachedRight && pt.Y >= cachedTop && pt.Y <= cachedBottom;
                if (!insideRect) { savedPcX = pt.X; savedPcY = pt.Y; }
            }
            PersistPcCursor();

            // 2. Kích hoạt và đưa cửa sổ Scrcpy lên foreground
            ShowWindow(scrcpyHwnd, SW_RESTORE);

            try {
                int exStyle = GetWindowLong(scrcpyHwnd, GWL_EXSTYLE);
                if ((exStyle & WS_EX_LAYERED) != 0) {
                    SetWindowLong(scrcpyHwnd, GWL_EXSTYLE, exStyle & ~WS_EX_LAYERED);
                }
            } catch {}

            SetForegroundWindow(scrcpyHwnd);
            UpdateScrcpyRectCache(scrcpyHwnd);

            RECT clipRect = new RECT {
                Left = cachedLeft + 2,
                Top = cachedTop + 2,
                Right = cachedRight - 2,
                Bottom = cachedBottom - 2
            };

            if (clipRect.Right <= clipRect.Left || clipRect.Bottom <= clipRect.Top) {
                clipRect.Left = cachedLeft;
                clipRect.Top = cachedTop;
                clipRect.Right = cachedRight;
                clipRect.Bottom = cachedBottom;
            }

            SetCursorPos(cachedMidX, cachedMidY);

            // 3. KHÔNG gửi click chuột trái giả nữa: click đó lọt thẳng vào game
            // (tự bắn 1 phát / bấm nhầm nút mỗi lần chuyển PC -> điện thoại).
            // Chỉ cần focus + ClipCursor là scrcpy tự bắt chuột ở lần di/click thật đầu tiên.

            // 4. Khóa chặt chuột trong vùng Scrcpy
            ClipCursor(ref clipRect);

            isInsidePhone = true;
            SaveState("phone");
            Console.WriteLine("CAPTURED_TO_PHONE");
        } catch (Exception ex) {
            Console.WriteLine("ERROR: " + ex.Message);
        }
    }

    public static void Toggle() {
        IntPtr scrcpyHwnd = GetScrcpyWindow();
        if (scrcpyHwnd == IntPtr.Zero) {
            isInsidePhone = false;
            SaveState("pc");
            Console.WriteLine("SCRCPY_NOT_RUNNING");
            return;
        }

        if (isInsidePhone) {
            ReleaseToPc(scrcpyHwnd);
        } else {
            CaptureToPhone(scrcpyHwnd);
        }
    }

    private static LowLevelKeyboardProc _kbProc = KeyboardHookCallback;
    private static LowLevelMouseProc _mouseProc = MouseHookCallback;
    private static IntPtr _kbHookID = IntPtr.Zero;
    private static IntPtr _mouseHookID = IntPtr.Zero;

    private static bool switchKeyPressed = false;
    private static bool comboDetected = false;
    private static DateTime switchKeyPressTime = DateTime.MinValue;

    private static IntPtr SetKeyboardHook(LowLevelKeyboardProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr SetMouseHook(LowLevelMouseProc proc) {
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule) {
            return SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(curModule.ModuleName), 0);
        }
    }

    private static IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int vkCode = Marshal.ReadInt32(lParam);
            int msg = wParam.ToInt32();
            // Ignore key events we synthesized ourselves in ReleaseToPc()
            try {
                if (Marshal.ReadIntPtr(lParam, 16).ToInt64() == SYNTHETIC_EXTRA_INFO)
                    return CallNextHookEx(_kbHookID, nCode, wParam, lParam);
            } catch {}

            // Phím chuyển đổi duy nhất là phím ALT (Alt, Left Alt, Right Alt)
            bool isAltKey = (vkCode == 0x12 || vkCode == 0xA4 || vkCode == 0xA5);

            // After a phone->PC release on Alt-DOWN, Windows keeps auto-repeating
            // Alt-DOWN while the key is held, then sends one Alt-UP. In the old
            // code those repeats were read as a fresh PC-mode Alt tap, so letting
            // go of Alt instantly captured the mouse BACK to the phone.
            if (suppressAltUntilUp) {
                if (isAltKey) {
                    if (msg == WM_KEYUP || msg == WM_SYSKEYUP) suppressAltUntilUp = false;
                    return (IntPtr)1;
                }
                suppressAltUntilUp = false; // a different key means a real combo
            }

            // ================= 1. KHI ĐANG Ở CHẾ ĐỘ ĐIỆN THOẠI =================
            if (isInsidePhone) {
                IntPtr scrcpyHwnd = cachedScrcpyHwnd != IntPtr.Zero ? cachedScrcpyHwnd : GetScrcpyWindow();
                if (scrcpyHwnd == IntPtr.Zero) {
                    ReleaseToPc(IntPtr.Zero);
                    return CallNextHookEx(_kbHookID, nCode, wParam, lParam);
                }

                // Phím ALT là phím DUY NHẤT để thoát ra máy tính
                if (isAltKey) {
                    if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                        ReleaseToPc(scrcpyHwnd);
                        return (IntPtr)1; // Chặn phím không cho lọt vào Windows
                    }
                    if (msg == WM_KEYUP || msg == WM_SYSKEYUP) {
                        return (IntPtr)1;
                    }
                }

                // Chặn phím Windows (Start Menu) không làm nhảy ra màn hình PC
                if (vkCode == 0x5B || vkCode == 0x5C) {
                    return (IntPtr)1;
                }

                // Toàn bộ các phím khác (WASD, 1-9, Space, Shift...) được chuyển 100% vào điện thoại
                return CallNextHookEx(_kbHookID, nCode, wParam, lParam);
            }
            // ================= 2. KHI ĐANG Ở CHẾ ĐỘ MÁY TÍNH (PC MODE) =================
            else {
                if (isAltKey) {
                    if (msg == WM_KEYDOWN || msg == WM_SYSKEYDOWN) {
                        if (!switchKeyPressed) {
                            switchKeyPressed = true;
                            comboDetected = false;
                            switchKeyPressTime = DateTime.UtcNow;
                        }
                    } else if (msg == WM_KEYUP || msg == WM_SYSKEYUP) {
                        if (switchKeyPressed && !comboDetected) {
                            double ms = (DateTime.UtcNow - switchKeyPressTime).TotalMilliseconds;
                            // Nhấn nhả Alt đơn thuần (< 600ms không bấm phím combo) -> Chuyển vào điện thoại
                            if (ms < 600) {
                                IntPtr scrcpyHwnd = GetScrcpyWindow();
                                if (scrcpyHwnd != IntPtr.Zero) {
                                    CaptureToPhone(scrcpyHwnd);
                                    switchKeyPressed = false;
                                    comboDetected = false;
                                    return (IntPtr)1;
                                }
                            }
                        }
                        switchKeyPressed = false;
                        comboDetected = false;
                    }
                } else if (switchKeyPressed) {
                    comboDetected = true;
                }

                return CallNextHookEx(_kbHookID, nCode, wParam, lParam);
            }
        }
        return CallNextHookEx(_kbHookID, nCode, wParam, lParam);
    }

    private static IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam) {
        if (nCode >= 0) {
            int msg = wParam.ToInt32();

            // ================= 1. KHI ĐANG Ở CHẾ ĐỘ ĐIỆN THOẠI =================
            if (isInsidePhone) {
                IntPtr scrcpyHwnd = cachedScrcpyHwnd != IntPtr.Zero ? cachedScrcpyHwnd : GetScrcpyWindow();
                if (scrcpyHwnd == IntPtr.Zero) {
                    ReleaseToPc(IntPtr.Zero);
                    return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
                }

                bool isButtonDown = (msg == WM_LBUTTONDOWN || msg == WM_RBUTTONDOWN || msg == WM_MBUTTONDOWN || msg == WM_XBUTTONDOWN);

                // Giữ focus và khóa chuột trong Scrcpy
                if (isButtonDown) {
                    IntPtr fg = GetForegroundWindow();
                    if (fg != scrcpyHwnd) {
                        SetForegroundWindow(scrcpyHwnd);
                        UpdateScrcpyRectCache(scrcpyHwnd);
                        RECT clipRect = new RECT { Left = cachedLeft + 2, Top = cachedTop + 2, Right = cachedRight - 2, Bottom = cachedBottom - 2 };
                        ClipCursor(ref clipRect);
                        return (IntPtr)1; // Chặn click lọt vào PC
                    }
                }

                // KHÔNG SetCursorPos trong hook nữa: việc giật con trỏ về giữa
                // mỗi khi chạm biên làm mất delta lia chuột, gây xoay/giật và là
                // nguyên nhân chuột "điên" khi chơi. ClipCursor (đặt khi capture
                // + refresh throttled ở dưới khi cửa sổ scrcpy di chuyển/resize)
                // là đủ để giữ chuột trong vùng điện thoại.
                if (msg == WM_MOUSEMOVE) {
                    int now = Environment.TickCount;
                    if (now - lastRectRefreshTick >= 500) {
                        lastRectRefreshTick = now;
                        int oldL = cachedLeft, oldT = cachedTop, oldR = cachedRight, oldB = cachedBottom;
                        UpdateScrcpyRectCache(scrcpyHwnd);
                        if (oldL != cachedLeft || oldT != cachedTop || oldR != cachedRight || oldB != cachedBottom) {
                            RECT clipRect2 = new RECT { Left = cachedLeft + 2, Top = cachedTop + 2, Right = cachedRight - 2, Bottom = cachedBottom - 2 };
                            if (clipRect2.Right > clipRect2.Left && clipRect2.Bottom > clipRect2.Top) ClipCursor(ref clipRect2);
                        }
                    }
                }
                return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
            }
            // ================= 2. KHI ĐANG Ở CHẾ ĐỘ MÁY TÍNH (PC MODE) =================
            else {
                return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
            }
        }
        return CallNextHookEx(_mouseHookID, nCode, wParam, lParam);
    }

    public static void Main(string[] args) {
        // Only snapshot when we are (believed to be) on PC. A one-shot process
        // started while already in phone mode used to snapshot the *phone*
        // speed as the "original PC speed" and then restore to that wrong value.
        if (ReadState() != "phone") SnapshotPcMouseSpeed();

        AppDomain.CurrentDomain.ProcessExit += delegate {
            ClipCursor(IntPtr.Zero);
            RestorePcMouseSpeed();
        };

        if (args != null && args.Length > 0 && (args[0] == "--watch" || args[0] == "--hook")) {
            string state = ReadState();
            isInsidePhone = (state == "phone");
            if (isInsidePhone) LoadPcCursor();

            _kbHookID = SetKeyboardHook(_kbProc);
            _mouseHookID = SetMouseHook(_mouseProc);
            Console.WriteLine("ALT_HOOK_READY");

            // Single-owner toggle channel: the Electron app (and only it) writes
            // a fresh id to the request file; THIS process performs the toggle,
            // so isInsidePhone / savedPc / lastPcWindow never split across
            // processes. Also re-sync if another process changed the state file.
            Thread syncThread = new Thread(delegate() {
                string lastReq = "";
                string lastState = ReadState();
                try { if (File.Exists(GetToggleRequestPath())) lastReq = File.ReadAllText(GetToggleRequestPath()).Trim(); } catch {}
                while (true) {
                    try {
                        if (File.Exists(GetToggleRequestPath())) {
                            string req = File.ReadAllText(GetToggleRequestPath()).Trim();
                            if (req.Length > 0 && req != lastReq) { lastReq = req; Toggle(); lastState = ReadState(); }
                        }
                        string st = ReadState();
                        if (st != lastState) {
                            lastState = st;
                            bool wantPhone = (st == "phone");
                            if (wantPhone != isInsidePhone) isInsidePhone = wantPhone;
                        }
                    } catch {}
                    Thread.Sleep(25);
                }
            });
            syncThread.IsBackground = true;
            syncThread.Start();

            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }

            UnhookWindowsHookEx(_kbHookID);
            UnhookWindowsHookEx(_mouseHookID);
            ClipCursor(IntPtr.Zero);
            RestorePcMouseSpeed();
        } else if (args != null && args.Length > 0 && args[0] == "--restore") {
            ClipCursor(IntPtr.Zero);
            RestorePcMouseSpeed();
            isInsidePhone = false;
            SaveState("pc");
            Console.WriteLine("PC_SPEED_RESTORED");
        } else if (args != null && args.Length > 0 && args[0] == "--get-scrcpy-rect") {
            IntPtr scrcpyHwnd = GetScrcpyWindow();
            if (scrcpyHwnd != IntPtr.Zero) {
                RECT r;
                GetWindowRect(scrcpyHwnd, out r);
                int w = r.Right - r.Left;
                int h = r.Bottom - r.Top;
                Console.WriteLine(string.Format("{0} {1} {2} {3}", r.Left, r.Top, w, h));
            } else {
                Console.WriteLine("NOT_FOUND");
            }
        } else if (args != null && args.Length > 0 && args[0] == "--click") {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        } else if (args != null && args.Length > 0 && args[0] == "--release") {
            IntPtr scrcpyHwnd = GetScrcpyWindow();
            ReleaseToPc(scrcpyHwnd);
            Console.WriteLine("RELEASED_TO_PC");
        } else {
            string state = ReadState();
            isInsidePhone = (state == "phone");
            Toggle();
        }
    }
}
