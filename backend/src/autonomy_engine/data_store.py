"""CSV-backed transaction store -- the thing the agent's actions actually touch.

Up to Phase 4 the engine scored and routed actions but never performed them: an
approved deletion flipped an audit status and nothing was deleted. That made the
demo hard to believe, because "irreversible" was a label the model typed rather
than a property of the system.

This module is the other half. ``data/customer_shopping_data.csv`` holds ~99,000
real retail transactions, and the tools in :mod:`autonomy_engine.agent_actions`
map onto real reads and writes against it. A CSV rather than a database on
purpose: a human can open the file, approve a deletion, and watch the rows go.

Why the scale matters
---------------------
At 99k rows the gap between "delete invoice I138884" and "delete every Clothing
transaction" is one row versus thirty-four thousand. That gap is the entire
point of a graduated autonomy engine, and it is only visible on a dataset big
enough for a careless filter to be catastrophic. It also means reads are capped
and aggregation is a first-class operation -- returning 34,487 rows to answer
"how much did Clothing make?" would be useless.

Dates
-----
The source data is day-first ``DD/MM/YYYY`` with inconsistent zero-padding
(``5/8/2022`` and ``16/05/2021`` both appear). Filters are written in
unambiguous ISO ``YYYY-MM-DD`` and parsed day-first on the way in, so the model
never has to guess which component is the month -- the one thing about this
dataset most likely to silently select the wrong rows.

Snapshots
---------
Every mutating operation copies the file to ``data/snapshots/<tag>.csv`` before
touching it, where ``tag`` is the audit record id of the action. That gives the
risk model's ``reversibility`` dimension teeth: a "reversible" update really can
be rolled back with :func:`restore_snapshot`. The copy is ~7 MB, which is cheap
next to the cost of an unrecoverable bulk delete.

Writes go through a temp file and :func:`os.replace`, so an interrupted write
leaves the original intact rather than a half-written CSV.
"""

from __future__ import annotations

import csv
import os
import shutil
from collections import Counter
from datetime import date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Final, Literal, TypeAlias

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------
# Schema
# --------------------------------------------------------------------------

# Dynamic Schema Support
class Schema:
    def __init__(self, fields, id_field, date_fields, numeric_fields, field_values, column_map, date_format):
        self.fields = fields
        self.id_field = id_field
        self.date_fields = date_fields
        self.numeric_fields = numeric_fields
        self.field_values = field_values
        self.column_map = column_map
        self.date_format = date_format


SUPERSTORE_SCHEMA = Schema(
    fields=(
        "order_id", "customer_id", "customer_name", "segment", "category",
        "sub_category", "region", "market", "ship_mode", "order_priority",
        "quantity", "sales", "profit", "discount", "order_date", "state"
    ),
    id_field="order_id",
    date_fields=frozenset({"order_date"}),
    numeric_fields=frozenset({"quantity", "sales", "profit", "discount"}),
    field_values={
        "segment": ("Consumer", "Corporate", "Home Office"),
        "category": ("Furniture", "Office Supplies", "Technology"),
        "sub_category": (
            "Accessories", "Appliances", "Art", "Binders", "Bookcases",
            "Chairs", "Copiers", "Envelopes", "Fasteners", "Furnishings",
            "Labels", "Machines", "Paper", "Phones", "Storage", "Supplies", "Tables",
        ),
        "region": (
            "West", "East", "Central", "South",
            "EMEA", "Africa", "Canada", "Central Asia",
            "Caribbean", "North", "North Asia", "Oceania", "Southeast Asia",
        ),
        "market": ("US", "EU", "APAC", "LATAM", "Africa", "EMEA", "Canada"),
        "ship_mode": ("Standard Class", "Second Class", "First Class", "Same Day"),
        "order_priority": ("Low", "Medium", "High", "Critical"),
    },
    column_map={
        "Order.ID":        "order_id",
        "Customer.ID":     "customer_id",
        "Customer.Name":   "customer_name",
        "Segment":         "segment",
        "Category":        "category",
        "Sub.Category":    "sub_category",
        "Region":          "region",
        "Market":          "market",
        "Ship.Mode":       "ship_mode",
        "Order.Priority":  "order_priority",
        "Quantity":        "quantity",
        "Sales":           "sales",
        "Profit":          "profit",
        "Discount":        "discount",
        "Order.Date":      "order_date",
        "State":           "state",
    },
    date_format="%Y-%m-%d %H:%M:%S.%f"
)

