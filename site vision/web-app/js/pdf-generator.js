/**
 * PDF Generator Module
 * สร้าง PDF หนังสือแจ้งนิเทศสหกิจศึกษา ใช้ pdf-lib
 */
import { toThaiNumber, formatThaiDate, formatThaiTimeRange } from './thai-utils.js';

let cachedFont = null;
let cachedFontBold = null;
let cachedLogo = null;

/**
 * Load and cache the Thai font
 */
async function loadFont() {
    if (cachedFont) return { regular: cachedFont, bold: cachedFontBold };

    const fontUrl = './fonts/THSarabunNew.ttf';
    const fontBoldUrl = './fonts/THSarabunNew-Bold.ttf';

    const [regularBytes, boldBytes] = await Promise.all([
        fetch(fontUrl).then(r => r.arrayBuffer()),
        fetch(fontBoldUrl).then(r => r.arrayBuffer())
    ]);

    cachedFont = regularBytes;
    cachedFontBold = boldBytes;
    return { regular: cachedFont, bold: cachedFontBold };
}

/**
 * Load and cache the university logo
 */
async function loadLogo() {
    if (cachedLogo) return cachedLogo;
    const logoUrl = './assets/wu-logo.png';
    try {
        const logoBytes = await fetch(logoUrl).then(r => r.arrayBuffer());
        cachedLogo = logoBytes;
        return cachedLogo;
    } catch {
        return null;
    }
}

/**
 * Draw wrapped text and return the new Y position
 */
function drawWrappedText(page, text, x, y, font, fontSize, maxWidth, lineHeight) {
    const words = text.split('');
    let line = '';
    let currentY = y;

    for (let i = 0; i < text.length; i++) {
        const testLine = line + text[i];
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxWidth && line.length > 0) {
            page.drawText(line, { x, y: currentY, size: fontSize, font });
            line = text[i];
            currentY -= lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line) {
        page.drawText(line, { x, y: currentY, size: fontSize, font });
        currentY -= lineHeight;
    }
    return currentY;
}

/**
 * Generate a single supervision letter PDF for one organization
 * @param {string} orgName - Organization name
 * @param {Object[]} students - Array of student records for this org
 * @returns {Promise<Uint8Array>} PDF bytes
 */
