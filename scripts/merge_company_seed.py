import json
import os
from urllib.parse import urlparse
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
# Use the DSA question set as the base seed instead of the large leetcode company seed
BASE_SEED = os.path.join(ROOT, "dsa-questions.json")
SHEETS_DIR = os.path.join(ROOT, "company-wise-question-sheets")
OUTPUT_DIR = os.path.join(ROOT, "backend", "src", "main", "resources", "questionbank-seed")

COMPANY_FILES = [
    "adobe.json", "airbnb.json", "alibaba.json", "amazon.json", "apple.json",
    "atlassian.json", "bloomberg.json", "bytedance.json", "cisco.json",
    "citadel.json", "ebay.json", "expedia.json", "facebook.json",
    "goldman-sachs.json", "google.json", "linkedin.json", "lyft.json",
    "mathworks.json", "microsoft.json", "nutanix.json", "oracle.json",
    "paypal.json", "pinterest.json", "salesforce.json", "sap.json",
    "snapchat.json", "twitter.json", "uber.json", "visa.json", "vmware.json",
    "yahoo.json", "yandex.json", "yelp.json", "zillow.json",
    "jtg-josh-technology-sheet.json"
]

EXCLUDE_FILES = {"_index.json", "_full-striver-a2z.json", "_full-striver-sde.json"}

EXPECTED_FIELDS = [
    "sourceQuestionId", "title", "sourceUrl", "difficulty",
    "topics", "subtopics", "companies", "tags", "supportedLanguages"
]


def slug_from_filename(filename):
    if filename == "jtg-josh-technology-sheet.json":
        return "josh-technology"
    return filename[:-5]


def classify_source(source_url):
    if not source_url or not source_url.strip():
        return None, "null_or_blank"
    try:
        parsed = urlparse(source_url)
        domain = parsed.netloc.lower().replace("www.", "")
        if domain == "leetcode.com":
            return "LEETCODE", None
        if domain in ("geeksforgeeks.org", "practice.geeksforgeeks.org"):
            return "GFG", None
        if domain == "interviewbit.com":
            return None, "interviewbit"
        if domain == "codingninjas.com" or domain.endswith(".codingninjas.com"):
            return None, "codingninjas"
        if domain == "spoj.com" or domain.endswith(".spoj.com"):
            return None, "spoj"
        if domain == "bit.ly":
            return None, "bitly"
        return None, f"unknown_domain:{domain}"
    except Exception:
        return None, "url_parse_error"


def make_record(source_question_id, row, base_record=None):
    def pick(field, default):
        if base_record and base_record.get(field) is not None:
            return base_record[field]
        if row.get(field) is not None:
            return row[field]
        return default

    rec = {}
    rec["sourceQuestionId"] = source_question_id
    rec["title"] = pick("title", "")
    rec["sourceUrl"] = pick("sourceUrl", None)
    rec["difficulty"] = pick("difficulty", None)
    rec["topics"] = pick("topics", [])
    rec["subtopics"] = pick("subtopics", [])
    rec["companies"] = list(pick("companies", []))
    rec["tags"] = list(pick("tags", []))
    rec["supportedLanguages"] = pick("supportedLanguages", [])

    if base_record and base_record.get("sheets"):
        for sheet_name in base_record["sheets"]:
            tag = f"sheet:{sheet_name}"
            if tag not in rec["tags"]:
                rec["tags"].append(tag)

    return rec


def union_companies(existing, new_companies):
    result = list(existing)
    for c in new_companies:
        if c and c not in result:
            result.append(c)
    return result