SHOPPING_SCHEMA = Schema(
    fields=(
        "invoice_no", "customer_id", "gender", "age", "category",
        "quantity", "price", "payment_method", "invoice_date", "shopping_mall"
    ),
    id_field="invoice_no",
    date_fields=frozenset({"invoice_date"}),
    numeric_fields=frozenset({"age", "quantity", "price"}),
    field_values={
        "gender": ("Male", "Female"),
        "category": (
            "Clothing", "Shoes", "Books", "Cosmetics", "Food & Beverage", "Toys", "Technology", "Souvenir"
        ),
        "payment_method": ("Cash", "Credit Card", "Debit Card"),
        "shopping_mall": (
            "Kanyon", "Forum Istanbul", "Metrocity", "Metropol AVM", "Istinye Park", "Mall of Istanbul",
            "Emaar Square Mall", "Cevahir AVM", "Viaport Outlet", "Zorlu Center"
        ),
    },
    column_map=None,
    date_format="%d/%m/%Y"
)

_detected_schema_cache = None
_detected_schema_path = None
_detected_schema_mtime = None


def active_schema() -> Schema:
    global _detected_schema_cache, _detected_schema_path, _detected_schema_mtime
    s3_loc = _s3_bucket_key()
    if s3_loc and _S3_LOCAL_CACHE.exists():
        try:
            with _S3_LOCAL_CACHE.open(encoding="utf-8-sig") as f:
                header = f.readline()
                if "invoice_no" in header:
                    return SHOPPING_SCHEMA
                else:
                    return SUPERSTORE_SCHEMA
        except Exception:
            pass

    path = data_path()
    try:
        mtime = path.stat().st_mtime
    except OSError:
        mtime = 0
    if _detected_schema_cache is not None and _detected_schema_path == path and _detected_schema_mtime == mtime:
        return _detected_schema_cache

    if path.exists():
        try:
            with path.open(encoding="utf-8-sig") as f:
                header = f.readline()
                if "invoice_no" in header:
                    _detected_schema_cache = SHOPPING_SCHEMA
                else:
                    _detected_schema_cache = SUPERSTORE_SCHEMA
        except Exception:
            _detected_schema_cache = SUPERSTORE_SCHEMA
    else:
        _detected_schema_cache = SUPERSTORE_SCHEMA

    _detected_schema_path = path
    _detected_schema_mtime = mtime
    return _detected_schema_cache


def __getattr__(name: str) -> Any:
    schema = active_schema()
    if name == "FIELDS":
        return schema.fields
    if name == "ID_FIELD":
        return schema.id_field
    if name == "DATE_FIELDS":
        return schema.date_fields
    if name == "NUMERIC_FIELDS":
        return schema.numeric_fields
    if name == "FIELD_VALUES":
        return schema.field_values
    if name == "STORAGE_DATE_FORMAT":
        return schema.date_format
    if name == "_CSV_COLUMN_MAP":
        return schema.column_map
    if name == "_TYPED_OPERATORS":
        return {
            "before": schema.date_fields,
            "after": schema.date_fields,
            "greater_than": schema.numeric_fields,
            "less_than": schema.numeric_fields,
        }
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__() -> list[str]:
    return sorted(list(globals().keys()) + [
        "FIELDS", "ID_FIELD", "DATE_FIELDS", "NUMERIC_FIELDS",
        "FIELD_VALUES", "STORAGE_DATE_FORMAT", "_CSV_COLUMN_MAP", "_TYPED_OPERATORS"
    ])


#: Clean snake_case field names exposed to the agent and filter layer (type hints for type-checkers).
FIELDS: Final[tuple[str, ...]]
ID_FIELD: Final[str]
DATE_FIELDS: Final[frozenset[str]]
NUMERIC_FIELDS: Final[frozenset[str]]
FIELD_VALUES: Final[dict[str, tuple[str, ...]]]
STORAGE_DATE_FORMAT: Final[str]
_CSV_COLUMN_MAP: Final[dict[str, str]]
_TYPED_OPERATORS: Final[dict[str, frozenset[str]]]

#: How many deleted invoice numbers to name in a bulk-delete result. The
#: snapshot holds the full record; this is just enough for a human to
#: spot-check what went, without putting 34,000 ids in an audit row.
DELETED_ID_SAMPLE: Final[int] = 20

