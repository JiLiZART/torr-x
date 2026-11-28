---
default: patch
---

# Desktop app starts on Windows when the port is free

The desktop app no longer reports "Port 9977 is used by another program" on Windows when nothing listens on the
port. A port Windows reserves for itself now gets a message that says how to check it. Development and build
scripts work from PowerShell and `cmd`, and releases offer stable download links for the latest version.
