# La Monjita Invoice Backfill — DRY RUN

**Generated:** 2026-06-10
**Target Supabase project:** `ilkxyudurumpvkapdhbh`
**Status:** 🔍 DRY RUN — nothing was written. No schema, data, or code was modified. The SQL below is provided for review and was **not** executed.

---

## Step 1 — Client resolution

Queried `clients` for `name ILIKE '%monjita%' OR company ILIKE '%monjita%'`. **Exactly one** match found.

| Field | Value |
|---|---|
| `client_id` | `c6ac98a8-526b-445d-868a-04c295b16b1f` |
| `name` | La Monjita |
| `email` | pablo@alius.vc |
| `company` | Alius Ventures LLC |
| `address` | `169 Madison Ave STE 2733`<br>`New York NY 10016` |
| `payment_terms` | Net 15 |
| `status` | active |

**Snapshot fields written to each invoice** (the `invoices` table snapshots `client_name`, `client_email`, `client_company`, `client_address` at issuance):

- `client_name`  = `La Monjita`
- `client_email` = `pablo@alius.vc`
- `client_company` = `Alius Ventures LLC`
- `client_address` = `169 Madison Ave STE 2733\nNew York NY 10016`

> ✅ **Confirmed:** La Monjita's billing identity is *Alius Ventures LLC / pablo@alius.vc*. The backfill snapshots these values as-is.

---

## Step 2 — `invoices` table schema

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `number` | text | YES | — |
| `date` | date | YES | — |
| `due` | date | YES | — |
| `status` | text | YES | `'draft'` |
| `client_name` | text | YES | — |
| `client_email` | text | YES | — |
| `client_company` | text | YES | — |
| `client_address` | text | YES | — |
| `items` | jsonb | YES | `'[]'` |
| `discount` | numeric | YES | `0` |
| `notes` | text | YES | — |
| `created_at` | timestamptz | YES | `now()` |
| `client_id` | uuid | **NO** | — |

Constraints: PK `id`; FK `client_id → clients(id) ON DELETE RESTRICT`. Only `id` and `client_id` are NOT NULL.

**Key structural facts that shape this backfill:**

1. **There is no `amount` column.** Invoice amount is *derived* = `Σ(items[].qty × items[].rate) − discount`. Line items use the key **`rate`** (not `price`). So to record a $4,000 invoice we insert one line item `{qty:1, rate:4000}` with `discount = 0`.
2. **There is no paid-date column.** The table has only `date` (issue) and `due`. The existing import convention sets **`due = date`** (see below), so "issue date = paid date = transaction date" is represented by setting both `date` and `due` to the transaction date.
3. **"Paid" status** is the text value `'paid'`. Distinct `status` values in use: `draft`, `sent`, `paid`, `overdue`.
4. **Notes/memo field:** `notes` (text). The existing historical-import rows store the literal string `'Imported from bank statement'` here. To also capture the bank confirmation reference (which has no dedicated column), this plan writes both: `Imported from bank statement — bank confirmation# <ref>`.

**Invoice number format & sequence:** `#ATM` + 3-digit zero-padded counter (e.g. `#ATM093`). 82 numbered invoices exist. The sequence is **not** globally contiguous (there are gaps), but the maximum is what matters for appending.

- **Current MAX in the ATM sequence:** `#ATM093` (seq = **93**).
- Next sequential numbers `#ATM094`–`#ATM112` are all above MAX → **collision-free**.

---

## Step 3 — Duplicate check

**Result: no duplicates for La Monjita. Safe to proceed.**