Operator: TypeAlias = Literal[
    "equals",
    "not_equals",
    "contains",
    "before",
    "after",
    "greater_than",
    "less_than",
]


# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------


class DataStoreError(RuntimeError):
    """Base class for transaction-store failures."""


class UnknownFieldError(DataStoreError):
    """A filter or update named a column that does not exist."""


class RecordNotFoundError(DataStoreError):
    """No transaction row matches the given invoice number."""


class UnboundedDeleteError(DataStoreError):
    """A bulk delete arrived with no filter criteria.

    Raised rather than deleting everything. An empty criteria list is almost
    always a model that failed to express its filter, not a genuine request to
    wipe 99,000 transactions, and that failure mode is not one worth being
    relaxed about.
    """


class SnapshotNotFoundError(DataStoreError):
    """No snapshot exists for the given tag."""


# --------------------------------------------------------------------------
# Filters
# --------------------------------------------------------------------------


class Criterion(BaseModel):
    """One field/operator/value test. Multiple criteria are ANDed together."""

    field: str = Field(description="Column to test. Must be one of FIELDS.")
    operator: Operator = Field(description="How to compare the column to value.")
    value: str = Field(description="Value to compare against, as a string.")


# --------------------------------------------------------------------------
# Paths
# --------------------------------------------------------------------------

_DEFAULT_DATA_PATH: Final[Path] = (
    Path(__file__).resolve().parents[2] / "data" / "superstore.csv"
)

# When running on Lambda the CSV lives in S3.
# Set CUSTOMER_DATA_S3_URI=s3://bucket/key.csv to enable.
_S3_URI: str | None = os.getenv("CUSTOMER_DATA_S3_URI") or None


def _s3_bucket_key() -> tuple[str, str] | None:
    """Parse CUSTOMER_DATA_S3_URI into (bucket, key). Returns None if not set."""
    if not _S3_URI:
        return None
    # s3://bucket/path/to/file.csv
    without_scheme = _S3_URI.removeprefix("s3://")
    bucket, _, key = without_scheme.partition("/")
    return bucket, key


def data_path() -> Path:
    """Location of the transaction CSV for local use. Override with CUSTOMER_DATA_PATH."""
    override = os.getenv("CUSTOMER_DATA_PATH")
    return Path(override) if override else _DEFAULT_DATA_PATH


def snapshot_dir() -> Path:
    """Directory holding pre-write snapshots. Override with CUSTOMER_SNAPSHOT_DIR."""
    override = os.getenv("CUSTOMER_SNAPSHOT_DIR")
    return Path(override) if override else Path("/tmp/snapshots")


# --------------------------------------------------------------------------
# File I/O  (local + S3)
# --------------------------------------------------------------------------

_S3_LOCAL_CACHE: Path = Path("/tmp/superstore.csv")


def _normalise_row(raw: dict[str, str], schema: Schema | None = None) -> dict[str, str]:
    """Map raw CSV columns to clean FIELDS names based on active schema.

    Drops columns not in active_schema().column_map and normalises date value.
    """
    if schema is None:
        schema = active_schema()
    if schema.column_map is None:
        return raw
    out: dict[str, str] = {}
    for csv_col, field_name in schema.column_map.items():
        val = raw.get(field_name, raw.get(csv_col, ""))
        if field_name == "order_date" and val:
            # Trim the time component: "2011-01-07 00:00:00.000" -> "2011-01-07"
            val = val.split(" ")[0]
        out[field_name] = val
    return out

# In-memory cache for loaded rows. Reading and normalising 51k rows from a
# 15 MB CSV takes ~200ms per call, and a single /propose request triggers
# load_rows() 3-5 times (count_matching, preflight, execute). Caching here
# cuts that to one disk read per server lifetime (invalidated on writes).
_rows_cache: list[dict[str, str]] | None = None
_rows_cache_signature: tuple[str, int, float] | None = None


def _invalidate_cache() -> None:
    """Clear the in-memory row cache. Called after every write."""
    global _rows_cache, _rows_cache_signature
    _rows_cache = None
    _rows_cache_signature = None


