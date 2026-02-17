/**
 * Main Application Module
 * จัดการ UI, flow, file upload, download
 */
import { parseCSVFile, validateColumns, getDataSummary, REQUIRED_COLUMNS } from './csv-parser.js';
import { generateAllPDFs } from './pdf-generator.js';
import { toThaiNumber } from './thai-utils.js';

// State
let parsedData = null;
let orgGroups = null;
let generatedPDFs = null;

// ============ INITIALIZATION ============

document.addEventListener('DOMContentLoaded', () => {
    initDropZone();
    initButtons();
    initSampleCSVDownload();
});

// ============ SAMPLE DOWNLOAD ============

function initSampleCSVDownload() {
    const btn = document.getElementById('btn-download-csv');
    if (btn) {
        btn.addEventListener('click', downloadSampleCSV);
    }
    const btn2 = document.getElementById('btn-download-sample-pdf');
    if (btn2) {
        btn2.addEventListener('click', () => {
            window.open('./templates/sample-letter.pdf', '_blank');
        });
    }
}

function downloadSampleCSV() {
    // Create a sample CSV with headers and 2 example rows
    const headers = 'ลำดับที่,รหัสนักศึกษา,ชื่อ,เรียน,สถานประกอบการ,ติดต่อ,เมล,อาจารย์ผู้นิเทศ,วันที่,เวลาเริ่ม,เวลาสิ้นสุด,สถานะ';
    const row1 = '1,66117557,นายธนดล นนทเภท,ผู้ช่วยอธิการบดีฝ่ายสื่อสารองค์กร,ส่วนสื่อสารองค์กร มหาวิทยาลัยวลัยลักษณ์,"0-7547-6316-27, 0-7547-6321",prwalailak@gmail.com,ดร.คณิตสรณ์ สุริยะไพบูลย์วัฒนา,3/2/2026,10:00,11:30,';
    const row2 = '2,66129057,นางสาวอรอมล สมจิตต์,ผู้จัดการฝ่ายทรัพยากรบุคคล,ส่วนสื่อสารองค์กร มหาวิทยาลัยวลัยลักษณ์,"0-7547-6316-27, 0-7547-6321",prwalailak@gmail.com,ดร.คณิตสรณ์ สุริยะไพบูลย์วัฒนา,3/2/2026,10:00,11:30,';
    const row3 = '3,66119223,นายอัครวิชญ์ สีชุม,ผู้จัดการฝ่ายทรัพยากรบุคคล,บริษัท เซ็นทรัลพัฒนา จำกัด (มหาชน) สาขานครศรีธรรมราช,075-803333 Ext.1700,nanannapas@centralpattana.co.th,ผศ.ดร.ยุทธนา เจริญรื่น,4/2/2026,14:00,15:30,';

    const csvContent = `\uFEFF${headers}\r\n${row1}\r\n${row2}\r\n${row3}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'ฟอร์มข้อมูลนิเทศ-ตัวอย่าง.csv');
}

// ============ DRAG & DROP ============

function initDropZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-file-input');

    if (!dropZone || !fileInput) return;

    // Click to select file
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag events
    ['dragenter', 'dragover'].forEach(e => {
        dropZone.addEventListener(e, (ev) => {
            ev.preventDefault();
            dropZone.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(e => {
        dropZone.addEventListener(e, (ev) => {
            ev.preventDefault();
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (ev) => {
        const files = ev.dataTransfer.files;
        if (files.length > 0) handleCSVFile(files[0]);
    });

    fileInput.addEventListener('change', (ev) => {
        if (ev.target.files.length > 0) handleCSVFile(ev.target.files[0]);
    });
}

// ============ CSV PROCESSING ============

async function handleCSVFile(file) {
    const statusEl = document.getElementById('upload-status');
    const previewEl = document.getElementById('data-preview');
    const summaryEl = document.getElementById('data-summary');
    const step3 = document.getElementById('step-3');
    const fileName = document.getElementById('file-name');

    // Show file name
    if (fileName) {
        fileName.textContent = `📄 ${file.name}`;
        fileName.style.display = 'block';
    }

    try {
        statusEl.innerHTML = '<span class="status-loading">⏳ กำลังอ่านไฟล์...</span>';

        const result = await parseCSVFile(file);

        // Validate columns
        const validation = validateColumns(result.meta.fields || []);
        if (!validation.valid) {
            statusEl.innerHTML = `<span class="status-error">❌ ไฟล์ CSV ขาดคอลัมน์ที่จำเป็น:<br>${validation.missing.join(', ')}</span>`;
            return;
        }

        parsedData = result.data;
        const summary = getDataSummary(parsedData);
        orgGroups = summary.orgGroups;

        // Show summary
        summaryEl.innerHTML = `
            <div class="summary-cards">
                <div class="summary-card">
                    <div class="summary-number">${summary.totalStudents}</div>
                    <div class="summary-label">นักศึกษา</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${summary.totalOrgs}</div>
                    <div class="summary-label">สถานประกอบการ</div>
                </div>
                <div class="summary-card">
                    <div class="summary-number">${summary.totalOrgs}</div>
                    <div class="summary-label">PDF ที่จะสร้าง</div>
                </div>
            </div>
        `;

        // Show preview table
        renderPreviewTable(parsedData, previewEl);

        statusEl.innerHTML = '<span class="status-success">✅ อ่านไฟล์สำเร็จ</span>';

        // Show step 3
        if (step3) {
            step3.style.display = 'block';
            step3.classList.add('fade-in');
        }

    } catch (e) {
        statusEl.innerHTML = `<span class="status-error">❌ เกิดข้อผิดพลาด: ${e.message}</span>`;
    }
}

function renderPreviewTable(data, container) {
    if (!data || data.length === 0) return;

    const displayCols = ['ชื่อ', 'สถานประกอบการ', 'อาจารย์ผู้นิเทศ', 'วันที่', 'เวลาเริ่ม', 'เวลาสิ้นสุด'];
    const maxRows = Math.min(data.length, 20);

    let html = '<div class="table-wrapper"><table class="preview-table">';
    html += '<thead><tr>';
    html += '<th>#</th>';
    displayCols.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    for (let i = 0; i < maxRows; i++) {
        const row = data[i];
        html += `<tr><td>${i + 1}</td>`;
        displayCols.forEach(col => {
            html += `<td>${row[col] || '-'}</td>`;
        });
        html += '</tr>';
    }

    html += '</tbody></table></div>';

    if (data.length > maxRows) {
        html += `<p class="more-rows">...และอีก ${data.length - maxRows} รายการ</p>`;
    }

    container.innerHTML = html;
}

// ============ BUTTONS ============

function initButtons() {
    const btnGenerate = document.getElementById('btn-generate');
    if (btnGenerate) {
        btnGenerate.addEventListener('click', handleGenerate);
    }

    const btnDownloadAll = document.getElementById('btn-download-all');
    if (btnDownloadAll) {
        btnDownloadAll.addEventListener('click', handleDownloadAll);
    }
}

// ============ PDF GENERATION ============

async function handleGenerate() {
    if (!orgGroups || orgGroups.size === 0) return;

    const btnGenerate = document.getElementById('btn-generate');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const resultsList = document.getElementById('results-list');
    const downloadAllSection = document.getElementById('download-all-section');

    btnGenerate.disabled = true;
    btnGenerate.innerHTML = '⏳ กำลังสร้าง PDF...';
    progressContainer.style.display = 'block';
    resultsList.innerHTML = '';

    try {
        generatedPDFs = await generateAllPDFs(orgGroups, (current, total, orgName) => {
            const percent = Math.round((current / total) * 100);
            progressBar.style.width = `${percent}%`;
            progressText.textContent = `${current}/${total} - ${orgName}`;

            // Add to results list
            const li = document.createElement('div');
            li.className = 'result-item fade-in';
            li.innerHTML = `
                <span class="result-name">📄 ${orgName}.pdf</span>
                <button class="btn-small btn-download-single" data-filename="${orgName.replace(/[/\\:*?"<>|]/g, '-').trim()}.pdf">
                    ⬇️ ดาวน์โหลด
                </button>
            `;
            resultsList.appendChild(li);
        });

        progressText.textContent = `เสร็จสิ้น! สร้าง PDF ทั้งหมด ${generatedPDFs.size} ไฟล์`;

        // Add click handlers for individual downloads
        document.querySelectorAll('.btn-download-single').forEach(btn => {
            btn.addEventListener('click', () => {
                const filename = btn.dataset.filename;
                if (generatedPDFs.has(filename)) {
                    const blob = new Blob([generatedPDFs.get(filename)], { type: 'application/pdf' });
                    saveAs(blob, filename);
                }
            });
        });

        // Show download all button
        downloadAllSection.style.display = 'flex';
        downloadAllSection.classList.add('fade-in');

    } catch (e) {
        progressText.textContent = `❌ เกิดข้อผิดพลาด: ${e.message}`;
        console.error(e);
    }

    btnGenerate.disabled = false;
    btnGenerate.innerHTML = '🔄 สร้าง PDF อีกครั้ง';
}

async function handleDownloadAll() {
    if (!generatedPDFs || generatedPDFs.size === 0) return;

    const btn = document.getElementById('btn-download-all');
    btn.disabled = true;
    btn.innerHTML = '⏳ กำลังสร้างไฟล์ ZIP...';

    try {
        const zip = new JSZip();

        for (const [filename, pdfBytes] of generatedPDFs) {
            zip.file(filename, pdfBytes);
        }

        const content = await zip.generateAsync({ type: 'blob' });
        saveAs(content, 'หนังสือแจ้งนิเทศ-ทั้งหมด.zip');
    } catch (e) {
        console.error('Error creating ZIP:', e);
    }

    btn.disabled = false;
    btn.innerHTML = '📦 ดาวน์โหลดทั้งหมด (ZIP)';
}
