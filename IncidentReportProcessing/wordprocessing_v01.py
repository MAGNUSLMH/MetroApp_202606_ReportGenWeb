import json
import re
from docx import Document


def clean_spaces(text: str) -> str:
    """Removes leading, trailing, and inline duplicate spaces (including non-breaking spaces)."""
    if not text:
        return ""
    text = text.replace("\xa0", " ")
    return re.sub(r"\s+", " ", text).strip()


def format_single_line(raw_text: str) -> str:
    """Converts multi-line text into a single line separated by single spaces."""
    lines = raw_text.splitlines()
    cleaned_lines = [clean_spaces(line) for line in lines if clean_spaces(line)]
    return " ".join(cleaned_lines)


def strip_at_timestamp(line: str) -> str:
    """Strips 'At' and the timestamp pattern from the start of the line."""
    cleaned = re.sub(
        r"^At\s+[\d\/\-\.:\s]+(?:hrs)?[\s,-]*", "", line, flags=re.IGNORECASE
    )
    return clean_spaces(cleaned)


def parse_word_doc_to_json(file_path: str) -> str:
    doc = Document(file_path)
    extracted_reports = []

    for table in doc.tables:
        report = {
            "Fault description": "",
            "Sequency of event": {},
            "Finding": "",
            "Root cause": "",
            "Action Taken": "",
            "Resume time": "",
        }

        num_rows = len(table.rows)
        for r_idx in range(num_rows):
            for c_idx in range(len(table.rows[r_idx].cells)):
                cell_text = clean_spaces(table.rows[r_idx].cells[c_idx].text)
                cell_lower = cell_text.lower()

                # Get content cell directly below the header cell
                content_cell_text = ""
                if r_idx + 1 < num_rows:
                    content_cell_text = table.rows[r_idx + 1].cells[c_idx].text

                if cell_lower == "fault description":
                    report["Fault description"] = format_single_line(
                        content_cell_text
                    )

                elif cell_lower.startswith("sequency"):
                    lines = content_cell_text.splitlines()
                    seq_items = []

                    for line in lines:
                        cleaned_line = clean_spaces(line)

                        # Rule 1: Ignore empty lines and lines starting with 'Date'
                        if (
                            not cleaned_line
                            or cleaned_line.lower().startswith("date")
                        ):
                            continue

                        # Check if line starts with "At "
                        if re.match(r"^At\s+", cleaned_line, re.IGNORECASE):
                            sentence_after_time = strip_at_timestamp(
                                cleaned_line
                            )
                            seq_items.append(sentence_after_time)
                        else:
                            # Rule 2: Join stray lines to the previous "At" group
                            if seq_items:
                                seq_items[-1] = (
                                    f"{seq_items[-1]} {cleaned_line}"
                                )
                            else:
                                seq_items.append(cleaned_line)

                    # Categorize sequence by row position
                    report["Sequency of event"] = {
                        f"row_{idx + 1}": item
                        for idx, item in enumerate(seq_items)
                    }

                elif cell_lower == "finding":
                    report["Finding"] = format_single_line(content_cell_text)

                elif cell_lower == "root cause":
                    report["Root cause"] = format_single_line(content_cell_text)

                elif cell_lower in ["action taken", "action taken "]:
                    report["Action Taken"] = format_single_line(
                        content_cell_text
                    )

                elif cell_lower == "resume time":
                    report["Resume time"] = format_single_line(content_cell_text)

        if any(report.values()):
            extracted_reports.append(report)

    return json.dumps(extracted_reports, indent=2, ensure_ascii=False)


# Run extraction and save output
json_result = parse_word_doc_to_json("./Fault.docx")

with open("extracted_faults.json", "w", encoding="utf-8") as f:
    f.write(json_result)