def load_rows() -> list[dict[str, str]]:
    """Read every transaction row — cached in memory, invalidated on writes."""
    global _rows_cache, _rows_cache_signature

    s3_loc = _s3_bucket_key()
    if s3_loc:
        return _load_rows_s3(*s3_loc)

    path = data_path()
    if not path.exists():
        raise DataStoreError(
            f"transaction data file not found at {path}. "
            "Set CUSTOMER_DATA_PATH or CUSTOMER_DATA_S3_URI."
        )

    sig = _file_signature()
    if _rows_cache is not None and _rows_cache_signature == sig:
        return [dict(row) for row in _rows_cache]

    with path.open(newline="", encoding="utf-8-sig") as handle:
        _rows_cache = [_normalise_row(dict(row)) for row in csv.DictReader(handle)]
    _rows_cache_signature = sig
    return [dict(row) for row in _rows_cache]


def _load_rows_s3(bucket: str, key: str) -> list[dict[str, str]]:
    """Download from S3 to /tmp cache, then read. Re-downloads if missing."""
    import io
    import boto3 as _boto3
    if not _S3_LOCAL_CACHE.exists():
        try:
            s3 = _boto3.client("s3")
            buf = io.BytesIO()
            s3.download_fileobj(bucket, key, buf)
            buf.seek(0)
            _S3_LOCAL_CACHE.parent.mkdir(parents=True, exist_ok=True)
            _S3_LOCAL_CACHE.write_bytes(buf.read())
        except Exception as exc:
            logger.warning("Failed to fetch S3 data file s3://%s/%s (%s); falling back to bundled data_path()", bucket, key, exc)
            path = data_path()
            if path.exists():
                with path.open(newline="", encoding="utf-8-sig") as handle:
                    rows = [dict(row) for row in csv.DictReader(handle)]
                    schema = active_schema()
                    if rows:
                        first = rows[0]
                        if "invoice_no" in first or "shopping_mall" in first or "price" in first:
                            schema = SHOPPING_SCHEMA
                        elif "order_id" in first or "customer_name" in first:
                            schema = SUPERSTORE_SCHEMA
                    return [_normalise_row(r, schema=schema) for r in rows]
            raise
    with _S3_LOCAL_CACHE.open(newline="", encoding="utf-8-sig") as handle:
        rows = [dict(row) for row in csv.DictReader(handle)]
        schema = active_schema()
        if rows:
            first = rows[0]
            if "invoice_no" in first or "shopping_mall" in first or "price" in first:
                schema = SHOPPING_SCHEMA
            elif "order_id" in first or "customer_name" in first:
                schema = SUPERSTORE_SCHEMA
        return [_normalise_row(r, schema=schema) for r in rows]


def _write_rows(rows: list[dict[str, str]]) -> None:
    """Overwrite the CSV atomically — writes to /tmp then syncs to S3 on Lambda."""
    s3_loc = _s3_bucket_key()
    if s3_loc:
        _write_rows_s3(rows, *s3_loc)
        _invalidate_cache()
        return
    path = data_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(".csv.tmp")
    with temp_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(active_schema().fields))
        writer.writeheader()
        writer.writerows(rows)
    os.replace(temp_path, path)
    _invalidate_cache()


def _write_rows_s3(rows: list[dict[str, str]], bucket: str, key: str) -> None:
    """Write rows back to S3 and update the local /tmp cache."""
    import io
    import boto3 as _boto3
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(active_schema().fields))
    writer.writeheader()
    writer.writerows(rows)
    body = buf.getvalue().encode("utf-8")
    _boto3.client("s3").put_object(Bucket=bucket, Key=key, Body=body)
    # Invalidate local cache so next load_rows re-reads fresh data
    if _S3_LOCAL_CACHE.exists():
        _S3_LOCAL_CACHE.unlink()


# --------------------------------------------------------------------------
# Snapshots
# --------------------------------------------------------------------------


def take_snapshot(tag: str) -> str:
    """Copy the current CSV aside before a mutation, and return the copy's path.

    Args:
        tag: Identifier for the snapshot. Callers pass the audit record id, so
            the snapshot and the audit entry that authorised the change share a
            name and either one can find the other.
    """
    destination = snapshot_dir() / f"{tag}.csv"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(data_path(), destination)
    return str(destination)


