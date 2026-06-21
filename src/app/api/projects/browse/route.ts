import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET() {
  try {
    // This executes an AppleScript to show the native macOS folder selection dialog.
    // It will pop up in front of whatever the user is doing.
    const { stdout } = await execAsync(
      `osascript -e 'tell application (path to frontmost application as text) to set myFolder to choose folder with prompt "Select Project Folder"' -e 'POSIX path of myFolder'`
    );

    const path = stdout.trim();
    if (path) {
      return NextResponse.json({ path });
    }
    
    return NextResponse.json({ error: "No path selected" }, { status: 400 });
  } catch (error: any) {
    // If the user clicks "Cancel", osascript returns a non-zero exit code
    if (error.message && error.message.includes("User canceled")) {
      return NextResponse.json({ error: "Canceled" }, { status: 400 });
    }
    console.error("Browse dialog error:", error);
    return NextResponse.json({ error: "Failed to open dialog" }, { status: 500 });
  }
}
