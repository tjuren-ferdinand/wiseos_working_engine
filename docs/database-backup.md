# Database backup and restore guide

## SQLite (development)

The development database is a single SQLite file at `apps/api/wiseos.db`.

### Backup

```powershell
# PowerShell — create timestamped backup
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
Copy-Item apps/api/wiseos.db "apps/api/wiseos.db.bak.$ts"
```

```bash
# Bash — create timestamped backup
cp apps/api/wiseos.db "apps/api/wiseos.db.bak.$(date +%Y%m%d_%H%M%S)"
```

### Restore

```powershell
# Stop the API first, then:
Copy-Item "apps/api/wiseos.db.bak.<timestamp>" apps/api/wiseos.db
```

### Verify integrity

```bash
sqlite3 apps/api/wiseos.db "PRAGMA integrity_check"
sqlite3 apps/api/wiseos.db "SELECT COUNT(*) FROM grading_results"
```

## PostgreSQL (production)

When `DATABASE_URL` points to PostgreSQL:

### Backup

```bash
# Logical backup (recommended for small-to-medium databases)
pg_dump -Fc "$DATABASE_URL" > "wiseos_backup_$(date +%Y%m%d_%H%M%S).dump"

# Or plain SQL
pg_dump "$DATABASE_URL" > "wiseos_backup_$(date +%Y%m%d_%H%M%S).sql"
```

### Restore

```bash
# From custom-format dump
pg_restore -d "$DATABASE_URL" "wiseos_backup_<timestamp>.dump"

# From SQL dump
psql "$DATABASE_URL" < "wiseos_backup_<timestamp>.sql"
```

## Migration safety

- **Always backup before running migrations** — `alembic upgrade head` can
  modify schema. Take a backup first, verify the migration on a copy, then
  apply to the real database.
- **Test on a copy** — copy the database file, run migrations against the copy,
  verify with `PRAGMA index_list` and row counts.
- **Stamped baselines** — existing databases are stamped at the baseline
  revision (`c6c4ebf10225`) rather than rebuilt, preserving existing schema
  differences (e.g., nullable columns, missing FKs).

## Retention policy

The `RETENTION_ANONYMIZE_DAYS` and `RETENTION_HARD_DELETE_DAYS` settings control
GDPR-compliant data retention. The retention sweep anonymizes student data after
30 days and hard-deletes after 90 days. Backups taken before a sweep will contain
the pre-anonymization data.
