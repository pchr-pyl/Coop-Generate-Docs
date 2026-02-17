#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
สร้างไฟล์ PDF หนังสือแจ้งนิเทศ จากร่าง DOCX + ข้อมูล CSV
ใช้ร่างหนังสือแจ้งนิเทศ.docx เป็น template แล้วแทนที่ placeholder ด้วยข้อมูลจาก CSV
แปลงเป็น PDF ผ่าน Microsoft Word (docx2pdf)
"""

import csv
import os
import sys
import io
import copy
import re
import shutil
from datetime import datetime
from docx import Document
from docx.shared import Pt
from docx2pdf import convert

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_FILE = os.path.join(SCRIPT_DIR, "ร่างหนังสือแจ้งนิเทศ.docx")
CSV_FILE = os.path.join(SCRIPT_DIR, "DCM 66 3_68 - นิเทศ 3_68.csv")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "generated_pdfs")

THAI_DIGITS = str.maketrans("0123456789", "๐๑๒๓๔๕๖๗๘๙")

THAI_MONTHS = {
    1: "มกราคม", 2: "กุมภาพันธ์", 3: "มีนาคม", 4: "เมษายน",
    5: "พฤษภาคม", 6: "มิถุนายน", 7: "กรกฎาคม", 8: "สิงหาคม",
    9: "กันยายน", 10: "ตุลาคม", 11: "พฤศจิกายน", 12: "ธันวาคม"
}

THAI_NUMBERS = {
    1: "๑", 2: "๒", 3: "๓", 4: "๔", 5: "๕",
    6: "๖", 7: "๗", 8: "๘", 9: "๙", 10: "๑๐",
}


def to_thai_number(n):
    """Convert integer to Thai numeral string"""
    return str(n).translate(THAI_DIGITS)


def format_thai_date(date_str):
    """Convert date string like '4/2/2026' to '๔ กุมภาพันธ์ ๒๕๖๙'"""
    try:
        parts = date_str.strip().split("/")
        day = int(parts[0])
        month = int(parts[1])
        year = int(parts[2])
        # Convert CE to BE
        thai_year = year + 543
        thai_day = to_thai_number(day)
        thai_month = THAI_MONTHS.get(month, str(month))
        thai_year_str = to_thai_number(thai_year)
        return f"{thai_day} {thai_month} {thai_year_str}"
    except Exception:
        return date_str


def format_student_list(students):
    """Format list of student names (numbering comes from DOCX list style)"""
    lines = []
    for s in students:
        lines.append(s['ชื่อ'])
    return lines


def replace_runs_text(paragraph, old_text, new_text):
    """
    Replace text across runs in a paragraph while preserving formatting.
    Joins all run texts, finds old_text, replaces with new_text,
    then redistributes back to runs.
    """
    # Build full text from runs
    full_text = ""
    for run in paragraph.runs:
        full_text += run.text

    if old_text not in full_text:
        return False

    new_full = full_text.replace(old_text, new_text)

    # Redistribute text back to runs
    # Put all text in first run, clear the rest
    if paragraph.runs:
        paragraph.runs[0].text = new_full
        for run in paragraph.runs[1:]:
            run.text = ""
    return True


def process_template(template_path, output_docx_path, org_name, students):
    """Copy template and replace placeholders with actual data"""
    doc = Document(template_path)

    representative = students[0]
    student_count = len(students)
    เรียน = representative["เรียน"]
    สถานประกอบการ = representative["สถานประกอบการ"]
    อาจารย์ = representative["อาจารย์ผู้นิเทศ"]
    วันที่ = format_thai_date(representative["วันที่"])
    เวลาเริ่ม = representative["เวลาเริ่ม"]
    เวลาสิ้นสุด = representative["เวลาสิ้นสุด"]
    student_names = format_student_list(students)

    for para in doc.paragraphs:
        full = ""
        for run in para.runs:
            full += run.text

        # P2: เรียน [คอลัมน์ เรียน] [คอลัมน์ สถานประกอบการ]
        if "[คอลัมน์ เรียน]" in full and "[คอลัมน์ สถานประกอบการ]" in full:
            new_full = full.replace("[คอลัมน์ เรียน]", เรียน)
            new_full = new_full.replace("[คอลัมน์ สถานประกอบการ]", สถานประกอบการ)
            para.runs[0].text = new_full
            for run in para.runs[1:]:
                run.text = ""
            continue

        # P3: ตามที่ [คอลัมน์ สถานประกอบการ] ... จำนวน [นับจำนวนนักศึกษาที่ไป] คน ...
        if "[คอลัมน์ สถานประกอบการ]" in full:
            new_full = full.replace("[คอลัมน์ สถานประกอบการ]", สถานประกอบการ)
            new_full = new_full.replace("[นับจำนวนนักศึกษาที่ไป]", str(student_count))
            para.runs[0].text = new_full
            for run in para.runs[1:]:
                run.text = ""
            continue

        # P5: [รายชื่อนักศึกษา]
        if "[รายชื่อนักศึกษา]" in full:
            # Replace with first student, add more paragraphs after if needed
            new_full = full.replace("[รายชื่อนักศึกษา]", student_names[0])
            para.runs[0].text = new_full
            for run in para.runs[1:]:
                run.text = ""
            # Additional students will be added after this paragraph
            continue

        # P8: [คอลัมน์ อาจารย์ผู้นิเทศ]
        if "[คอลัมน์ อาจารย์ผู้นิเทศ]" in full:
            new_full = full.replace("[คอลัมน์ อาจารย์ผู้นิเทศ]", อาจารย์)
            para.runs[0].text = new_full
            for run in para.runs[1:]:
                run.text = ""
            continue

        # P9: [คอลัมน์ วันที่ (Format ...)]
        if "คอลัมน์ วันที่" in full:
            # Replace the entire placeholder including format instruction
            new_full = full
            new_full = re.sub(r'\[คอลัมน์ วันที่.*?\]', วันที่, new_full)
            para.runs[0].text = new_full
            for run in para.runs[1:]:
                run.text = ""
            continue

        # P10: [คอลัมน์ เวลาเริ่ม] – [คอลัมน์ เวลาสิ้นสุด]
        if "คอลัมน์ เวลาเริ่ม" in full or ("คอลัมน์" in full and "เวลา" in full):
            new_full = re.sub(r'\[คอลัมน์\s*เวลาเริ่ม\]', เวลาเริ่ม, full)
            new_full = re.sub(r'\[คอลัมน์\s*เวลาสิ้นสุด\]', เวลาสิ้นสุด, new_full)
            para.runs[0].text = new_full
            for run in para.runs[1:]:
                run.text = ""
            continue

    # Handle multiple students: insert additional student name paragraphs
    if len(students) > 1:
        # Find the paragraph with the first student name
        for i, para in enumerate(doc.paragraphs):
            full = ""
            for run in para.runs:
                full += run.text
            if student_names[0] in full:
                # Insert additional students after this paragraph
                # We need to add paragraphs after the current one
                ref_element = para._element
                for extra_idx in range(1, len(students)):
                    new_para = copy.deepcopy(para._element)
                    # Update text in the new paragraph
                    from docx.oxml.ns import qn
                    for r in new_para.findall(qn('w:r')):
                        for t in r.findall(qn('w:t')):
                            if student_names[0] in (t.text or ""):
                                t.text = t.text.replace(student_names[0], student_names[extra_idx])
                            elif t.text:
                                # Clear extra runs
                                pass
                    ref_element.addnext(new_para)
                    ref_element = new_para
                break

    doc.save(output_docx_path)


def main():
    print("=" * 60)
    print("สร้างหนังสือแจ้งนิเทศ PDF")
    print("=" * 60)

    # Create output directories
    docx_temp_dir = os.path.join(OUTPUT_DIR, "_temp_docx")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(docx_temp_dir, exist_ok=True)

    # Read CSV and group by organization
    organizations = {}
    with open(CSV_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            org = row["สถานประกอบการ"].strip()
            if not org:
                continue
            if org not in organizations:
                organizations[org] = []
            organizations[org].append(row)

    print(f"พบ {len(organizations)} สถานประกอบการ")
    print()

    # Generate DOCX for each organization
    docx_files = []
    for org_name, students in organizations.items():
        # Clean filename
        safe_name = org_name.replace("/", "-").replace("\\", "-").replace(":", "-")
        safe_name = safe_name.replace('"', "").replace("*", "").replace("?", "")
        safe_name = safe_name.replace("<", "").replace(">", "").replace("|", "")

        docx_path = os.path.join(docx_temp_dir, f"{safe_name}.docx")
        pdf_path = os.path.join(OUTPUT_DIR, f"{safe_name}.pdf")

        print(f"  กำลังสร้าง: {safe_name}.pdf ({len(students)} นักศึกษา)")

        try:
            process_template(TEMPLATE_FILE, docx_path, org_name, students)
            docx_files.append((docx_path, pdf_path))
        except Exception as e:
            print(f"    [ERROR] {e}")

    # Convert all DOCX to PDF using Word
    print()
    print("กำลังแปลง DOCX เป็น PDF ผ่าน Microsoft Word...")
    for docx_path, pdf_path in docx_files:
        try:
            convert(docx_path, pdf_path)
            print(f"  [OK] {os.path.basename(pdf_path)}")
        except Exception as e:
            print(f"  [ERROR] {os.path.basename(pdf_path)}: {e}")

    # Clean up temp docx files
    try:
        shutil.rmtree(docx_temp_dir)
    except:
        pass

    print()
    print(f"เสร็จสิ้น! ไฟล์ PDF อยู่ที่: {OUTPUT_DIR}")
    print(f"จำนวนไฟล์: {len(docx_files)}")


if __name__ == "__main__":
    main()
