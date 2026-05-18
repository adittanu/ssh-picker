# SSHP / SSH Picker Design

Date: 2026-05-18
Status: Approved design draft
Project path: `D:/Project/ssh-picker`

## Summary

SSHP is a cross-platform Node.js CLI app that provides a visual terminal interface for managing SSH servers and SFTP file transfers. It is intended as a lightweight CLI-first alternative to Termius: fast to open from the terminal, portable across computers, and powerful enough for daily SSH and file-transfer workflows.

The main command is:

```bash
sshp
```

Opening `sshp` launches a terminal UI dashboard with server selection, quick SSH connection, server management, and an integrated SFTP file manager.

## Goals

- Provide a visual terminal dashboard so users do not need to memorize commands.
- Store server credentials in a portable encrypted SQLite vault.
- Support SSH password authentication from the encrypted vault.
- Support SFTP upload/download with local and remote file browsing.
- Work across Windows, macOS, and Linux from the first version.
- Allow backup and migration through direct data-folder copy or encrypted export/import.

## Non-goals for MVP

- Team sharing or multi-user collaboration.
- Cloud sync service managed by the app.
- Jump hosts and bastion chains.
- Port forwarding profile manager.
- Remote file editing.
- Full password-manager feature set.

These features should be considered later without blocking the initial architecture.

## User Experience

### Main dashboard

The default `sshp` command opens a hybrid dashboard:

```text
┌─ SSHP ──────────────┬─ Quick Actions ─────┐
│ › edukati-dev       │ Enter Connect SSH   │
│   staging-api       │ F     File Manager  │
│   personal-vps      │ A     Add Server    │
│                    │ E     Edit Server   │
├────────────────────┴──────────────────────┤
│ Recent paths: /var/www/app, /home/ubuntu   │
│ Vault: unlocked                            │
└───────────────────────────────────────────┘
```

Primary interactions:

- `Enter`: connect to selected server through SSH.
- `F`: open SFTP file manager for selected server.
- `A`: add a server.
- `E`: edit selected server.
- `Backspace` or `Delete`: remove selected server after confirmation.
- `/`: search/filter servers.
- `Esc` or `Q`: back/quit depending on current screen.

### SFTP file manager

The SFTP screen uses a dual-pane layout:

```text
┌─ Files: edukati-dev ───────────────────────┐
│ Local:  D:/Project/current                 │
│ Remote: /var/www/app                       │
├──────────────────────┬─────────────────────┤
│ Local files          │ Remote files        │
│ › report.xlsx        │ › .env              │
│   storage/           │   public/           │
│   app/               │   logs/             │
├──────────────────────┴─────────────────────┤
│ Tab pane  U upload  D download  R refresh  │
└────────────────────────────────────────────┘
```

MVP file-manager behavior:

- Browse local folders.
- Browse remote folders over SFTP.
- Upload selected local file or folder to current remote path.
- Download selected remote file or folder to current local path.
- Confirm overwrites.
- Show transfer progress.
- Remember last local and remote path per server.

## Command Surface

Interactive commands:

```bash
sshp
```

Scriptable commands:

```bash
sshp init
sshp add
sshp list
sshp connect <server>
sshp files <server>
sshp upload <server> <local> <remote>
sshp download <server> <remote> <local>
sshp export <file>
sshp import <file>
sshp config set dataDir <path>
```

The interactive TUI is the primary experience. Scriptable commands exist for automation and faster direct actions.

## Architecture

### Stack

- Runtime: Node.js.
- CLI command framework: a small command parser such as `commander`.
- TUI: React Ink.
- SSH and SFTP: `ssh2`.
- Database: SQLite.
- Encryption: master-password-derived key with authenticated encryption.
- Packaging: npm package with a global binary named `sshp`.

### Main modules

