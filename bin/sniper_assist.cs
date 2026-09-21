using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

public class SniperAssist {
    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    private const int VK_LBUTTON = 0x01;
    private const byte VK_1 = 0x31; // Phím 1: Súng chính
    private const byte VK_3 = 0x33; // Phím 3: Dao / Vũ khí phụ
    private const uint KEYEVENTF_KEYUP = 0x0002;

    public static void Main(string[] args) {
        // Tham số: delaySwapMs (ms), delayBackMs (ms)
        int delaySwapMs = 50;
        int delayBackMs = 60;

        if (args.Length >= 1) int.TryParse(args[0], out delaySwapMs);
        if (args.Length >= 2) int.TryParse(args[1], out delayBackMs);

        Console.WriteLine("SNIPER_ASSIST_STARTED");
        Console.Out.Flush();

        bool wasDown = false;

        while (true) {
            short state = GetAsyncKeyState(VK_LBUTTON);
            bool isDown = (state & 0x8000) != 0;

            if (isDown) {
                if (!wasDown) {
                    wasDown = true;
                    // Vừa click chuột trái bắn! Chờ đạn rời nòng
                    Thread.Sleep(Math.Max(20, delaySwapMs));

                    // Nhấn phím 3 (Dao/Phụ)
                    keybd_event(VK_3, 0, 0, 0);
                    keybd_event(VK_3, 0, KEYEVENTF_KEYUP, 0);

                    // Chờ animation cancel
                    Thread.Sleep(Math.Max(30, delayBackMs));

                    // Nhấn phím 1 (Súng chính Sniper)
                    keybd_event(VK_1, 0, 0, 0);
                    keybd_event(VK_1, 0, KEYEVENTF_KEYUP, 0);
                }
            } else {
                wasDown = false;
            }

            Thread.Sleep(10);
        }
    }
}
