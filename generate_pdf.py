import pdfkit
import datetime

# Step 1: HTML/CSS Structure
html_template = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: "Times New Roman", Times, serif;
            padding: 20px;
            line-height: 1.5;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            text-transform: uppercase;
            font-size: 18pt;
            margin: 0;
        }
        .info-block {
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        table, th, td {
            border: 1px solid black;
        }
        th, td {
            padding: 8px;
            text-align: left;
        }
        tr {
            page-break-inside: avoid;
        }
        .footer {
            margin-top: 50px;
            text-align: right;
            page-break-inside: avoid;
        }
        .signature-box {
            display: inline-block;
            text-align: center;
            width: 300px;
        }
        .options {
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>PHIẾU KẾT QUẢ KHÁM SỨC KHỎE</h1>
    </div>

    <div class="info-block">
        <p><strong>Họ và tên:</strong> {{HO_VA_TEN}}</p>
        <p><strong>Ngày sinh:</strong> {{NGAY_SINH}}</p>
        <p><strong>Địa chỉ:</strong> Hà Nội</p>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 50px; text-align: center;">TT</th>
                <th>NỘI DUNG KHÁM</th>
                <th>KẾT QUẢ</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="text-align: center;">1</td>
                <td>Thể lực (Chiều cao, Cân nặng)</td>
                <td>Chiều cao: 170cm, Cân nặng: 65kg</td>
            </tr>
            <tr>
                <td style="text-align: center;">2</td>
                <td>Mắt</td>
                <td>
                    Thị lực không kính: <br>
                    A. 10/10 <br>
                    B. 9/10 <br>
                    C. 8/10 <br>
                    D. Khác
                </td>
            </tr>
            <tr>
                <td style="text-align: center;">3</td>
                <td>Tai - Mũi - Họng</td>
                <td>Bình thường</td>
            </tr>
            <tr>
                <td style="text-align: center;">4</td>
                <td>Răng - Hàm - Mặt</td>
                <td>Bình thường</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <div class="signature-box">
            <p><i>Hà Nội, ngày {{NGAY}} tháng {{THANG}} năm {{NAM}}</i></p>
            <p><strong>NGƯỜI KÝ TÊN</strong></p>
            <br><br><br>
            <p><strong>{{HO_VA_TEN}}</strong></p>
        </div>
    </div>
</body>
</html>
"""

# Step 3: Fill Data
data = {
    "HO_VA_TEN": "NGUYỄN VĂN A",
    "NGAY_SINH": "12/12/1999",
    "NGAY": datetime.datetime.now().day,
    "THANG": datetime.datetime.now().month,
    "NAM": datetime.datetime.now().year
}

html_content = html_template
for key, value in data.items():
    html_content = html_content.replace(f"{{{{{key}}}}}", str(value))

# Step 2: Convert to PDF
options = {
    'page-size': 'A4',
    'orientation': 'Portrait',
    'encoding': "UTF-8",
}

# Note: This requires wkhtmltopdf installed on the system
try:
    pdfkit.from_string(html_content, 'Phieu_Kham_Suc_Khoe.pdf', options=options)
    print("PDF generated successfully: Phieu_Kham_Suc_Khoe.pdf")
except Exception as e:
    print(f"Error generating PDF: {e}")
    print("Please ensure wkhtmltopdf is installed.")