- La Monjita invoices dated in **2025**: **0 rows.** (La Monjita's only existing invoices are six 2026 rows — Jan–Jun 2026, $10,000/mo "Fractional Ecom Director", unrelated to this backfill.)
- All existing `'Imported from bank statement'` rows in the 2025-02 → 2025-11 window belong to **other clients** (Good Twin, Summer Water, Jolene Coffee, Afterdream, Khloud, Stuzzi, HpO). None are La Monjita.

ℹ️ **Informational (not duplicates):** a few backfill dates coincide on the calendar with existing invoices for *different* clients — e.g. 2025-02-26 (Good Twin #ATM044), 2025-09-15 (Afterdream #ATM065), 2025-11-18 (HpO #ATM071). Different `client_id`, so these are not double-entries; flagged only for transparency.

---

## Step 4 / proposed inserts — 19 rows

Common to every row: `client_id = c6ac98a8-526b-445d-868a-04c295b16b1f`, `status = paid`, `discount = 0`, `date = due = transaction date`, snapshot fields as in Step 1.

| # | Invoice | Date (issue = paid = due) | Amount | Status | Bank confirmation# |
|---:|---|---|---:|---|---|
| 1 | #ATM094 | 2025-02-26 | $7,500.00 | paid | aawp00761 |
| 2 | #ATM095 | 2025-03-04 | $3,750.00 | paid | f7pkfojty |
| 3 | #ATM096 | 2025-03-14 | $3,750.00 | paid | ievu0akaq |
| 4 | #ATM097 | 2025-04-15 | $3,750.00 | paid | h04fr07ls |
| 5 | #ATM098 | 2025-04-21 | $3,750.00 | paid | bjhb5je0l |
| 6 | #ATM099 | 2025-05-01 | $4,000.00 | paid | a16zaq2d6 |
| 7 | #ATM100 | 2025-05-19 | $3,500.00 | paid | bciq02l1l |
| 8 | #ATM101 | 2025-06-17 | $4,000.00 | paid | d61roaowt |
| 9 | #ATM102 | 2025-06-24 | $4,000.00 | paid | h0fuf8eh6 |
| 10 | #ATM103 | 2025-07-21 | $4,500.00 | paid | c013xx1d4 |
| 11 | #ATM104 | 2025-07-24 | $4,000.00 | paid | h1stzqp15 |
| 12 | #ATM105 | 2025-08-19 | $4,000.00 | paid | enzk21nch |
| 13 | #ATM106 | 2025-08-25 | $4,000.00 | paid | hkslm9pt1 |
| 14 | #ATM107 | 2025-09-15 | $4,000.00 | paid | bl1raq7tn |
| 15 | #ATM108 | 2025-09-18 | $4,000.00 | paid | dunag1yt0 |
| 16 | #ATM109 | 2025-10-28 | $4,000.00 | paid | gk73elm2h |
| 17 | #ATM110 | 2025-10-29 | $4,000.00 | paid | c0g74uk60 |
| 18 | #ATM111 | 2025-11-18 | $4,000.00 | paid | b9mly5me0 |
| 19 | #ATM112 | 2025-11-25 | $4,000.00 | paid | id1u2ado6 |

### Line-item label

The amounts are the bank-transfer values; the `items` line item is metadata (it only needs `rate` to set the derived amount). Per direction, all 19 rows are labeled **"Full-Scale Ecom Growth Bundle"** (service_id `4a34caf7-7625-472a-9496-6cd55757d6d8`) — the same service already on La Monjita's #ATM084 invoice. The dollar amounts are unaffected by this choice.

---

## Proposed SQL — NOT EXECUTED

```sql
-- DRY RUN ONLY — review before running. Nothing below has been executed.
-- La Monjita historical backfill: 19 paid invoices, #ATM094–#ATM112.
-- amount is derived from items (qty*rate) - discount; due = date = transaction date.

INSERT INTO invoices
  (number, date, due, status, client_id, client_name, client_email, client_company, client_address, items, discount, notes)
VALUES
  ('#ATM094', '2025-02-26', '2025-02-26', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":7500,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# aawp00761'),

  ('#ATM095', '2025-03-04', '2025-03-04', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":3750,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# f7pkfojty'),

  ('#ATM096', '2025-03-14', '2025-03-14', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":3750,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# ievu0akaq'),

  ('#ATM097', '2025-04-15', '2025-04-15', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":3750,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# h04fr07ls'),

  ('#ATM098', '2025-04-21', '2025-04-21', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":3750,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# bjhb5je0l'),

  ('#ATM099', '2025-05-01', '2025-05-01', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# a16zaq2d6'),

  ('#ATM100', '2025-05-19', '2025-05-19', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":3500,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# bciq02l1l'),

  ('#ATM101', '2025-06-17', '2025-06-17', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# d61roaowt'),

  ('#ATM102', '2025-06-24', '2025-06-24', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# h0fuf8eh6'),

  ('#ATM103', '2025-07-21', '2025-07-21', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4500,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# c013xx1d4'),

  ('#ATM104', '2025-07-24', '2025-07-24', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# h1stzqp15'),

  ('#ATM105', '2025-08-19', '2025-08-19', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# enzk21nch'),

  ('#ATM106', '2025-08-25', '2025-08-25', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# hkslm9pt1'),

  ('#ATM107', '2025-09-15', '2025-09-15', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# bl1raq7tn'),

  ('#ATM108', '2025-09-18', '2025-09-18', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# dunag1yt0'),

  ('#ATM109', '2025-10-28', '2025-10-28', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# gk73elm2h'),

  ('#ATM110', '2025-10-29', '2025-10-29', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# c0g74uk60'),

  ('#ATM111', '2025-11-18', '2025-11-18', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# b9mly5me0'),

  ('#ATM112', '2025-11-25', '2025-11-25', 'paid', 'c6ac98a8-526b-445d-868a-04c295b16b1f',
   'La Monjita', 'pablo@alius.vc', 'Alius Ventures LLC', E'169 Madison Ave STE 2733\nNew York NY 10016',
   '[{"qty":1,"rate":4000,"title":"Full-Scale Ecom Growth Bundle","service_id":"4a34caf7-7625-472a-9496-6cd55757d6d8","description":"End-to-end ecommerce ownership: DTC management, Meta Ads, Google Ads, Amazon, TikTok Shop, Walmart, technical maintenance, and executive reporting. Full P&L accountability."}]'::jsonb,
   0, 'Imported from bank statement — bank confirmation# id1u2ado6');
```

---

## Step 5 — Total reconciliation

| | |
|---|---:|
| Proposed invoice count | **19** |
| Expected count | 19 ✅ |
| Sum of proposed amounts | **$78,500.00** |
| Expected total | $78,500.00 ✅ |

Arithmetic: 7,500 + 3,750×4 (=15,000) + 4,000×12 (=48,000) + 3,500 + 4,500 = 7,500 + 15,000 + 48,000 + 3,500 + 4,500 = **$78,500.00**.

---

## Pre-apply checklist (for when this leaves dry-run)

1. ✅ Numbers `#ATM094`–`#ATM112` are above current MAX (93) → no collisions.
2. ✅ Snapshot identity confirmed: Alius Ventures LLC / pablo@alius.vc.
3. ✅ Line-item label set to "Full-Scale Ecom Growth Bundle" (service_id `4a34caf7-7625-472a-9496-6cd55757d6d8`) per direction.
4. ✅ No La Monjita 2025 invoices exist → no duplicates.
5. ✅ Totals reconcile to 19 rows / $78,500.00.
