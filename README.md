# SSHP / SSH Picker

SSHP is a terminal dashboard for saved SSH servers with an encrypted portable vault and SFTP file transfers.

## Install

From npm:

```bash
npm install -g ssh-picker
```

From the GitHub release tarball:

```bash
npm install -g https://github.com/adittanu/ssh-picker/releases/download/v0.3.0/ssh-picker-0.3.0.tgz
```

From a local checkout:

```bash
npm install -g .
```

The package builds automatically during install and exposes a global `sshp` command.

## Screenshots

### Dashboard

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ SSHP  Vault unlocked  3 servers                    / search   A add server │
│                                                                             │
│ ┌───────────────────────┐                                                   │
│ │ Servers      1-3/3    │  Server Details                                   │
│ │                       │                                                   │
│ │ > production-web      │  Name:     production-web                         │
│ │   staging-api         │  Host:     10.0.1.50                              │
│ │   dev-local           │  User:     ubuntu                                 │
│ │                       │  Port:     22                                     │
│ │                       │  Auth:     private_key                            │
│ │                       │  Remote:   /home/ubuntu                           │
│ │                       │  Last:     5/17/2026, 3:42 PM                     │
│ │                       │                                                   │
│ │                       │  Enter connect  F files  T test  E edit  Del rm   │
│ └───────────────────────┘                                                   │
│                                                                             │
│ Up/Down select  / search  Q quit                                            │
│ Status: Ready                                                               │
╰──────────────────────────────────────────────────────────────────────────────╯
```

### File Manager

```
╭──────────────────────────────────────────────────────────────────────────────╮
│ ┌─── Local (active) ────────────┐  ┌─── Remote ──────────────────────────┐  │
│ │ C:/Users/dev     1-8/12       │  │ /home/ubuntu     1-6/6              │  │
│ │                               │  │                                     │  │
│ │ › Documents/                  │  │   .ssh/                             │  │
│ │   Downloads/                  │  │   logs/                             │  │
│ │   Projects/                   │  │   app/                              │  │
│ │   config.json                 │  │   .bashrc                           │  │
│ │   notes.txt                   │  │   .profile                          │  │
│ │   deploy.sh                   │  │   README.md                         │  │
│ │                               │  │                                     │  │
│ └───────────────────────────────┘  └─────────────────────────────────────┘  │
│                                                                             │
│ Uploading: deploy.sh                                                        │
│ [########----------------] 33%  1.2 KB / 3.6 KB                             │
│                                                                             │
│ Enter open  U upload  / search local  Backspace/Left up  Tab remote  Q back │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## Quick start

```bash
sshp             # first run creates ~/.sshp/sshp.db, then offers to add a server
sshp add         # add another password-based SSH server
sshp             # open the dashboard
```

Dashboard keys:

- `Enter` connect to the selected server over SSH
- `F` open SFTP file manager
- `P` start local port forwarding through the selected server
- `T` test SSH connection without opening a shell
- `A` add a new server
- `E` edit the selected server
- `Delete` or `Backspace` delete the selected server after confirmation
- `S` open global settings
- `/` search servers
- `Q` or `Esc` quit

File manager keys:

- `Tab` switch local/remote pane
- `Enter` open selected folder
- `Backspace` or `Left` go to parent folder
- `/` search files in the active pane
- `U` upload selected local file/folder
- `D` download selected remote file/folder
- `M` create a folder in the active pane
- `N` rename the selected file/folder
- `X` delete the selected file/folder after confirmation
- `C` change file/folder permissions with an octal mode such as `644` or `755`
- `R` refresh both panes
- `Q` or `Esc` go back or quit when launched with `sshp files`

Transfers show a live progress bar for the active file and keep the panes usable for confirming where files are moving.

## Scriptable commands

```bash
sshp list
sshp connect <server>
sshp forward <server> 8080:127.0.0.1:80
sshp files <server>
sshp upload <server> <local> <remote>
sshp download <server> <remote> <local>
sshp export backup.sshp
sshp import backup.sshp
sshp import-ssh-config [file]
sshp import-termius hosts.csv
sshp config set dataDir <path>
```

Port forwarding keeps running until you press `Ctrl+C`. The forward spec accepts
`localPort:remoteHost:remotePort`, or `localPort:remotePort` when the remote host
is `127.0.0.1`.

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
