from flask import Flask, render_template, request, send_file, flash, redirect, url_for, session
from flask_session import Session
import pandas as pd
import fitz  # PyMuPDF
import os
import zipfile
import io
from datetime import datetime
import tempfile
from collections import defaultdict

app = Flask(__name__)
app.secret_key = 'your-secret-key-here'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SESSION_TYPE'] = 'filesystem'  # Enable filesystem session
app.config['SESSION_FILE_DIR'] = 'sessions'  # Session storage directory

# Create necessary directories
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'outputs'
TEMPLATE_FOLDER = 'templates'
SESSION_FOLDER = 'sessions'

for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, TEMPLATE_FOLDER, SESSION_FOLDER]:
    os.makedirs(folder, exist_ok=True)

# Initialize session
Session(app)

@app.route('/')
def index():
    # Check if PDF template exists in session
    template_path = session.get('pdf_template_path')
    template_status = "No template uploaded"
    if template_path and os.path.exists(template_path):
        template_status = f"Template loaded: {os.path.basename(template_path)}"
    
    return render_template('index.html', template_status=template_status)

@app.route('/download_template')
def download_template():
    """Download Excel template with required columns"""
    # Create template DataFrame
    template_data = {
        'ชื่อ-สกุล นักศึกษา': ['ตัวอย่าง: สมชาย ใจดี'],
        'เรียน': ['ตัวอย่าง: ผู้อำนวยการ'],
        'สถานประกอบการ': ['ตัวอย่าง: บริษัท จีไอเอส กรุ๊ป จำกัด']
    }
    
    df = pd.DataFrame(template_data)
    
    # Save to Excel file
    template_path = os.path.join(UPLOAD_FOLDER, 'template.xlsx')
    df.to_excel(template_path, index=False, engine='openpyxl')
    
    return send_file(template_path, 
                    as_attachment=True, 
                    download_name='template.xlsx',
                    mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

@app.route('/upload_pdf_template', methods=['POST'])
def upload_pdf_template():
    """Handle PDF template upload"""
    print(f"Request files: {request.files}")
    print(f"Request form: {request.form}")
    
    if 'pdf_template' not in request.files:
        print("No pdf_template in request.files")
        flash('No PDF template selected')
        return redirect(url_for('index'))
    
    file = request.files['pdf_template']
    print(f"File: {file}, Filename: {file.filename}")
    
    if file.filename == '':
        print("Empty filename")
        flash('No PDF template selected')
        return redirect(url_for('index'))
    
    if file and file.filename.endswith('.pdf'):
        filename = f"template_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        filepath = os.path.join(TEMPLATE_FOLDER, filename)
        print(f"Saving to: {filepath}")
        file.save(filepath)
        
        # Store template path in session
        session['pdf_template_path'] = filepath
        session.permanent = True  # Make session permanent
        print(f"Session path set: {filepath}")
        flash('PDF template uploaded successfully!')
        return redirect(url_for('index'))
    
    flash('Please upload a PDF file (.pdf)')
    return redirect(url_for('index'))

@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    """Handle Excel file upload"""
    print("=== EXCEL UPLOAD START ===")
    print(f"Method: {request.method}")
    print(f"Excel upload request - files: {request.files}")
    print(f"Session check - pdf_template_path: {session.get('pdf_template_path')}")
    
    if request.method == 'GET':
        return redirect(url_for('index'))
    
    # Bypass template check for testing
    if not session.get('pdf_template_path'):
        print("No PDF template in session, using fallback")
        # Use fallback template
        template_path = None
    else:
        template_path = session.get('pdf_template_path')
    
    if 'file' not in request.files:
        print("No file in request")
        flash('No file selected')
        return redirect(url_for('index'))
    
    file = request.files['file']
    if file.filename == '':
        print("Empty filename")
        flash('No file selected')
        return redirect(url_for('index'))
    
    if file and file.filename.endswith('.xlsx'):
        filename = f"upload_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        print(f"Saving Excel to: {filepath}")
        file.save(filepath)
        
        try:
            # Read Excel file
            df = pd.read_excel(filepath, engine='openpyxl')
            print(f"Excel data loaded: {len(df)} rows")
            print(f"Columns: {list(df.columns)}")
            
            # Validate columns
            required_columns = ['ชื่อ-สกุล นักศึกษา', 'เรียน', 'สถานประกอบการ']
            missing_columns = [col for col in required_columns if col not in df.columns]
            
            if missing_columns:
                print(f"Missing columns: {missing_columns}")
                flash(f'Missing required columns: {", ".join(missing_columns)}')
                return redirect(url_for('index'))
            
            print("Starting PDF generation...")
            # Process PDF generation
            zip_buffer = process_pdf_generation(df, template_path)
            
            print("PDF generation completed, sending file...")
            return send_file(
                io.BytesIO(zip_buffer.getvalue()),
                mimetype='application/zip',
                as_attachment=True,
                download_name='generated_pdfs.zip'
            )
            
        except Exception as e:
            print(f"Error during processing: {str(e)}")
            import traceback
            traceback.print_exc()
            flash(f'Error processing file: {str(e)}')
            return redirect(url_for('index'))
    
    flash('Please upload an Excel file (.xlsx)')
    return redirect(url_for('index'))

def process_pdf_generation(df, template_path):
    """Process PDF generation - group by organization and create one PDF per organization"""
    zip_buffer = io.BytesIO()
    
    # Group data by organization
    grouped_data = defaultdict(list)
    for index, row in df.iterrows():
        organization = str(row['สถานประกอบการ']).strip()
        grouped_data[organization].append({
            'student_name': str(row['ชื่อ-สกุล นักศึกษา']).strip(),
            'recipient': str(row['เรียน']).strip(),
            'organization': organization
        })
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for organization, students in grouped_data.items():
            # Generate one PDF per organization with all students
            pdf_content = generate_organization_pdf(students, template_path)
            
            # Create filename based on organization
            safe_filename = f"{organization}.pdf".replace('/', '_').replace('\\', '_')
            
            # Add to zip
            zip_file.writestr(safe_filename, pdf_content)
    
    zip_buffer.seek(0)
    return zip_buffer

def generate_organization_pdf(students, template_path):
    """Generate PDF for one organization with multiple students using template"""
    try:
        # Open the template PDF
        doc = fitz.open(template_path)
        
        # For each student, create a new page
        for i, student in enumerate(students):
            if i > 0:
                # Add new page for additional students
                page = doc.new_page(width=doc[0].rect.width, height=doc[0].rect.height)
                # Copy content from first page
                page.show_pdf_page(page.rect, doc, 0)
            
            # Get the page to modify
            page = doc[i]
            
            # Replace text at specific positions
            replace_text_in_pdf(page, student)
        
        # Save to bytes
        pdf_bytes = doc.tobytes()
        doc.close()
        
        return pdf_bytes
        
    except Exception as e:
        print(f"Error using template: {e}")
        # Fallback to generated PDF if template fails
        return generate_fallback_pdf(students)

def replace_text_in_pdf(page, student):
    """Replace text at specific positions in PDF"""
    # Define the text patterns to find and replace
    replacements = [
        # Find "เรียน" and replace with recipient and organization
        ("เรียน", f"เรียน {student['recipient']}\n{student['organization']}"),
        # Find "สิ่งที่ส่งมาด้วย ๒" and add student name
        ("สิ่งที่ส่งมาด้วย ๒", f"สิ่งที่ส่งมาด้วย ๒\nใบสมัครงาน {student['student_name']}"),
        # Find "นักศึกษา" and replace with student name
        ("นักศึกษา", f"นักศึกษา {student['student_name']}")
    ]
    
    for search_text, replace_with in replacements:
        # Search for text and replace it
        text_instances = page.search_for(search_text)
        for inst in text_instances:
            # Redact (remove) the original text
            page.add_redact_annot(inst, fill=(1, 1, 1))  # White background
            page.apply_redactions()
            
            # Add new text at the same position
            rect = inst
            page.insert_text(rect.tl, replace_with, fontsize=12, color=(0, 0, 0))

def generate_fallback_pdf(students):
    """Generate fallback PDF when template fails"""
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import inch
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    
    # Try to register Thai font
    try:
        pdfmetrics.registerFont(TTFont('THSarabun', 'THSarabunNew.ttf'))
        font_name = 'THSarabun'
        font_size = 16
    except:
        font_name = 'Helvetica'
        font_size = 12
    
    # Create page for each student
    for i, student in enumerate(students):
        if i > 0:
            c.showPage()
        
        c.setFont(font_name, font_size)
        y_position = height - 2 * inch
        
        # Recipient line
        c.drawString(2 * inch, y_position, f"เรียน {student['recipient']}")
        y_position -= 0.5 * inch
        
        # Organization line  
        c.drawString(2 * inch, y_position, f"{student['organization']}")
        y_position -= 1 * inch
        
        # Student name in application line
        c.drawString(2 * inch, y_position, "สิ่งที่ส่งมาด้วย ๒")
        y_position -= 0.3 * inch
        c.drawString(2.5 * inch, y_position, f"ใบสมัครงาน {student['student_name']}")
        y_position -= 1 * inch
        
        # Student name in table
        c.drawString(2 * inch, y_position, f"นักศึกษา: {student['student_name']}")
    
    c.save()
    buffer.seek(0)
    
    return buffer.getvalue()

def generate_single_pdf(student_name, recipient, organization):
    """Legacy function - kept for compatibility"""
    students = [{'student_name': student_name, 'recipient': recipient, 'organization': organization}]
    return generate_fallback_pdf(students)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