def main():
    print("=" * 70)
    print("MERGE COMPANY SEED SCRIPT")
    print("=" * 70)

    with open(BASE_SEED, "r", encoding="utf-8") as f:
        base_data = json.load(f)

    base_by_id = {}
    base_sheets_map = {}
    for rec in base_data:
        qid = rec.get("sourceQuestionId")
        if qid:
            base_by_id[qid] = rec
            sheets = rec.get("sheets") or []
            if sheets:
                base_sheets_map[qid] = sheets

    print(f"\nLoaded base seed: {len(base_by_id)} records keyed by sourceQuestionId")
    print(f"Base records with non-empty sheets: {len(base_sheets_map)}")

    merged = {}
    company_counts = defaultdict(int)
    skipped = defaultdict(list)
    new_jtg_created = 0

    for fname in COMPANY_FILES:
        if fname in EXCLUDE_FILES:
            continue
        fpath = os.path.join(SHEETS_DIR, fname)
        if not os.path.exists(fpath):
            print(f"  WARNING: Missing file {fname}, skipping")
            continue

        slug = slug_from_filename(fname)

        with open(fpath, "r", encoding="utf-8") as f:
            rows = json.load(f)

        matched = 0
        new_created = 0
        skipped_local = 0

        for row in rows:
            qid = row.get("sourceQuestionId")
            if not qid:
                skipped["missing_sourceQuestionId"].append(row.get("title", "<no title>"))
                skipped_local += 1
                continue

            base_record = base_by_id.get(qid)
            row_companies = row.get("companies") or []
            if slug not in row_companies:
                row_companies = list(row_companies) + [slug]

            if qid not in merged:
                if base_record is None:
                    new_created += 1
                    if slug == "josh-technology":
                        new_jtg_created += 1
                else:
                    matched += 1
                merged[qid] = make_record(qid, row, base_record)
            else:
                matched += 1

            merged[qid]["companies"] = union_companies(
                merged[qid]["companies"], row_companies
            )

            for c in merged[qid]["companies"]:
                company_counts[c] += 1

        print(f"  {fname} -> slug='{slug}': {len(rows)} rows, matched={matched}, "
              f"new_created={new_created}, skipped={skipped_local}")

    print(f"\nTotal merged distinct records (by sourceQuestionId): {len(merged)}")
    print(f"New JTG-only base records created: {new_jtg_created}")

    for qid, rec in merged.items():
        if qid in base_sheets_map:
            for sheet_name in base_sheets_map[qid]:
                tag = f"sheet:{sheet_name}"
                if tag not in rec["tags"]:
                    rec["tags"].append(tag)

    leetcode_rows = []
    gfg_rows = []
    source_stats = defaultdict(int)

    for qid, rec in merged.items():
        src, skip_reason = classify_source(rec.get("sourceUrl"))
        if src == "LEETCODE":
            leetcode_rows.append(rec)
            source_stats["LEETCODE"] += 1
        elif src == "GFG":
            gfg_rows.append(rec)
            source_stats["GFG"] += 1
        else:
            title = rec.get("title", "<no title>")
            url = rec.get("sourceUrl") or "<blank>"
            skipped[skip_reason or "unknown"].append(
                f"[{qid}] {title}  (url={url})"
            )
            source_stats[skip_reason or "unknown"] += 1

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    leetcode_path = os.path.join(OUTPUT_DIR, "leetcode.json")
    gfg_path = os.path.join(OUTPUT_DIR, "gfg.json")

    with open(leetcode_path, "w", encoding="utf-8") as f:
        json.dump(leetcode_rows, f, indent=2, ensure_ascii=False)

    with open(gfg_path, "w", encoding="utf-8") as f:
        json.dump(gfg_rows, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    total = len(merged)
    leetcode_count = len(leetcode_rows)
    gfg_count = len(gfg_rows)
    skipped_total = sum(len(v) for v in skipped.values())

    print(f"\nTotal distinct sourceQuestionId records merged: {total}")
    print(f"  -> LEETCODE written: {leetcode_count}  ({leetcode_path})")
    print(f"  -> GFG written:      {gfg_count}  ({gfg_path})")
    print(f"  -> Skipped total:    {skipped_total}")

    print("\n--- Source classification counts ---")
    for k, v in sorted(source_stats.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")

    print("\n--- Skipped breakdown (by reason + examples) ---")
    for reason, items in sorted(skipped.items(), key=lambda x: -len(x[1])):
        print(f"\n  Reason '{reason}': {len(items)} record(s)")
        for ex in items[:3]:
            print(f"    - {ex}")
        if len(items) > 3:
            print(f"    ... and {len(items) - 3} more")

    print("\n--- Company occurrence counts (distinct companies merged) ---")
    sorted_companies = sorted(company_counts.items(), key=lambda x: -x[1])
    for company, cnt in sorted_companies:
        print(f"  {company}: {cnt}")
    print(f"\n  Total distinct companies: {len(company_counts)}")

    print("\n" + "=" * 70)
    print("VALIDATION: checking output field shapes")
    print("=" * 70)
    for name, rows in [("leetcode.json", leetcode_rows), ("gfg.json", gfg_rows)]:
        bad = 0
        for r in rows[:50]:
            if sorted(r.keys()) != sorted(EXPECTED_FIELDS):
                bad += 1
                print(f"  {name}: unexpected field set in {r.get('sourceQuestionId')}: "
                      f"{sorted(r.keys())}")
        print(f"  {name}: checked {min(50, len(rows))} rows, {bad} shape violations")
    print(f"  Expected fields: {EXPECTED_FIELDS}")

    print("\nDONE.")


if __name__ == "__main__":
    main()
