/**
 * CSV Parser Module
 * อ่าน CSV, ตรวจสอบ, และจัดกลุ่มข้อมูลตามสถานประกอบการ
 */

const REQUIRED_COLUMNS = ['ชื่อ', 'เรียน', 'สถานประกอบการ', 'อาจารย์ผู้นิเทศ', 'วันที่', 'เวลาเริ่ม', 'เวลาสิ้นสุด'];

/**
 * Parse CSV file content using PapaParse
 * @param {File} file - CSV file object
 * @returns {Promise<Object>} Parsed result { data, errors, meta }
 */
function parseCSVFile(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            encoding: 'UTF-8',
            skipEmptyLines: true,
            complete: (results) => resolve(results),
            error: (error) => reject(error)
        });
    });
}

/**
 * Validate that CSV has required columns
 * @param {string[]} headers - CSV column headers
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateColumns(headers) {
    const missing = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
    return { valid: missing.length === 0, missing };
}

/**
 * Group students by organization (สถานประกอบการ)
 * @param {Object[]} data - CSV row data
 * @returns {Map<string, Object[]>} Map of org name → student records
 */
function groupByOrganization(data) {
    const groups = new Map();
    for (const row of data) {
        const org = (row['สถานประกอบการ'] || '').trim();
        if (!org) continue;
        if (!groups.has(org)) {
            groups.set(org, []);
        }
        groups.get(org).push(row);
    }
    return groups;
}

/**
 * Get summary statistics from parsed data
 * @param {Object[]} data - CSV row data
 * @returns {{ totalStudents: number, totalOrgs: number, orgGroups: Map }}
 */
function getDataSummary(data) {
    const orgGroups = groupByOrganization(data);
    return {
        totalStudents: data.filter(r => (r['สถานประกอบการ'] || '').trim()).length,
        totalOrgs: orgGroups.size,
        orgGroups
    };
}

export { parseCSVFile, validateColumns, groupByOrganization, getDataSummary, REQUIRED_COLUMNS };
