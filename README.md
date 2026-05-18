# SSHP / SSH Picker

SSHP is a terminal dashboard for saved SSH servers with an encrypted portable vault and SFTP file transfers.

## Install

From npm:

```bash
npm install -g ssh-picker
```

From the GitHub release tarball:

```bash
npm install -g https://github.com/adittanu/ssh-picker/releases/download/v0.1.0/ssh-picker-0.1.0.tgz
```

From a local checkout:

```bash
npm install -g .
```

The package builds automatically during install and exposes a global `sshp` command.

## Quick start

```bash
sshp             # first run creates ~/.sshp/sshp.db, then offers to add a server
sshp add         # add another password-based SSH server
sshp             # open the dashboard
```

Dashboard keys:

- `Enter` connect to the selected server over SSH
- `F` open SFTP file manager
- `/` search servers
- `Q` or `Esc` quit

## Scriptable commands

```bash
sshp list
sshp connect <server>
sshp files <server>
sshp upload <server> <local> <remote>
sshp download <server> <remote> <local>
sshp export backup.sshp
sshp import backup.sshp
sshp config set dataDir <path>
```

## Security notes

- The master password is never stored.
- Credentials are encrypted with AES-256-GCM.
- The vault key is derived with Node's `scrypt` implementation.
- Export files contain the already-encrypted SQLite vault and still require the master password.

## Development

```bash
npm install
npm run build
npm test
```