def restore_snapshot(tag: str) -> int:
    """Roll the CSV back to the snapshot taken before action ``tag``.

    Returns:
        The number of rows in the restored file.

    Raises:
        SnapshotNotFoundError: If no snapshot was taken under that tag.
    """
    source = snapshot_dir() / f"{tag}.csv"
    if not source.exists():
        raise SnapshotNotFoundError(f"no snapshot for {tag!r} at {source}")
    shutil.copy2(source, data_path())
    return len(load_rows())


# --------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------


def _validate_field(field: str) -> None:
    schema = active_schema()
    if field not in schema.fields:
        raise UnknownFieldError(
            f"{field!r} is not a transaction field; expected one of {list(schema.fields)}"
        )


def _parse_stored_date(value: str, *, context: str) -> date:
    """Parse a date as stored in the file, based on active schema."""
    schema = active_schema()
    text = value.strip().split(" ")[0]
    if schema.date_format == "%d/%m/%Y":
        try:
            return datetime.strptime(text, "%d/%m/%Y").date()
        except ValueError as exc:
            raise DataStoreError(
                f"{context}: stored date {value!r} is not in DD/MM/YYYY form"
            ) from exc
    else:
        try:
            return date.fromisoformat(text)
        except ValueError as exc:
            raise DataStoreError(
                f"{context}: stored date {value!r} is not in YYYY-MM-DD form"
            ) from exc


def _parse_filter_date(value: str, *, context: str) -> date:
    """Parse a date supplied in a filter.

    ISO ``YYYY-MM-DD`` is the documented form and is tried first because it is
    unambiguous. Day-first is accepted as a fallback for a model that echoed the
    file's own format back at us -- rejecting that would be pedantry, but
    guessing between ``05/08`` and ``08/05`` would not be, hence ISO first.
    """
    text = value.strip()
    try:
        return date.fromisoformat(text)
    except ValueError:
        pass
    try:
        return datetime.strptime(text, active_schema().date_format).date()
    except ValueError as exc:
        raise DataStoreError(
            f"{context}: {value!r} is not a date; use ISO form, e.g. 2022-08-05"
        ) from exc


def _parse_number(value: str, *, context: str) -> float:
    try:
        return float(value.strip() or 0)
    except ValueError as exc:
        raise DataStoreError(f"{context}: {value!r} is not a number") from exc


def _matches(row: dict[str, str], criterion: Criterion) -> bool:
    """Test one row against one criterion.

    String comparisons are case-insensitive: the model writes ``"clothing"`` or
    ``"Clothing"`` interchangeably, and a filter that silently matched nothing
    because of casing would be scored as a safe no-op when it was really a bug.
    """
    _validate_field(criterion.field)

    schema = active_schema()
    typed_operators = {
        "before": schema.date_fields,
        "after": schema.date_fields,
        "greater_than": schema.numeric_fields,
        "less_than": schema.numeric_fields,
    }
    allowed_fields = typed_operators.get(criterion.operator)
    if allowed_fields is not None and criterion.field not in allowed_fields:
        raise DataStoreError(
            f"operator {criterion.operator!r} is not valid on field "
            f"{criterion.field!r}; it applies to {sorted(allowed_fields)}"
        )

    cell = row.get(criterion.field, "")
    wanted = criterion.value
    context = f"filter on {criterion.field}"

    if criterion.operator == "equals":
        return cell.strip().casefold() == wanted.strip().casefold()
    if criterion.operator == "not_equals":
        return cell.strip().casefold() != wanted.strip().casefold()
    if criterion.operator == "contains":
        return wanted.strip().casefold() in cell.casefold()
    if criterion.operator == "before":
        return _parse_stored_date(cell, context=context) < _parse_filter_date(
            wanted, context=context
        )
    if criterion.operator == "after":
        return _parse_stored_date(cell, context=context) > _parse_filter_date(
            wanted, context=context
        )
    if criterion.operator == "greater_than":
        return _parse_number(cell, context=context) > _parse_number(wanted, context=context)
    if criterion.operator == "less_than":
        return _parse_number(cell, context=context) < _parse_number(wanted, context=context)

    raise DataStoreError(f"unknown operator: {criterion.operator!r}")  # pragma: no cover


def select(criteria: list[Criterion]) -> list[dict[str, str]]:
    """Every row satisfying all criteria. Empty criteria selects everything."""
    rows = load_rows()
    return [row for row in rows if all(_matches(row, c) for c in criteria)]


