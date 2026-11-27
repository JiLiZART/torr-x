---
default: minor
---

# Sign-in screen with lockout and remember-me

The web sign-in screen asks only for the password, can remember the browser for 30 days, and says when a session expired; signing in returns to the same view. Five wrong passwords from one address lock sign-in (and HTTP Basic) from there for 60 seconds, with a live countdown. Over plain HTTP to a non-loopback address the screen warns that the connection is not encrypted. A lost password can be reset on the host with `torrentx-server auth reset`.
