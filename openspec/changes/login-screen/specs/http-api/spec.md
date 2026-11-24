## MODIFIED Requirements

### Requirement: Optional authentication
Authentication SHALL be disabled by default. When enabled in settings with a username and password, every
`/api/v1/*` endpoint except `health`, `auth/login`, and `auth/logout` SHALL require either a valid session cookie
obtained from `POST /api/v1/auth/login` (`{"username","password","remember"?}`) or an HTTP Basic `Authorization`
header with the same credentials. Passwords SHALL be stored only as a salted slow hash. Enabling auth via
`PUT /api/v1/settings` SHALL require the new password in the request; the caller's current session SHALL remain
valid afterwards.

A login with `remember: true` SHALL create a session that stays valid for 30 days of inactivity and a cookie
that persists for 30 days; a login without it SHALL create a session valid for 12 hours of inactivity and a
cookie that ends with the browser session.

The server SHALL limit password guessing per client address: a failed login SHALL respond 401 with the number of
attempts left (`attemptsLeft`), and after 5 consecutive failures from one address the server SHALL, for 60
seconds, answer every login and HTTP Basic attempt from that address with 429 `locked_out`, a `retryAfterSecs`
field and a `Retry-After` header, without evaluating the credentials. A successful login SHALL reset the count.
A lockout SHALL NOT affect requests carrying a valid session cookie, nor clients at other addresses.

#### Scenario: Default no auth
- **WHEN** a fresh server with default config receives `GET /api/v1/torrents` from localhost
- **THEN** it responds 200

#### Scenario: Auth required
- **WHEN** auth is enabled and a request without cookie or Basic header calls `GET /api/v1/torrents`
- **THEN** the response is 401 `unauthorized`

#### Scenario: Login
- **WHEN** a client posts correct credentials to `/api/v1/auth/login`
- **THEN** the response sets an HttpOnly, SameSite=Strict session cookie and subsequent requests with it succeed

#### Scenario: Wrong password
- **WHEN** a client posts wrong credentials to `/api/v1/auth/login`
- **THEN** the response is 401 with `attemptsLeft` and no cookie is set

#### Scenario: Scripted Basic auth
- **WHEN** auth is enabled and `curl -u user:pass http://127.0.0.1:9977/api/v1/torrents` is run
- **THEN** it returns the torrent list

#### Scenario: Lockout
- **WHEN** one address posts five wrong passwords in a row and then the correct one within 60 seconds
- **THEN** the sixth response is 429 `locked_out` with `retryAfterSecs`, and no cookie is set

#### Scenario: Lockout ends
- **WHEN** 60 seconds have passed since the lockout began
- **THEN** a login with the correct password from that address succeeds

#### Scenario: Existing session is unaffected
- **WHEN** an address is locked out and a request from it carries a valid session cookie
- **THEN** the request succeeds

#### Scenario: Remembered session
- **WHEN** a client logs in with `remember: true`
- **THEN** the session cookie carries a 30-day lifetime

#### Scenario: Plain session
- **WHEN** a client logs in without `remember`
- **THEN** the session cookie has no lifetime attribute and the session stops being accepted after 12 hours
  without requests