def count_matching(criteria: list[Criterion]) -> int:
    """How many rows a filter would touch. Used to fact-check the agent's
    ``data_scope`` estimate against reality before anything is executed."""
    return len(select(criteria))


def _file_signature() -> tuple[str, int, float]:
    """Cheap identity for the current data file, for cache invalidation."""
    path = data_path()
    try:
        stat = path.stat()
        return (str(path), stat.st_size, stat.st_mtime)
    except OSError:
        return (str(path), -1, -1.0)


@lru_cache(maxsize=8)
def _distribution_cached(field: str, _signature: tuple[str, int, float]) -> dict[str, int]:
    counts: Counter[str] = Counter(row.get(field, "") for row in load_rows())
    return dict(counts.most_common())


def distribution(field: str) -> dict[str, int]:
    """How many rows hold each value of a categorical column, commonest first.

    Exists so the agent can be *told* the cardinalities instead of guessing
    them. "Delete every Souvenir transaction at Kanyon" is a request whose blast
    radius is unknowable from the text alone -- it could be five rows or five
    thousand -- and a model asked to estimate it will guess. Putting the real
    numbers in the system prompt turns that guess into a lookup.

    Cached against the file's size and mtime, so a delete that changes the
    counts invalidates it rather than leaving the agent reasoning from a stale
    picture of a table it just shrank.
    """
    _validate_field(field)
    return _distribution_cached(field, _file_signature())


# --------------------------------------------------------------------------
# Reads
# --------------------------------------------------------------------------


def query(criteria: list[Criterion], limit: int | None = None) -> list[dict[str, str]]:
    """Read rows matching a filter. Changes nothing."""
    rows = select(criteria)
    return rows[:limit] if limit is not None else rows


def summarize(criteria: list[Criterion], group_by: str | None = None) -> dict[str, Any]:
    """Aggregate matching rows instead of returning them.

    With ~99k rows, "how much revenue did Cosmetics make at Kanyon?" is a real
    question whose honest answer is one number, not 15,097 rows. Returning rows
    for that would blow past the read cap and answer nothing.

    Args:
        criteria: Filter to aggregate over.
        group_by: Optional column to break the totals down by.

    Returns:
        Overall ``transactions``/``total_quantity``/``total_revenue``, plus a
        ``groups`` breakdown when ``group_by`` is given.
    """
    if group_by is not None:
        _validate_field(group_by)

    schema = active_schema()
    rows = select(criteria)
    
    if "sales" in schema.fields:
        total_revenue = round(
            sum(_parse_number(r["sales"], context="sales") for r in rows), 2
        )
        total_profit = round(
            sum(_parse_number(r["profit"], context="profit") for r in rows), 2
        )
    else:
        total_revenue = round(
            sum(
                _parse_number(r["price"], context="price")
                * _parse_number(r["quantity"], context="quantity")
                for r in rows
            ),
            2
        )
        total_profit = 0.0

    totals = {
        "transactions": len(rows),
        "total_quantity": sum(_parse_number(r["quantity"], context="quantity") for r in rows),
        "total_revenue": total_revenue,
    }
    if "sales" in schema.fields:
        totals["total_profit"] = total_profit

    if group_by is None:
        return totals

    groups: dict[str, dict[str, float]] = {}
    for row in rows:
        if "sales" in schema.fields:
            bucket = groups.setdefault(
                row[group_by], {"transactions": 0, "total_quantity": 0.0, "total_revenue": 0.0, "total_profit": 0.0}
            )
            bucket["total_revenue"] += _parse_number(row["sales"], context="sales")
            bucket["total_profit"] += _parse_number(row["profit"], context="profit")
        else:
            bucket = groups.setdefault(
                row[group_by], {"transactions": 0, "total_quantity": 0.0, "total_revenue": 0.0}
            )
            bucket["total_revenue"] += _parse_number(row["price"], context="price") * _parse_number(row["quantity"], context="quantity")
            
        bucket["transactions"] += 1
        bucket["total_quantity"] += _parse_number(row["quantity"], context="quantity")

    for bucket in groups.values():
        bucket["total_revenue"] = round(bucket["total_revenue"], 2)
        if "total_profit" in bucket:
            bucket["total_profit"] = round(bucket["total_profit"], 2)

    totals["groups"] = dict(
        sorted(groups.items(), key=lambda kv: kv[1]["total_revenue"], reverse=True)
    )
    return totals