```text
src/
  cli/                 command parsing and entrypoint
  tui/                 Ink screens and components
  vault/               unlock, encryption, password handling
  db/                  SQLite connection, migrations, repositories
  ssh/                 SSH session adapter
  sftp/                SFTP adapter and transfer service
  import-export/       encrypted backup and restore
  config/              data directory and app settings
  shared/              types, errors, path helpers
```

Each module should expose a small public interface so storage, encryption, SSH, and UI details can evolve independently.

## Data Storage

Default data directory:

```text
~/.sshp/
```

Default database path:

```text
~/.sshp/sshp.db
```

The data directory can be overridden:

```bash
sshp config set dataDir <path>
```

### Tables

#### `servers`

- `id`
- `name`
- `host`
- `port`
- `username`
- `auth_type`
- `encrypted_password`
- `encrypted_private_key`
- `encrypted_passphrase`
- `tags`
- `notes`
- `default_remote_path`
- `last_connected_at`
- `connection_count`
- `created_at`
- `updated_at`

#### `settings`

- `key`
- `value`

#### `connection_history`

- `id`
- `server_id`
- `action`
- `local_path`
- `remote_path`
- `created_at`

## Security Design

SSHP uses a portable master-password model.

### Master password

- The user creates a master password during `sshp init`.
- The master password is never stored.
- The derived encryption key is kept only in memory for the current process.
- Opening the app requires unlocking the vault if encrypted values are needed.

### Key derivation and encryption

- Key derivation: Argon2id preferred; scrypt acceptable if Argon2id packaging becomes a cross-platform blocker.
- Encryption: AES-256-GCM.
- Salt, nonce, and encryption metadata are stored with encrypted records.
- The encrypted SQLite database remains portable because all required decryption metadata except the master password is stored alongside the data.

### Portable migration

Two migration styles are supported:

1. Copy the data directory directly:

```text
~/.sshp/
```

2. Export and import encrypted backup files:

```bash
sshp export backup.sshp
sshp import backup.sshp
```

Exported files remain encrypted and require the master password to import or use.

## Error Handling

- Wrong master password: show a clear error and allow retry without mutating data.
- Missing vault: prompt to run `sshp init` or start initialization.
- Corrupt database: show recovery guidance and avoid destructive repair by default.
- Unsupported database version: show migration guidance.
- Server unreachable: show SSH/SFTP error and offer retry/back.
- Authentication failure: offer retry or edit credential.
- Transfer failure: show failed file/path and preserve partial-success information.
- Overwrite conflicts: require explicit confirmation.

## Testing Strategy

Automated tests:

- Encryption/decryption roundtrip.
- Wrong master password rejection.
- SQLite repository CRUD.
- Database migration behavior.
- Import/export roundtrip.
- Path handling across Windows, macOS, and Linux path formats.

Integration tests:

- SSH/SFTP adapter against a local or mocked SSH server where practical.
- Upload/download behavior for files and folders.

Manual tests:

- TUI rendering in Windows Terminal.
- TUI rendering in macOS Terminal.
- TUI rendering in common Linux terminals.
- Password unlock and SSH connection flow.
- SFTP file transfer flow.

## MVP Acceptance Criteria

The MVP is complete when:

- `npm install -g` exposes the `sshp` command.
- `sshp init` creates a portable encrypted vault.
- `sshp add` can add a password-based SSH server.
- `sshp` opens the hybrid dashboard.
- Selecting a server and pressing `Enter` opens an SSH session.
- Pressing `F` opens the dual-pane SFTP file manager.
- Upload and download work for files, with overwrite confirmation.
- `sshp export` and `sshp import` move encrypted data between machines.
- The same vault can be copied to another computer and unlocked with the same master password.

## Future Enhancements

- SSH private key and passphrase support.
- Jump host / bastion support.
- Port forwarding profiles.
- Remote file edit flow.
- Folder sync.
- Server health checks.
- Tags and advanced filters.
- Recent/frequent server ranking.
- Team/shared vault model.
