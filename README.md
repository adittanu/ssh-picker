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
- `T` test SSH connection without opening a shell
- `A` add a new server
- `E` edit the selected server
- `Delete` or `Backspace` delete the selected server after confirmation
- `/` search servers
- `Q` or `Esc` quit

File manager keys:

- `Tab` switch local/remote pane
- `Enter` open selected folder
- `Backspace` or `Left` go to parent folder
- `/` search files in the active pane
- `U` upload selected local file/folder
- `D` download selected remote file/folder
- `R` refresh both panes
- `Q` or `Esc` go back or quit when launched with `sshp files`

Transfers show a live progress bar for the active file and keep the panes usable for confirming where files are moving.

## Scriptable commands

```bash
sshp list
sshp connect <server>
sshp files <server>
sshp upload <server> <local> <remote>
sshp download <server> <remote> <local>
sshp export backup.sshp
sshp import backup.sshp
sshp import-ssh-config [file]
sshp import-termius hosts.csv
sshp config set dataDir <path>
```

## Security notes

- The master password is never stored.
- Credentials are encrypted with AES-256-GCM.
- The vault key is derived with Node's `scrypt` implementation.
- Export files encrypt the SQLite vault backup and require the master password to import.
- Server metadata in the local SQLite database is not encrypted; protect access to your data directory.

## Imports

- `sshp import-ssh-config` imports hosts from `~/.ssh/config`, including readable `IdentityFile` private keys.
- `sshp import-termius hosts.csv` imports host rows from a Termius-style CSV. Full Termius encrypted vault export is not publicly documented, so CSV import is the supported path.

## Development

```bash
npm install
npm run build
npm test
```