# --------------------------------------------------------------------------
# Writes
# --------------------------------------------------------------------------


def _find_row(rows: list[dict[str, str]], invoice_no: str) -> dict[str, str] | None:
    schema = active_schema()
    wanted = invoice_no.strip().casefold()
    return next((r for r in rows if r[schema.id_field].strip().casefold() == wanted), None)


def update_record(
    invoice_no: str,
    field: str,
    new_value: str,
    *,
    snapshot_tag: str,
) -> dict[str, Any]:
    """Write one field on one transaction row.

    Args:
        invoice_no: Row to change.
        field: Column to write. ``invoice_no`` itself is not writable.
        new_value: Value to store.
        snapshot_tag: Audit record id; the pre-write snapshot is filed under it.

    Returns:
        ``{"invoice_no", "field", "old_value", "new_value", "snapshot"}`` -- the
        before and after, so the audit entry can show what actually changed
        rather than only what was requested.

    Raises:
        UnknownFieldError: Unknown or non-writable column.
        RecordNotFoundError: No such invoice.
    """
    _validate_field(field)
    schema = active_schema()
    if field == schema.id_field:
        raise UnknownFieldError(f"{schema.id_field!r} is the primary key and cannot be updated")

    rows = load_rows()
    target = _find_row(rows, invoice_no)
    if target is None:
        raise RecordNotFoundError(f"no transaction with {schema.id_field}={invoice_no!r}")

    snapshot = take_snapshot(snapshot_tag)
    old_value = target[field]
    target[field] = new_value
    _write_rows(rows)

    return {
        "invoice_no": target[schema.id_field],
        "field": field,
        "old_value": old_value,
        "new_value": new_value,
        "snapshot": snapshot,
    }


def delete_record(invoice_no: str, *, snapshot_tag: str) -> dict[str, Any]:
    """Delete exactly one transaction, by invoice number."""
    schema = active_schema()
    rows = load_rows()
    target = _find_row(rows, invoice_no)
    if target is None:
        raise RecordNotFoundError(f"no transaction with {schema.id_field}={invoice_no!r}")

    snapshot = take_snapshot(snapshot_tag)
    remaining = [r for r in rows if r is not target]
    _write_rows(remaining)

    return {
        "deleted_count": 1,
        "deleted_ids": [target[schema.id_field]],
        "deleted_row": dict(target),
        "remaining": len(remaining),
        "snapshot": snapshot,
    }


def delete_matching(
    criteria: list[Criterion],
    *,
    snapshot_tag: str,
    allow_unbounded: bool = False,
) -> dict[str, Any]:
    """Delete every row matching the filter.

    Args:
        criteria: The filter. Must be non-empty unless ``allow_unbounded``.
        snapshot_tag: Audit record id; the pre-delete snapshot is filed under it.
        allow_unbounded: Permit an empty filter, i.e. delete every transaction.
            Defaults to ``False`` and no caller in the engine passes ``True``.

    Returns:
        ``{"deleted_count", "deleted_ids", "remaining", "snapshot"}``.
        ``deleted_ids`` is capped -- a 34,000-entry list of invoice numbers in
        an audit record helps nobody.

    Raises:
        UnboundedDeleteError: Empty criteria without ``allow_unbounded``.
    """
    if not criteria and not allow_unbounded:
        raise UnboundedDeleteError(
            "refusing to delete with no filter criteria: this would remove every "
            "transaction. Pass allow_unbounded=True only if that is genuinely intended."
        )

    schema = active_schema()
    rows = load_rows()
    # Partitioned in one pass by identity rather than by filtering twice on
    # value: two transactions can legitimately hold identical field values, and
    # a value-based `not in` check would delete both when only one matched.
    doomed: list[dict[str, str]] = []
    survivors: list[dict[str, str]] = []
    for row in rows:
        (doomed if all(_matches(row, c) for c in criteria) else survivors).append(row)

    snapshot = take_snapshot(snapshot_tag)
    _write_rows(survivors)

    return {
        "deleted_count": len(doomed),
        "deleted_ids": [row[schema.id_field] for row in doomed[:DELETED_ID_SAMPLE]],
        "deleted_ids_truncated": len(doomed) > DELETED_ID_SAMPLE,
        "remaining": len(survivors),
        "snapshot": snapshot,
    }
