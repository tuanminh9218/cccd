from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, KeepTogether
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import datetime

# Note: This script requires reportlab: pip install reportlab
# For Vietnamese support, you would need a Unicode font file (e.g., 'Times New Roman.ttf')
# pdfmetrics.registerFont(TTFont('TimesNewRoman', 'times.ttf'))

def generate_medical_pdf(data, output_filename):
    # 1. Setup Page: A4 with margins (Left 2cm, Right 2cm, Top 1.5cm, Bottom 1.5cm)
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=A4,
        rightMargin=2*cm,
        leftMargin=2*cm,
        topMargin=1.5*cm,
        bottomMargin=1.5*cm
    )

    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=1, # Center
        spaceAfter=20,
        fontName='Helvetica-Bold' # Use 'TimesNewRoman-Bold' if font registered
    )
    
    header_left_style = ParagraphStyle(
        'HeaderLeft',
        fontSize=10,
        alignment=0, # Left
        fontName='Helvetica-Bold'
    )

    normal_style = styles['Normal']
    normal_style.fontSize = 12
    normal_style.fontName = 'Helvetica'

    elements = []

    # 2. Header Structure
    # Logo and Hospital Name on Left, Title Centered
    # Using a table for layout
    header_data = [
        [
            Paragraph("BỆNH VIỆN ĐHYD<br/>Số: .........../KHTH", header_left_style),
            Paragraph("TÓM TẮT KẾT QUẢ KHÁM SỨC KHỎE<br/>MẪU SONG NGỮ", title_style),
            "" # Spacer
        ]
    ]
    header_table = Table(header_data, colWidths=[5*cm, 10*cm, 2*cm])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'CENTER'),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 1*cm))

    # 3. Personal Info
    elements.append(Paragraph(f"<b>Họ và tên:</b> {data.get('fullName', '....................')}", normal_style))
    elements.append(Paragraph(f"<b>Ngày sinh:</b> {data.get('dateOfBirth', '....................')}", normal_style))
    elements.append(Paragraph(f"<b>Địa chỉ:</b> {data.get('address', '....................')}", normal_style))
    elements.append(Spacer(1, 0.5*cm))

    # 4. Medical Table (Mandatory Grid)
    table_data = [
        ["STT", "NỘI DUNG KHÁM", "KẾT QUẢ", "BS KHÁM KÝ"]
    ]
    
    # Sample rows
    rows = [
        ["1", "Chiều cao, cân nặng", "Cao: 170cm, Nặng: 65kg", ""],
        ["2", "Mạch, huyết áp", "120/80 mmHg", ""],
        ["3", "Khám Nội khoa", "Bình thường", ""],
        ["4", "Khám Ngoại khoa", "Bình thường", ""],
        ["5", "Khám Tai - Mũi - Họng", "Bình thường", ""],
    ]
    table_data.extend(rows)

    # TableStyle with grid (0.5pt)
    medical_table = Table(table_data, colWidths=[1*cm, 6*cm, 7*cm, 3*cm])
    medical_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.black),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('ALIGN', (0,0), (0,-1), 'CENTER'), # STT Center
        ('ALIGN', (1,0), (2,-1), 'LEFT'),   # Content/Result Left
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
    ]))
    
    # KeepTogether to prevent breaking inside table rows
    elements.append(KeepTogether(medical_table))
    elements.append(Spacer(1, 1*cm))

    # 5. Signature and Date (Hidden table aligned right)
    now = datetime.datetime.now()
    footer_data = [
        ["", ""],
        ["", f"BẮC NINH, Ngày {now.day} tháng {now.month} năm {now.year}"],
        ["", "KT. TRƯỞNG PHÒNG KHTH"],
        ["", ""], # Signature space
        ["", ""],
        ["", "BS. ................................"]
    ]
    footer_table = Table(footer_data, colWidths=[10*cm, 7*cm])
    footer_table.setStyle(TableStyle([
        ('ALIGN', (1,1), (1,-1), 'CENTER'),
        ('FONTNAME', (1,2), (1,2), 'Helvetica-Bold'),
        ('FONTNAME', (1,5), (1,5), 'Helvetica-Bold'),
    ]))
    elements.append(footer_table)

    # Generate PDF
    doc.build(elements)
    print(f"PDF generated: {output_filename}")

if __name__ == "__main__":
    sample_data = {
        "fullName": "NGUYỄN VĂN A",
        "dateOfBirth": "12/12/1999",
        "address": "Hà Nội"
    }
    generate_medical_pdf(sample_data, "Mau_Kham_Suc_Khoe_ReportLab.pdf")