async function generateLetterPDF(orgName, students) {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const fontData = await loadFont();
    const thaiFont = await pdfDoc.embedFont(fontData.regular);
    const thaiFontBold = await pdfDoc.embedFont(fontData.bold);

    // A4 size in points: 595.28 x 841.89
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 70;
    const contentWidth = pageWidth - margin * 2;

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    const representative = students[0];
    const studentCount = students.length;
    const เรียน = representative['เรียน'] || '';
    const สถานประกอบการ = representative['สถานประกอบการ'] || '';
    const อาจารย์ = representative['อาจารย์ผู้นิเทศ'] || '';
    const วันที่ = formatThaiDate(representative['วันที่'] || '');
    const เวลาเริ่ม = representative['เวลาเริ่ม'] || '';
    const เวลาสิ้นสุด = representative['เวลาสิ้นสุด'] || '';
    const timeRange = formatThaiTimeRange(เวลาเริ่ม, เวลาสิ้นสุด);

    let y = pageHeight - 50;
    const black = rgb(0, 0, 0);

    // ===== HEADER =====
    // University name
    page.drawText('มหาวิทยาลัยวลัยลักษณ์  WALAILAK UNIVERSITY', {
        x: 140, y: y, size: 14, font: thaiFontBold, color: black
    });
    y -= 16;

    // Address line 1
    const addr1 = 'นครศรีธรรมราช  :  222 ตำบลไทยบุรี อำเภอท่าศาลา จังหวัดนครศรีธรรมราช 80161';
    page.drawText(addr1, { x: 140, y, size: 10, font: thaiFont, color: black });
    y -= 13;
    page.drawText('โทรศัพท์ 0 7567 3000, 0 7538 4000, 0 7552 3000 โทรสาร 0 7567 3708 E-mail : wu@wu.ac.th', {
        x: 170, y, size: 10, font: thaiFont, color: black
    });
    y -= 13;
    page.drawText('กรุงเทพมหานคร :  เลขที่ 979/44-45 อาคารเอสเอ็ม ทาวเวอร์ ชั้น 19 (ตรงข้าม ททบ.5) ถนนพหลโยธิน', {
        x: 140, y, size: 10, font: thaiFont, color: black
    });
    y -= 13;
    page.drawText('เขตพญาไท กรุงเทพฯ 10400', {
        x: 170, y, size: 10, font: thaiFont, color: black
    });
    y -= 13;
    page.drawText('โทรศัพท์ 0 2298 0244, 0 2299 0930 โทรสาร 0 2298 0248 E-mail : wu-bkk@wu.ac.th', {
        x: 170, y, size: 10, font: thaiFont, color: black
    });

    y -= 30;

    // ===== Document Number & Date =====
    page.drawText('ที่ อว ๗๕ ๑๖ ๐๒ ๐๐/๓๘๙๖', {
        x: margin, y, size: 14, font: thaiFont, color: black
    });

    page.drawText('มหาวิทยาลัยวลัยลักษณ์', {
        x: 320, y, size: 14, font: thaiFont, color: black
    });
    y -= 18;
    page.drawText('จังหวัดนครศรีธรรมราช ๘๐๑๖๑', {
        x: 320, y, size: 14, font: thaiFont, color: black
    });

    y -= 28;
    page.drawText('๖ กุมภาพันธ์ ๒๕๖๙', {
        x: 320, y, size: 14, font: thaiFont, color: black
    });

    y -= 28;

    // ===== Subject =====
    page.drawText('เรื่อง  แจ้งกำหนดการนิเทศนักศึกษาสหกิจศึกษา', {
        x: margin, y, size: 14, font: thaiFont, color: black
    });

    y -= 22;

    // ===== เรียน =====
    const เรียนText = `เรียน  ${เรียน} ${สถานประกอบการ}`;
    y = drawWrappedText(page, เรียนText, margin, y, thaiFont, 14, contentWidth, 20);

    y -= 8;

    // ===== Body paragraph 1 =====
    const bodyPara1 = `\tตามที่ ${สถานประกอบการ} ได้กรุณาตอบรับนักศึกษาหลักสูตรนิติศาสตร์ สำนักวิชานิติศาสตร์ จำนวน ${toThaiNumber(studentCount)} คน เข้าปฏิบัติงานสหกิจศึกษาในหน่วยงานของท่าน ดังรายชื่อต่อไปนี้`;
    y = drawWrappedText(page, bodyPara1, margin, y, thaiFont, 14, contentWidth, 20);

    y -= 8;

    // ===== Student list =====
    for (let i = 0; i < students.length; i++) {
        const name = students[i]['ชื่อ'] || '';
        const num = toThaiNumber(i + 1);
        page.drawText(`\t${num}.  ${name}`, {
            x: margin + 70, y, size: 14, font: thaiFont, color: black
        });
        y -= 20;
    }

    y -= 8;

    // ===== Body paragraph 2 =====
    const bodyPara2 = '\tศูนย์สหกิจศึกษาและพัฒนาอาชีพ มหาวิทยาลัยวลัยลักษณ์ ขออนุญาตให้อาจารย์นิเทศเข้าพบพนักงานที่ปรึกษาและนักศึกษา เพื่อนิเทศการปฏิบัติงานของนักศึกษาและหารือเรื่องอื่นๆ ที่เกี่ยวข้อง เพื่อเป็นการพัฒนาความร่วมมือทางวิชาการระหว่างมหาวิทยาลัยและหน่วยงานของท่าน โดยมีรายละเอียดดังนี้';
    y = drawWrappedText(page, bodyPara2, margin, y, thaiFont, 14, contentWidth, 20);

    y -= 12;

    // ===== Details =====
    const detailX = margin + 80;
    const detailLabelX = detailX + 120;

    page.drawText('ชื่ออาจารย์นิเทศ', {
        x: detailX, y, size: 14, font: thaiFontBold, color: black
    });
    page.drawText(อาจารย์, {
        x: detailLabelX + 20, y, size: 14, font: thaiFont, color: black
    });
    y -= 22;

    page.drawText('วันที่', {
        x: detailX, y, size: 14, font: thaiFontBold, color: black
    });
    page.drawText(วันที่, {
        x: detailLabelX + 20, y, size: 14, font: thaiFont, color: black
    });
    y -= 22;

    page.drawText('เวลา', {
        x: detailX, y, size: 14, font: thaiFontBold, color: black
    });
    page.drawText(timeRange, {
        x: detailLabelX + 20, y, size: 14, font: thaiFont, color: black
    });

    y -= 28;

    // ===== Closing =====
    const closingText = '\tจึงเรียนมาเพื่อโปรดทราบ และกรุณาแจ้งพนักงานที่ปรึกษาและนักศึกษาให้ทราบด้วยจะขอบคุณยิ่ง';
    y = drawWrappedText(page, closingText, margin, y, thaiFont, 14, contentWidth, 20);

    y -= 30;

    // ===== Signature =====
    const centerX = pageWidth / 2;

    page.drawText('ขอแสดงความนับถือ', {
        x: centerX - 40, y, size: 14, font: thaiFont, color: black
    });
    y -= 45;

    page.drawText('(อาจารย์ ดร.อัตนันท์ เตโชพิศาลวงศ์ )', {
        x: centerX - 80, y, size: 14, font: thaiFont, color: black
    });
    y -= 20;
    page.drawText('ผู้อำนวยการศูนย์สหกิจศึกษาและพัฒนาอาชีพ', {
        x: centerX - 85, y, size: 14, font: thaiFont, color: black
    });
    y -= 20;
    page.drawText('ปฏิบัติหน้าที่แทนอธิการบดีมหาวิทยาลัยวลัยลักษณ์', {
        x: centerX - 95, y, size: 14, font: thaiFont, color: black
    });

    // ===== Footer =====
    const footerY = 60;
    page.drawText('นายพชร พงศ์ยี่ล่า', {
        x: margin, y: footerY, size: 11, font: thaiFont, color: black
    });
    page.drawText('ศูนย์สหกิจศึกษาและพัฒนาอาชีพ', {
        x: margin, y: footerY - 14, size: 11, font: thaiFont, color: black
    });
    page.drawText('โทรศัพท์ ๐ ๗๕๔๖ ๓๑๐๕, ๐๙ ๖๖๓๕ ๙๐๒๕ โทรสาร ๐ ๗๕๔๗ ๖๓๐๖', {
        x: margin, y: footerY - 28, size: 11, font: thaiFont, color: black
    });
    page.drawText('E-mail: patchara38616@gmail.com', {
        x: margin, y: footerY - 42, size: 11, font: thaiFont, color: black
    });

    return await pdfDoc.save();
}

/**
 * Generate all PDFs for all organizations
 * @param {Map<string, Object[]>} orgGroups - Map of org name → student records
 * @param {Function} onProgress - Callback (current, total, orgName)
 * @returns {Promise<Map<string, Uint8Array>>} Map of filename → PDF bytes
 */
async function generateAllPDFs(orgGroups, onProgress) {
    // Pre-load fonts
    await loadFont();

    const results = new Map();
    let current = 0;
    const total = orgGroups.size;

    for (const [orgName, students] of orgGroups) {
        current++;
        if (onProgress) onProgress(current, total, orgName);

        try {
            const pdfBytes = await generateLetterPDF(orgName, students);
            // Clean filename
            const safeName = orgName
                .replace(/[/\\:*?"<>|]/g, '-')
                .trim();
            results.set(`${safeName}.pdf`, pdfBytes);
        } catch (e) {
            console.error(`Error generating PDF for ${orgName}:`, e);
        }

        // Small delay to keep UI responsive
        await new Promise(r => setTimeout(r, 50));
    }

    return results;
}

export { generateLetterPDF, generateAllPDFs, loadFont };
