/**
 * Thai Utility Functions
 * แปลงเลขไทย, วันที่ไทย, และอื่นๆ ที่เกี่ยวกับภาษาไทย
 */

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

const THAI_MONTHS = {
    1: 'มกราคม', 2: 'กุมภาพันธ์', 3: 'มีนาคม', 4: 'เมษายน',
    5: 'พฤษภาคม', 6: 'มิถุนายน', 7: 'กรกฎาคม', 8: 'สิงหาคม',
    9: 'กันยายน', 10: 'ตุลาคม', 11: 'พฤศจิกายน', 12: 'ธันวาคม'
};

/**
 * Convert Arabic numeral string to Thai numeral string
 * @param {number|string} n - Number to convert
 * @returns {string} Thai numeral string
 */
function toThaiNumber(n) {
    return String(n).replace(/[0-9]/g, d => THAI_DIGITS[parseInt(d)]);
}

/**
 * Convert date string like '4/2/2026' to '๔ กุมภาพันธ์ ๒๕๖๙'
 * @param {string} dateStr - Date string in d/m/yyyy format
 * @returns {string} Formatted Thai date
 */
function formatThaiDate(dateStr) {
    try {
        const parts = dateStr.trim().split('/');
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        const thaiYear = year + 543;
        return `${toThaiNumber(day)} ${THAI_MONTHS[month]} ${toThaiNumber(thaiYear)}`;
    } catch (e) {
        return dateStr;
    }
}

/**
 * Format time range
 * @param {string} start - Start time e.g. "10:00"
 * @param {string} end - End time e.g. "11:30"
 * @returns {string} Formatted time range in Thai numerals
 */
function formatThaiTimeRange(start, end) {
    const startParts = start.split(':');
    const endParts = end.split(':');
    const formatTime = (parts) => {
        const h = toThaiNumber(parseInt(parts[0]));
        const m = toThaiNumber(parseInt(parts[1] || 0).toString().padStart(2, '0'));
        return `${h}:${m}`;
    };
    // Ensure proper padding for minutes in Thai
    const fmtStart = `${toThaiNumber(parseInt(startParts[0]))}.${toThaiNumber(String(parseInt(startParts[1] || 0)).padStart(2, '0'))}`;
    const fmtEnd = `${toThaiNumber(parseInt(endParts[0]))}.${toThaiNumber(String(parseInt(endParts[1] || 0)).padStart(2, '0'))}`;
    return `${fmtStart} – ${fmtEnd} น.`;
}

export { toThaiNumber, formatThaiDate, formatThaiTimeRange, THAI_MONTHS };
